/**
 * /api/runs/[id]/chaos — inject a fault into one tool for the demo.
 *
 * The fault is stored as a `chaos` command the tool runner consumes *before* it executes, so
 * the failure travels the exact same code path a real outage would. The resulting `tool_error`
 * carries `injected: true`, which is what the UI badges as INJECTED.
 */

import { requireRunAuth } from '../../../../../server/auth';
import { COMMAND_KIND, COMMAND_SOURCE } from '../../../../../server/constants';
import { submitCommand } from '../../../../../server/control';
import { db } from '../../../../../server/db';
import { handleRoute, okJson } from '../../../../../server/http';
import { chaosSchema, parseJson, parseWith, runIdSchema } from '../../../../../server/validation';

export const dynamic = 'force-dynamic';

interface RunContext {
  params: Promise<{ id: string }>;
}

export const POST = handleRoute<RunContext>('chaos', async (request, context) => {
  const { id } = await context.params;
  parseWith(runIdSchema, id);
  requireRunAuth(request, id);

  const input = await parseJson(request, chaosSchema);
  await submitCommand(db, id, {
    kind: COMMAND_KIND.chaos,
    payload: { tool: input.tool, mode: input.mode, count: input.count ?? 1 },
    source: COMMAND_SOURCE.console,
  });

  return okJson({ accepted: true });
});
