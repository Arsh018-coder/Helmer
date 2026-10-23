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

// Close runs left running by a previous worker crash
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

// Heartbeat for health reporting
async function heartbeat(): Promise<void> {
  await db.worker.upsert({
    where: { tag: config.workerTag },
    create: { tag: config.workerTag, seenAt: new Date() },
    update: { seenAt: new Date() },
  });
}

interface ClaimedRun {
  id: string;
  goal: string;
  budget: string;
}

// Claim oldest queued run atomically
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

async function waitForConfigAndDb(): Promise<void> {
  let warned = false;
  for (;;) {
    try {
      validateConfig();
      await db.$queryRaw`SELECT 1`;
      log.info('database reachable');
      return;
    } catch (error) {
      if (!warned) {
        log.warn('worker standby: ' + (error instanceof Error ? error.message : String(error)));
        log.info('web application is active; worker will resume automatically once DATABASE_URL and .env are ready.');
        warned = true;
      }
      await sleep(10000);
    }
  }
}

async function main(): Promise<void> {
  await waitForConfigAndDb();
  log.info('starting', { tag: config.workerTag });

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
