/**
 * /api/runs/[id]/tamper — demo-only edit of a stored event payload.
 *
 * It overwrites `events.payload` **without** recomputing the hash, so the next
 * `verify-chain` call reports a break at that sequence number. It is guarded twice: the
 * access code is always required, and `ALLOW_TAMPER=1` must be set (AGENTS.md section 7).
 */

import { requireAccessCode } from '../../../../../server/auth';
import { config } from '../../../../../server/config';
import { db } from '../../../../../server/db';
import { notFound, tamperDisabled } from '../../../../../server/errors';
import { tamperEventPayload } from '../../../../../server/events';
import { handleRoute, okJson } from '../../../../../server/http';
import { parseJson, parseWith, runIdSchema, tamperSchema } from '../../../../../server/validation';

export const dynamic = 'force-dynamic';

interface RunContext {
  params: Promise<{ id: string }>;
}

export const POST = handleRoute<RunContext>('tamper', async (request, context) => {
  const { id } = await context.params;
  parseWith(runIdSchema, id);
  requireAccessCode(request);

  if (!config.allowTamper) throw tamperDisabled();

  const input = await parseJson(request, tamperSchema);
  const affected = await tamperEventPayload(db, id, input.seq, input.payload);
  if (affected === 0) throw notFound(`Run ${id} has no event ${input.seq}`);

  return okJson({ seq: input.seq });
});
