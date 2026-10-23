/**
 * /api/runs/[id]/bundle — export everything the offline verifier needs.
 *
 * The payload is the run's full event chain plus its head hash. `/verify` re-hashes it in the
 * browser with WebCrypto and compares the result against a head hash the user pasted from
 * somewhere outside our database, which is what makes the check independent of this server.
 */

import { requireAccessCode } from '../../../../../server/auth';
import { db } from '../../../../../server/db';
import { exportBundle } from '../../../../../server/events';
import { handleRoute, okJson } from '../../../../../server/http';
import { parseWith, runIdSchema } from '../../../../../server/validation';

export const dynamic = 'force-dynamic';

interface RunContext {
  params: Promise<{ id: string }>;
}

export const GET = handleRoute<RunContext>('bundle', async (request, context) => {
  const { id } = await context.params;
  parseWith(runIdSchema, id);
  requireAccessCode(request);

  return okJson(await exportBundle(db, id));
});
