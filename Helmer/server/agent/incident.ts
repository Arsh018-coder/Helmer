/**
 * server/agent/incident.ts — the incident report.
 *
 * A Helmer run is judged as much on how it behaves when something breaks as on its answer, so a
 * run that hit a failure ends with a short, honest report: what broke, why it probably broke,
 * what the agent did, how it ended, and what would make it better (AGENTS.md section 8).
 *
 * It is only written when there is something to report. A clean run must not produce an incident
 * report — an empty report would make the whole feature look decorative.
 */

import { EVENT_TYPE } from '../constants';
import type { AgentContext, RecoveryAttempt, ToolFailure } from './types';
import type { LlmClient } from './llm';
import { incidentPrompt } from './prompts';

export interface IncidentReportInput {
  llm: LlmClient;
  ctx: AgentContext;
  goal: string;
  failures: ToolFailure[];
  recoveries: RecoveryAttempt[];
  /** How the run ended, in one sentence, from the loop's point of view. */
  outcome: string;
}

/**
 * Emit an `incident_report` event, but only when a tool failed or the ladder was used.
 *
 * @returns the markdown report, or null when nothing happened worth reporting. A failure to
 *          compose the report must never fail the run, so the caller treats null as "skip".
 */
export async function maybeEmitIncidentReport(input: IncidentReportInput): Promise<string | null> {
  const { llm, ctx, goal, failures, recoveries, outcome } = input;

  if (failures.length === 0 && recoveries.length === 0) return null;

  const markdown = await llm.text(
    incidentPrompt({ goal, failures, recoveries, outcome }),
  );

  await ctx.emit(EVENT_TYPE.incidentReport, { markdown });
  return markdown;
}
