/**
 * /api/runs/[id]/commands — pause, resume, stop or redirect a live run.
 *
 * The command is stored as a row the worker reads between steps, and `command_received` is
 * appended immediately so the user sees their action on the timeline even while the worker is
 * busy inside a slow LLM call.
 */

import { requireRunAuth } from '../../../../../server/auth';
import { COMMAND_SOURCE } from '../../../../../server/constants';
import { submitCommand } from '../../../../../server/control';
import { db } from '../../../../../server/db';
import { handleRoute, okJson } from '../../../../../server/http';
import { commandSchema, parseJson, parseWith, runIdSchema } from '../../../../../server/validation';

export const dynamic = 'force-dynamic';

interface RunContext {
  params: Promise<{ id: string }>;
}

export const POST = handleRoute<RunContext>('commands', async (request, context) => {
  const { id } = await context.params;
  parseWith(runIdSchema, id);
  requireRunAuth(request, id);

  const input = await parseJson(request, commandSchema);
  await submitCommand(db, id, {
    kind: input.kind,
    payload: input.payload ?? {},
    source: input.source ?? COMMAND_SOURCE.console,
  });

  return okJson({ accepted: true });
});
