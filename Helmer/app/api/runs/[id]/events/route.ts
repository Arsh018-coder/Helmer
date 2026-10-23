/**
 * /api/runs/[id]/events?after=<seq> — the cursor polling endpoint.
 *
 * The browser keeps the last `seq` it saw and asks only for what is newer, then feeds the
 * accumulated list to `lib/reduceEvents.ts`. The current run status travels with the events
 * so a single request both advances the timeline and decides whether polling can stop.
 */

import { requireRunAuth } from '../../../../../server/auth';
import { db } from '../../../../../server/db';
import { listEvents } from '../../../../../server/events';
import { handleRoute, okJson } from '../../../../../server/http';
import { getRunStatus } from '../../../../../server/runs';
import { parseWith, readAfterSeq, runIdSchema } from '../../../../../server/validation';

export const dynamic = 'force-dynamic';

interface RunContext {
  params: Promise<{ id: string }>;
}

export const GET = handleRoute<RunContext>('events', async (request, context) => {
  const { id } = await context.params;
  parseWith(runIdSchema, id);
  requireRunAuth(request, id);

  const after = readAfterSeq(request);
  const [events, status] = await Promise.all([listEvents(db, id, after), getRunStatus(db, id)]);

  return okJson({ events, status });
});
