/**
 * /api/runs/[id]/share — mint the phone Steer link for one run.
 *
 * The returned URL carries a share token scoped to this run and valid for two hours, so a
 * phone can pause or redirect without being handed the project-wide access code.
 */

import { requireAccessCode, signShareToken } from '../../../../../server/auth';
import { db } from '../../../../../server/db';
import { handleRoute, okJson } from '../../../../../server/http';
import { getRunStatus } from '../../../../../server/runs';
import { parseWith, runIdSchema } from '../../../../../server/validation';

export const dynamic = 'force-dynamic';

interface RunContext {
  params: Promise<{ id: string }>;
}

export const POST = handleRoute<RunContext>('share', async (request, context) => {
  const { id } = await context.params;
  parseWith(runIdSchema, id);
  requireAccessCode(request);

  // Look the run up first so a share link is never issued for a typo.
  await getRunStatus(db, id);

  const token = signShareToken(id);
  const origin = new URL(request.url).origin;

  return okJson({ url: `${origin}/r/${id}?t=${encodeURIComponent(token)}` });
});
