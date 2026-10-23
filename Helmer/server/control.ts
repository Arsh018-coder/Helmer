/**
 * server/control.ts — writes to the `commands` table: how the user steers a run.
 *
 * The browser and the worker never share memory, so a control action is a database row the loop
 * reads between steps (AGENTS.md section 8). This module is the only place that writes those rows,
 * which keeps the "one shape of command" rule in one file.
 *
 * Accepting a command also appends `command_received` to the run's chain, so the timeline shows the
 * user's action the moment it lands — even if the worker is in the middle of a slow LLM call and
 * will not act on it for a few seconds.
 */

import type { PrismaClient } from '@prisma/client';
import { COMMAND_KIND, EVENT_TYPE, type CommandKind, type CommandSource } from './constants';
import { badRequest } from './errors';
import { appendEvent } from './recorder';

export interface CommandSubmission {
  kind: CommandKind;
  payload: Record<string, unknown>;
  source: CommandSource;
}

/**
 * Record a control action for a run.
 *
 * A `redirect` without an instruction is rejected here rather than silently stored, because a
 * redirect that changes nothing would show up in the timeline as a user action with no effect.
 *
 * @throws AppError 400 `bad_request` when a redirect carries no instruction.
 */
export async function submitCommand(
  db: PrismaClient,
  runId: string,
  submission: CommandSubmission,
): Promise<void> {
  if (submission.kind === COMMAND_KIND.redirect) {
    const instruction = submission.payload.instruction;
    if (typeof instruction !== 'string' || instruction.trim().length === 0) {
      throw badRequest('A redirect requires a non-empty payload.instruction');
    }
  }

  // `source` travels with the row so the worker's log and the UI can attribute the action.
  await db.command.create({
    data: {
      runId,
      kind: submission.kind,
      payload: JSON.stringify({ ...submission.payload, source: submission.source }),
    },
  });

  // Update run status in DB immediately so API status queries and UI reflect state without delay
  if (submission.kind === COMMAND_KIND.pause) {
    await db.run.update({ where: { id: runId }, data: { status: 'paused' } });
  } else if (submission.kind === COMMAND_KIND.resume) {
    await db.run.update({ where: { id: runId }, data: { status: 'running' } });
  } else if (submission.kind === COMMAND_KIND.stop) {
    await db.run.update({ where: { id: runId }, data: { status: 'stopped', finishedAt: new Date() } });
  }

  // Chaos is consumed by the tool runner; announcing it as a user command would be misleading.
  if (submission.kind !== COMMAND_KIND.chaos) {
    await appendEvent(db, runId, EVENT_TYPE.commandReceived, {
      kind: submission.kind,
      payload: submission.payload,
      source: submission.source,
    });
  }
}
