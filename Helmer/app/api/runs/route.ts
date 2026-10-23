/**
 * /api/runs — the run collection.
 *
 * GET  lists runs newest-first for the console and history pages.
 * POST creates a queued run that this machine's worker (WORKER_TAG) will claim.
 *
 * Both handlers authenticate with the access code and stay thin: the work lives in
 * `server/runs.ts` (AGENTS.md section 19).
 */

import { requireAccessCode } from '../../../server/auth';
import { config } from '../../../server/config';
import { db } from '../../../server/db';
import { handleRoute, okJson } from '../../../server/http';
import { createRun, listRuns } from '../../../server/runs';
import { createRunSchema, parseJson } from '../../../server/validation';

export const dynamic = 'force-dynamic';

export const GET = handleRoute('runs', async (request) => {
  requireAccessCode(request);
  return okJson({ runs: await listRuns(db) });
});

export const POST = handleRoute('runs', async (request) => {
  requireAccessCode(request);
  const input = await parseJson(request, createRunSchema);

  // The goal comes from the model-free form; the budget defaults are filled in by createRun.
  const id = await createRun(db, {
    goal: input.goal,
    budget: input.budget,
    workerTag: config.workerTag,
  });

  return okJson({ id }, 201);
});
