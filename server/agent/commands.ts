/**
 * server/agent/commands.ts — how the user steers a run while it is working.
 *
 * The browser never talks to the worker directly. A control action writes a row into the
 * `commands` table, and the loop reads that table **between steps**, so pause, resume, stop and
 * redirect are cooperative and always land at a step boundary (AGENTS.md section 8). That is
 * why a stop never corrupts the log: the run stops where it is, and the event is written.
 *
 * `chaos` commands are deliberately excluded here — they are consumed inside the tool runner,
 * in the same code path a real failure takes.
 */

import { COMMAND_KIND, COMMAND_POLL_MS, EVENT_TYPE } from '../constants';
import { logger } from '../logger';
import type { AgentContext } from './types';

const log = logger('commands');

/** Mutable control state owned by the loop and updated here. */
export interface RunControlState {
  paused: boolean;
  /** Why the run is paused (`user` or `drift`); null while running. */
  pauseReason: string | null;
  /** Set once a stop command is seen; the loop must end the run at this step boundary. */
  stopRequested: boolean;
  /** Latest redirect instruction, which replaces the goal for the remaining steps. */
  instruction: string | null;
}

/** A fresh control state for a run that is just starting. */
export function createControlState(): RunControlState {
  return { paused: false, pauseReason: null, stopRequested: false, instruction: null };
}

/** Set by the drift guard so a policy pause is distinguishable from a user pause. */
export function requestDriftPause(state: RunControlState): void {
  state.paused = true;
  state.pauseReason = 'drift';
}

interface StoredCommand {
  id: number;
  kind: string;
  payload: string;
}

/** Read the `instruction` field out of a stored command payload, if it has one. */
function readInstruction(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { instruction?: unknown };
    return typeof parsed.instruction === 'string' ? parsed.instruction : null;
  } catch {
    return null;
  }
}

/**
 * Apply one control command and emit its state-change event.
 *
 * `command_received` is written by the API route that accepted the command, so the user sees their
 * action land immediately even while the worker is mid-step. Re-emitting it here would duplicate
 * the timeline entry, so this function only records the effect.
 */
async function applyCommand(ctx: AgentContext, state: RunControlState, command: StoredCommand): Promise<void> {
  const instruction = readInstruction(command.payload);

  switch (command.kind) {
    case COMMAND_KIND.pause:
      state.paused = true;
      state.pauseReason = 'user';
      await ctx.emit(EVENT_TYPE.paused, { reason: 'user' });
      break;

    case COMMAND_KIND.resume:
      state.paused = false;
      state.pauseReason = null;
      await ctx.emit(EVENT_TYPE.resumed, {});
      break;

    case COMMAND_KIND.stop:
      state.stopRequested = true;
      await ctx.emit(EVENT_TYPE.stopped, { reason: 'user' });
      break;

    case COMMAND_KIND.redirect:
      if (instruction) {
        state.instruction = instruction;
        await ctx.emit(EVENT_TYPE.redirected, { new_instruction: instruction });
      }
      break;

    default:
      log.warn('ignoring unknown command kind', { kind: command.kind, runId: ctx.runId });
  }
}

/** Drain every unconsumed control command, oldest first. */
async function drainCommands(ctx: AgentContext, state: RunControlState): Promise<void> {
  const pending = await ctx.db.command.findMany({
    where: { runId: ctx.runId, consumedAt: null, kind: { not: COMMAND_KIND.chaos } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, kind: true, payload: true },
  });

  for (const command of pending) {
    // Claim it before acting: a second poller must not replay the same command.
    const claimed = await ctx.db.command.updateMany({
      where: { id: command.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (claimed.count === 0) continue;

    await applyCommand(ctx, state, command);
  }
}

/**
 * Process control commands, blocking while the run is paused.
 *
 * Called between steps. While paused it polls every `COMMAND_POLL_MS` and returns only when the
 * run is resumed or stopped, which is what makes pause feel immediate without busy-waiting on
 * the CPU.
 */
export async function handleCommands(ctx: AgentContext, state: RunControlState): Promise<void> {
  await drainCommands(ctx, state);

  while (state.paused && !state.stopRequested) {
    await new Promise((resolve) => setTimeout(resolve, COMMAND_POLL_MS));
    await drainCommands(ctx, state);
  }
}
