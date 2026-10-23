/**
 * server/agent/recovery.ts — the three-rung recovery ladder.
 *
 * A tool that fails is the normal case, not the exception: free API keys rate-limit, pages
 * time out, hosts go away mid-demo. Helmer answers that with a visible, bounded ladder rather
 * than a retry loop (AGENTS.md section 8):
 *
 *   1. retry the same call once after a short backoff;
 *   2. switch to the fallback tool (`search_web` ⇄ `search_wikipedia`);
 *   3. give up on the tool and replan the remaining steps without it.
 *
 * Every rung writes a `recovery` event, so "attempt n of 3" on screen is a log entry and not a
 * claim. When all three fail the caller stops cleanly with a partial result — the ladder never
 * loops forever.
 */

import { RECOVERY_RETRY_BACKOFF_MS, TOOL_FALLBACK, EVENT_TYPE, type ToolName } from '../constants';
import { ChaosInjectedError, runTool } from './tools';
import type { AgentContext, RecoveryAttempt, ToolFailure, ToolResult } from './types';

export interface RecoveryOutcome {
  /** The first successful result, or null when every rung failed. */
  result: ToolResult | null;
  failures: ToolFailure[];
  recoveries: RecoveryAttempt[];
  /** True when the ladder was exhausted; the loop must replan without this tool. */
  exhausted: boolean;
}

export interface ToolAttempt {
  ctx: AgentContext;
  stepNo: number;
  tool: ToolName;
  args: Record<string, unknown>;
}

/** Record a failure in the shape the incident reporter and the events expect. */
function toFailure(attempt: ToolAttempt, error: unknown): ToolFailure {
  return {
    step_no: attempt.stepNo,
    tool: attempt.tool,
    error: error instanceof Error ? error.message : String(error),
    injected: error instanceof ChaosInjectedError,
  };
}

/** Emit one rung of the ladder. Centralised so the payload shape cannot drift between rungs. */
async function recordRung(
  ctx: AgentContext,
  attempt: ToolAttempt,
  rung: number,
  action: string,
  outcome: string,
): Promise<RecoveryAttempt> {
  await ctx.emit(EVENT_TYPE.recovery, {
    step_no: attempt.stepNo,
    rung,
    action,
    outcome,
  });
  return { step_no: attempt.stepNo, rung, action, outcome };
}

/** The query arg is the only one worth carrying to the fallback search tool. */
function fallbackArgs(attempt: ToolAttempt): Record<string, unknown> {
  const query = attempt.args.query ?? attempt.args.q;
  return query === undefined ? {} : { query };
}

/**
 * Run one tool call through the ladder.
 *
 * @returns the result when a rung succeeded, plus the full audit trail of failures and rungs.
 */
export async function runToolWithRecovery(attempt: ToolAttempt): Promise<RecoveryOutcome> {
  const { ctx } = attempt;
  const failures: ToolFailure[] = [];
  const recoveries: RecoveryAttempt[] = [];

  // ── Rung 1: retry the same call once ──────────────────────────────────────
  try {
    return { result: await runTool(attempt), failures, recoveries, exhausted: false };
  } catch (error) {
    failures.push(toFailure(attempt, error));
  }

  await new Promise((resolve) => setTimeout(resolve, RECOVERY_RETRY_BACKOFF_MS));

  try {
    const result = await runTool(attempt);
    recoveries.push(await recordRung(ctx, attempt, 1, `retry ${attempt.tool}`, 'succeeded on retry'));
    return { result, failures, recoveries, exhausted: false };
  } catch (error) {
    failures.push(toFailure(attempt, error));
  }

  // ── Rung 2: fallback tool ─────────────────────────────────────────────────
  const fallback = TOOL_FALLBACK[attempt.tool];
  if (!fallback) {
    recoveries.push(
      await recordRung(ctx, attempt, 2, 'switch tool', `no fallback tool for ${attempt.tool}`),
    );
    return { result: null, failures, recoveries, exhausted: true };
  }

  const fallbackAttempt: ToolAttempt = {
    ctx,
    stepNo: attempt.stepNo,
    tool: fallback,
    args: fallbackArgs(attempt),
  };

  try {
    const result = await runTool(fallbackAttempt);
    recoveries.push(
      await recordRung(ctx, attempt, 2, `fall back to ${fallback}`, `${fallback} returned results`),
    );
    return { result, failures, recoveries, exhausted: false };
  } catch (error) {
    failures.push(toFailure(fallbackAttempt, error));
  }

  // ── Rung 3: replan without the tool ───────────────────────────────────────
  recoveries.push(
    await recordRung(ctx, attempt, 3, `replan without ${attempt.tool}`, 'remaining steps replanned'),
  );
  return { result: null, failures, recoveries, exhausted: true };
}
