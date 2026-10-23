/**
 * GET /api/health — liveness of every moving part.
 *
 * No auth: judges and operators must be able to check this freely before a demo. Every flag is
 * the result of a real live check, never a constant (BACKEND_PLAN.md section 3):
 *   - `db_reachable`   — a `SELECT 1` against Supabase.
 *   - `llm_reachable`  — the provider's `/models` endpoint with a 3 s timeout.
 *   - `worker_alive`   — a worker heartbeat row seen recently; "run stays queued forever" is
 *                        the classic failure of a split architecture, so it is made visible.
 */

import { config } from '../../../server/config';
import { WORKER_ALIVE_WINDOW_MS } from '../../../server/constants';
import { db } from '../../../server/db';
import { handleRoute } from '../../../server/http';

export const dynamic = 'force-dynamic';

/** How long the LLM ping may take before it is treated as unreachable. */
const LLM_PING_TIMEOUT_MS = 3_000;

async function dbReachable(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/** A flaky provider must not break the health route, so every failure path returns false. */
async function llmReachable(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_PING_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.llmBaseUrl.replace(/\/$/, '')}/models`, {
      headers: { Authorization: `Bearer ${config.llmApiKey}` },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function workerAlive(): Promise<boolean> {
  try {
    const cutoff = new Date(Date.now() - WORKER_ALIVE_WINDOW_MS);
    const row = await db.worker.findFirst({ where: { seenAt: { gt: cutoff } }, select: { tag: true } });
    return row !== null;
  } catch {
    return false;
  }
}

export const GET = handleRoute('health', async () => {
  const [db_reachable, llm_reachable, worker_alive] = await Promise.all([
    dbReachable(),
    llmReachable(),
    workerAlive(),
  ]);

  // The database is the minimum bar; the worker being down is a warning, not an outage.
  const ok = db_reachable;

  return Response.json(
    { ok, db_reachable, llm_reachable, worker_alive, version: config.version },
    { status: ok ? 200 : 503 },
  );
});
