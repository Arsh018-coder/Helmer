/**
 * /api/runs/[id]/artifact — download the deliverable.
 *
 * The file lives in the `artifacts` table, not on disk, so this works whether the web app and
 * the worker are on the same machine or not. The filename in `Content-Disposition` comes from
 * the stored row (already validated by `write_file`).
 */

import { requireRunAuth } from '../../../../../server/auth';
import { getDeliverable } from '../../../../../server/artifacts';
import { db } from '../../../../../server/db';
import { handleRoute } from '../../../../../server/http';
import { parseWith, runIdSchema } from '../../../../../server/validation';

export const dynamic = 'force-dynamic';

interface RunContext {
  params: Promise<{ id: string }>;
}

export const GET = handleRoute<RunContext>('artifact', async (request, context) => {
  const { id } = await context.params;
  parseWith(runIdSchema, id);
  requireRunAuth(request, id);

  const deliverable = await getDeliverable(db, id);
  const contentType = deliverable.name.endsWith('.txt')
    ? 'text/plain; charset=utf-8'
    : 'text/markdown; charset=utf-8';

  return new Response(deliverable.content, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${deliverable.name}"`,
      'X-Artifact-Bytes': String(deliverable.bytes),
    },
  });
});
