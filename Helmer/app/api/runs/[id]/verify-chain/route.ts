/**
 * /api/runs/[id]/verify-chain — recompute the flight recorder's hash chain.
 *
 * The response is returned **without** the `{ ok: true, ... }` envelope used elsewhere: here
 * `ok` is the chain verdict itself (docs/CONTRACT.md section 4), and wrapping it would collide
 * with the envelope's own `ok`.
 */

import { requireRunAuth } from '../../../../../server/auth';
import { db } from '../../../../../server/db';
import { handleRoute } from '../../../../../server/http';
import { verifyChain } from '../../../../../server/recorder';
import { parseWith, runIdSchema } from '../../../../../server/validation';

export const dynamic = 'force-dynamic';

interface RunContext {
  params: Promise<{ id: string }>;
}

export const GET = handleRoute<RunContext>('verify-chain', async (request, context) => {
  const { id } = await context.params;
  parseWith(runIdSchema, id);
  requireRunAuth(request, id);

  return Response.json(await verifyChain(db, id));
});
