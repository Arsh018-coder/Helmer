/**
 * POST /api/auth — validate the shared access code.
 *
 * The console gates itself on this before it will show runs; the code itself is never stored
 * client-side beyond the user's session. Validation and the constant-time compare live in
 * `server/auth.ts` so this handler stays a boundary only.
 *
 * Request:  { code: string }
 * Response: 200 { ok: true } | 401 { ok: false, error: 'invalid_code' }
 */

import { verifyAccessCode } from '../../../server/auth';
import { invalidCode } from '../../../server/errors';
import { handleRoute, okJson } from '../../../server/http';
import { authSchema, parseJson } from '../../../server/validation';

export const dynamic = 'force-dynamic';

export const POST = handleRoute('auth', async (request) => {
  const { code } = await parseJson(request, authSchema);
  if (!verifyAccessCode(code)) throw invalidCode();

  return okJson({});
});
