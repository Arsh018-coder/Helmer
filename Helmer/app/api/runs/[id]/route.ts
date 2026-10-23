/**
 * /api/runs/[id] — one run with its contract, plan and budget.
 *
 * Reachable with the access code or a share token for this run, so the phone Steer page can
 * render the contract without ever holding the project-wide code.
 */

import { requireRunAuth } from '../../../../server/auth';
import { db } from '../../../../server/db';
import { handleRoute, okJson } from '../../../../server/http';
import { getRunDetail } from '../../../../server/runs';
import { parseWith, runIdSchema } from '../../../../server/validation';

export const dynamic = 'force-dynamic';

interface RunContext {
  params: Promise<{ id: string }>;
}

export const GET = handleRoute<RunContext>('run', async (request, context) => {
  const { id } = await context.params;
  parseWith(runIdSchema, id);
  requireRunAuth(request, id);

  return okJson({ run: await getRunDetail(db, id) });
});
