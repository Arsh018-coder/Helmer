/**
 * worker/index.ts — the Helmer agent process.
 *
 * It runs outside Next.js on purpose: a run can last minutes and must be able to pause, which a
 * serverless function cannot do (AGENTS.md section 2). Its whole job is a small loop —
 *
 *   validate config → clean up → heartbeat → claim a queued run → run the agent → repeat
 *
 * — with two failure modes made visible:
 *  - a misconfigured `.env` fails immediately and lists every missing variable, because "the run
 *    stays queued forever" is the classic failure of a split architecture;
 *  - a run this worker left `running` after a crash is closed on startup with a `run_failed`
 *    event, so nothing hangs in the UI.
 *
 * Import rules: relative imports only — the `@/` alias is a Next.js feature and is unavailable
 * under `tsx`.
 *
 * `dotenv/config` is imported first because this process is not started by Next.js: nothing has
 * loaded `.env` for it, and without it `validateConfig()` would fail on a correctly configured
 * machine. Import order is preserved for side effects, so the environment is populated before any
 * other module reads it.
 */

import 'dotenv/config';

import {
  EVENT_TYPE,
  RUN_STATUS,
  WORKER_HEARTBEAT_MS,
  WORKER_POLL_MS,
} from '../server/constants.js';
import { config, validateConfig } from '../server/config.js';
import { db } from '../server/db.js';
import { logger } from '../server/logger.js';
import { appendEvent } from '../server/recorder.js';
import { parseBudget } from '../server/runs.js';
import { runAgent } from '../server/agent/loop.js';

const log = logger('worker');

// ─────────────────────────────────────────────────────────────────────────────
// Startup: close runs this worker left running when it crashed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A run still marked `running` under our own tag means this worker died mid-run.
 *
 * Each one is closed with a real `run_failed` event on the same hash chain, so the UI shows an
 * honest ending rather than an eternal spinner. Runs belonging to other tags are left alone.
 */
async function cleanupStuckRuns(): Promise<void> {
  const stuck = await db.run.findMany({
    where: { status: RUN_STATUS.running, workerTag: config.workerTag },
    select: { id: true },
  });

  if (stuck.length === 0) return;
  log.warn('closing runs left running by a previous crash', { count: stuck.length });

  for (const { id } of stuck) {
    await appendEvent(db, id, EVENT_TYPE.runFailed, { error: 'worker restarted' });
    await db.run.update({
      where: { id },
      data: { status: RUN_STATUS.failed, finishedAt: new Date() },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Heartbeat — how /api/health knows the worker is alive
// ─────────────────────────────────────────────────────────────────────────────

async function heartbeat(): Promise<void> {
  await db.worker.upsert({
    where: { tag: config.workerTag },
    create: { tag: config.workerTag, seenAt: new Date() },
    update: { seenAt: new Date() },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Atomic claim
// ─────────────────────────────────────────────────────────────────────────────

interface ClaimedRun {
  id: string;
  goal: string;
  budget: string;
}

/**
 * Claim the oldest queued run for this worker tag.
 *
 * `FOR UPDATE SKIP LOCKED` is what makes two workers safe: the row is locked for the duration of
 * the update, so the second worker skips it instead of claiming the same run (AGENTS.md section 8).
 */
async function claimNextRun(): Promise<ClaimedRun | null> {
  const rows = await db.$queryRaw<ClaimedRun[]>`
    UPDATE runs
    SET status = ${RUN_STATUS.running}
    WHERE id = (
      SELECT id FROM runs
      WHERE status = ${RUN_STATUS.queued} AND "workerTag" = ${config.workerTag}
      ORDER BY "createdAt"
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, goal, budget
  `;
  return rows[0] ?? null;
}

/** Execute one claimed run, marking it failed if the agent throws unexpectedly. */
async function runClaimedRun(run: ClaimedRun): Promise<void> {
  log.info('running agent', { runId: run.id });

  try {
    await runAgent({
      db,
      runId: run.id,
      goal: run.goal,
      budget: parseBudget(run.budget),
    });
    log.info('agent finished', { runId: run.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('agent failed', { runId: run.id, message });

    // The loop closes completed and stopped runs itself; only an unexpected throw lands here.
    await appendEvent(db, run.id, EVENT_TYPE.runFailed, { error: message });
    await db.run.update({
      where: { id: run.id },
      data: { status: RUN_STATUS.failed, finishedAt: new Date() },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main loop
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  // Fail before touching the database if anything required is missing from the environment.
  validateConfig();
  log.info('starting', { tag: config.workerTag });

  try {
    await db.$queryRaw`SELECT 1`;
    log.info('database reachable');
  } catch (error) {
    log.error('cannot reach the database — check DATABASE_URL', {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }

  await cleanupStuckRuns();
  await heartbeat();

  const heartbeatTimer = setInterval(() => {
    heartbeat().catch((error: unknown) => {
      log.error('heartbeat failed', { message: error instanceof Error ? error.message : String(error) });
    });
  }, WORKER_HEARTBEAT_MS);

  log.info('polling for queued runs');

  try {
    for (;;) {
      try {
        const run = await claimNextRun();
        if (run) await runClaimedRun(run);
      } catch (error) {
        log.error('poll cycle failed', {
          message: error instanceof Error ? error.message : String(error),
        });
      }
      await sleep(WORKER_POLL_MS);
    }
  } finally {
    clearInterval(heartbeatTimer);
  }
}

main().catch((error: unknown) => {
  log.error('fatal', { message: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
