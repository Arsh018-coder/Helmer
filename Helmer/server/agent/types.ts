/**
 * server/agent/types.ts — the small vocabulary the agent modules share.
 *
 * Kept separate from the modules themselves so `tools.ts`, `contract.ts`, `drift.ts` and
 * `loop.ts` can all depend on it without importing each other (no cycles, no `any`).
 */

import type { PrismaClient } from '@prisma/client';
import type { EventType, ToolName } from '../constants';
import type { BudgetConfig } from '../config';

/**
 * Write one event to the run's hash chain.
 * Thin wrapper around `appendEvent` so callers never touch the recorder directly.
 */
export type EmitFn = (type: EventType, payload: Record<string, unknown>) => Promise<void>;

/** Everything a tool or a prompt needs about the run it is serving. */
export interface AgentContext {
  db: PrismaClient;
  runId: string;
  emit: EmitFn;
  budget: BudgetConfig;
  /** Wall-clock ms after which the run must stop gracefully. */
  deadline: number;
}

/** A search hit as the UI and the contract verifier see it. */
export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

/** Result of a successful tool execution. */
export interface ToolResult {
  tool: ToolName;
  /** Human-readable one-liner shown in the timeline. */
  summary: string;
  /** Full output, already truncated to TOOL_OUTPUT_MAX_CHARS. */
  output: string;
  /** How long the tool took in milliseconds, measured on the real clock. */
  ms: number;
  /** URLs this call produced, used to prove citations are real. */
  urls: SearchHit[];
  /** Set by `write_file` so the loop can record the deliverable name. */
  artifactName?: string;
}

/** The action the model chose for the next step. */
export interface AgentAction {
  thought: string;
  tool: ToolName | 'finish';
  args: Record<string, unknown>;
}

/** One entry of the recovery ladder's audit trail. */
export interface RecoveryAttempt {
  step_no: number;
  rung: number;
  action: string;
  outcome: string;
}

/** A tool failure worth reporting, whether injected or real. */
export interface ToolFailure {
  step_no: number;
  tool: string;
  error: string;
  injected: boolean;
}
