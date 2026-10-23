/**
 * server/agent/loop.ts — the agent loop.
 *
 * This is the one function that turns a goal into a verified deliverable. Its shape follows
 * AGENTS.md section 8 exactly:
 *
 *   contract → plan → (reason → act → recover → check drift)* → compose → verify → (repair) →
 *   report → verdict
 *
 * Three rules keep it honest, and every one of them is visible to the user as an event:
 *  - budgets are checked *before* each step, so exceeding one ends the run gracefully with a
 *    partial result rather than a crash;
 *  - the only things that can touch the outside world are the four tools in `tools.ts`;
 *  - nothing the model says is trusted: its citations are re-checked against the run's own log.
 *
 * The loop never runs in a serverless function — it is called by `worker/index.ts`, because a run
 * can last minutes and must be able to pause.
 */

import type { PrismaClient } from '@prisma/client';
import {
  AGENT_NOTES_MAX_CHARS,
  ALL_TOOL_NAMES,
  CONTRACT_CHECK,
  DEFAULT_DELIVERABLE_NAME,
  EVENT_TYPE,
  LLM_RESERVE_CALLS,
  RUN_STATUS,
  TOOL_NAME,
  VERDICT,
  type ToolName,
  type Verdict,
} from '../constants';
import type { BudgetConfig } from '../config';
import { logger } from '../logger';
import { appendEvent } from '../recorder';
import { finishRun, savePlan } from '../runs';
import { planSchema, type ContractInput, type PlanInput } from '../validation';
import {
  createContract,
  failedCriteriaText,
  verifyContract,
  type ContractVerification,
} from './contract';
import { createControlState, handleCommands, requestDriftPause, type RunControlState } from './commands';
import { createDriftMonitor } from './drift';
import { maybeEmitIncidentReport } from './incident';
import { createLlmClient, type LlmClient } from './llm';
import {
  nextActionPrompt,
  planPrompt,
  repairPrompt,
  reportPrompt,
  UNTRUSTED_CONTENT_RULE,
} from './prompts';
import { runToolWithRecovery } from './recovery';
import { shieldFetchedText } from './shield';
import { ARTIFACT_NAME_PATTERN, runTool } from './tools';
import type {
  AgentAction,
  AgentContext,
  EmitFn,
  RecoveryAttempt,
  ToolFailure,
  ToolResult,
} from './types';

const log = logger('agent');

export interface RunAgentInput {
  db: PrismaClient;
  runId: string;
  goal: string;
  budget: BudgetConfig;
}

/** One-line reasoning shown in the timeline before every action (AGENTS.md section 1). */
const THOUGHT_MAX_SENTENCES = 2;

/** The deliverable as it exists so far; `name` is null until something is written. */
interface Deliverable {
  name: string | null;
  content: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Small pure helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Validate a model-chosen action. Throwing makes `llm.json` spend its one repair attempt. */
function parseAction(value: unknown): AgentAction {
  const record = (value ?? {}) as Record<string, unknown>;
  const thought = typeof record.thought === 'string' ? record.thought.trim() : '';
  const tool = typeof record.tool === 'string' ? record.tool.trim() : '';
  const args = record.args && typeof record.args === 'object' ? (record.args as Record<string, unknown>) : {};

  if (!thought) throw new Error('action is missing "thought"');
  if (tool !== 'finish' && !ALL_TOOL_NAMES.includes(tool as ToolName)) {
    throw new Error(`action chose an unknown tool: ${tool}`);
  }
  return { thought, tool: tool as ToolName | 'finish', args };
}

/** Keep the reasoning line to the promised length even if the model rambles. */
function shortenThought(thought: string): string {
  const sentences = thought.split(/(?<=[.!?])\s+/);
  return sentences.slice(0, THOUGHT_MAX_SENTENCES).join(' ').trim() || thought.trim();
}

/**
 * Append a tool result to the research notes, dropping the oldest detail when the notes grow
 * past `AGENT_NOTES_MAX_CHARS`. The most recent evidence is what the next decision needs most.
 */
function appendNotes(notes: string, result: ToolResult): string {
  const block = `### ${result.tool}: ${result.summary}\n${result.output}`;
  const combined = notes ? `${notes}\n\n${block}` : block;
  return combined.length <= AGENT_NOTES_MAX_CHARS
    ? combined
    : combined.slice(combined.length - AGENT_NOTES_MAX_CHARS);
}

/** The file name the contract expects, or the default when it does not name one safely. */
function deliverableName(contract: ContractInput): string {
  for (const criterion of contract.criteria) {
    if (
      criterion.check === CONTRACT_CHECK.fileExists &&
      typeof criterion.arg === 'string' &&
      ARTIFACT_NAME_PATTERN.test(criterion.arg)
    ) {
      return criterion.arg;
    }
  }
  return DEFAULT_DELIVERABLE_NAME;
}

/** One sentence describing how the run ended, for the incident reporter. */
function outcomeSentence(
  verdict: Verdict,
  failures: ToolFailure[],
  recoveries: RecoveryAttempt[],
): string {
  const fault = failures.length > 0 ? `${failures.length} tool failure(s)` : 'no tool failures';
  const ladder =
    recoveries.length > 0 ? `${recoveries.length} recovery step(s) taken` : 'no recovery needed';
  return `Final verdict ${verdict}; ${fault}; ${ladder}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan
// ─────────────────────────────────────────────────────────────────────────────

/** Ask the model for the plan, emit it and persist it. Failure fails the run honestly. */
async function createPlan(
  llm: LlmClient,
  ctx: AgentContext,
  goal: string,
  contract: ContractInput,
): Promise<PlanInput> {
  const plan = await llm.json(
    [{ role: 'system', content: UNTRUSTED_CONTENT_RULE }, ...planPrompt(goal, contract)],
    (value) => planSchema.parse(value),
  );
  await ctx.emit(EVENT_TYPE.planCreated, { steps: plan.steps });
  await savePlan(ctx.db, ctx.runId, plan);
  return plan;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step execution
// ─────────────────────────────────────────────────────────────────────────────

interface StepOutcome {
  result: ToolResult | null;
  failures: ToolFailure[];
  recoveries: RecoveryAttempt[];
}

/**
 * Run one chosen action, shielding fetched text before it reaches the model.
 *
 * The shield runs here, not inside `fetch_page`, because it needs the step number for the event
 * and because fencing is a property of how text is *used*, not of how it was downloaded.
 */
async function executeAction(
  ctx: AgentContext,
  stepNo: number,
  action: AgentAction & { tool: ToolName },
): Promise<StepOutcome> {
  const outcome = await runToolWithRecovery({ ctx, stepNo, tool: action.tool, args: action.args });

  if (outcome.result?.tool === TOOL_NAME.fetchPage && outcome.result.urls[0]) {
    const fenced = await shieldFetchedText({
      ctx,
      stepNo,
      url: outcome.result.urls[0].url,
      text: outcome.result.output,
    });
    return { ...outcome, result: { ...outcome.result, output: fenced } };
  }

  return outcome;
}

/** Compose the final markdown and store it, replacing an empty deliverable. */
async function composeDeliverable(input: {
  llm: LlmClient;
  ctx: AgentContext;
  goal: string;
  contract: ContractInput;
  notes: string;
  stepNo: number;
}): Promise<Deliverable> {
  const { llm, ctx, goal, contract, notes, stepNo } = input;
  const name = deliverableName(contract);
  const markdown = await llm.text(
    reportPrompt(
      goal,
      contract.criteria.map((criterion) => criterion.text),
      notes,
    ),
  );
  const result = await runTool({
    ctx,
    stepNo,
    tool: TOOL_NAME.writeFile,
    args: { name, content: markdown },
  });
  return { name: result.artifactName ?? name, content: result.output };
}

/**
 * Run the agent for one claimed run.
 *
 * Terminal bookkeeping for `completed` and `stopped` happens here; an unexpected exception is
 * left to the caller (`worker/index.ts`) so the run is marked `failed` with a `run_failed` event.
 */
export async function runAgent(input: RunAgentInput): Promise<void> {
  const { db, runId, goal, budget } = input;

  const emit: EmitFn = async (type, payload) => {
    await appendEvent(db, runId, type, payload);
  };
  const ctx: AgentContext = {
    db,
    runId,
    emit,
    budget,
    deadline: Date.now() + budget.maxSeconds * 1_000,
  };

  await emit(EVENT_TYPE.runStarted, { goal, budget });

  const llm = createLlmClient({ runId, emit });
  const contract = await createContract({ llm, ctx, goal });
  const plan = await createPlan(llm, ctx, goal, contract);

  const state: RunControlState = createControlState();
  const drift = createDriftMonitor({ llm, ctx });
  const failures: ToolFailure[] = [];
  const recoveries: RecoveryAttempt[] = [];
  const disabledTools = new Set<ToolName>();

  let notes = '';
  let deliverable: Deliverable = { name: null, content: '' };
  let stepsTaken = 0;

  // A redirect replaces the working instruction for the rest of the run (AGENTS.md section 8).
  const currentGoal = (): string => state.instruction ?? goal;

  for (let stepNo = 1; stepNo <= budget.maxSteps; stepNo++) {
    await handleCommands(ctx, state);
    if (state.stopRequested) break;

    // Budgets are checked before spending anything, so the run always has room to finish cleanly.
    if (Date.now() >= ctx.deadline) break;
    if (llm.calls > budget.maxLlmCalls - LLM_RESERVE_CALLS) break;

    const title = plan.steps.find((step) => step.step_no === stepNo)?.title ?? `Step ${stepNo}`;
    await emit(EVENT_TYPE.stepStarted, { step_no: stepNo, title });

    let action: AgentAction;
    try {
      action = await llm.json(
        [
          { role: 'system', content: UNTRUSTED_CONTENT_RULE },
          ...nextActionPrompt({
            goal: currentGoal(),
            criteria: contract.criteria.map((criterion) => criterion.text),
            notes,
            stepNo,
            instruction: state.instruction ?? undefined,
          }),
        ],
        parseAction,
      );
    } catch (error) {
      log.warn('could not obtain a next action; finishing with what we have', {
        runId,
        message: (error as Error).message,
      });
      break;
    }

    const thought = shortenThought(action.thought);
    await emit(EVENT_TYPE.reasoning, { step_no: stepNo, thought });

    if (action.tool === 'finish') break;
    stepsTaken = stepNo;

    if (disabledTools.has(action.tool)) continue;

    const outcome = await executeAction(ctx, stepNo, { ...action, tool: action.tool });
    failures.push(...outcome.failures);
    recoveries.push(...outcome.recoveries);

    if (!outcome.result) {
      // Ladder exhausted: the tool is out of play for the rest of the run (rung 3 already logged).
      disabledTools.add(action.tool);
      continue;
    }

    notes = appendNotes(notes, outcome.result);
    if (outcome.result.artifactName) {
      deliverable = { name: outcome.result.artifactName, content: outcome.result.output };
    }

    const assessment = await drift.assess({ stepNo, goal: currentGoal(), thought });
    if (assessment.autoPause) {
      requestDriftPause(state);
      await emit(EVENT_TYPE.paused, { reason: 'drift' });
      await handleCommands(ctx, state);
      if (state.stopRequested) break;
    }
  }

  if (state.stopRequested) {
    await finishRun(db, runId, { status: RUN_STATUS.stopped, verdict: null });
    return;
  }

  // ── Compose ────────────────────────────────────────────────────────────────
  const finalStepNo = stepsTaken + 1;
  if (!deliverable.name || !deliverable.content) {
    try {
      deliverable = await composeDeliverable({
        llm,
        ctx,
        goal: currentGoal(),
        contract,
        notes,
        stepNo: finalStepNo,
      });
    } catch (error) {
      log.warn('could not compose a deliverable; verifying an empty result', {
        runId,
        message: (error as Error).message,
      });
    }
  }

  // ── Verify, then one repair pass if budget remains ─────────────────────────
  let verification: ContractVerification = await verifyContract({
    llm,
    ctx,
    contract,
    artifact: deliverable,
  });

  const budgetLeft = llm.calls < budget.maxLlmCalls && Date.now() < ctx.deadline;
  if (verification.verdict !== VERDICT.verified && budgetLeft && deliverable.content) {
    try {
      const repaired = await llm.text(
        repairPrompt(
          currentGoal(),
          failedCriteriaText(verification.criteria, contract),
          deliverable.content,
        ),
      );
      const name = deliverableName(contract);
      const result = await runTool({
        ctx,
        stepNo: finalStepNo,
        tool: TOOL_NAME.writeFile,
        args: { name, content: repaired },
      });
      deliverable = { name: result.artifactName ?? name, content: result.output };
      verification = await verifyContract({ llm, ctx, contract, artifact: deliverable });
    } catch (error) {
      log.warn('repair pass failed; keeping the first verdict', {
        runId,
        message: (error as Error).message,
      });
    }
  }

  // ── Incident report (only when something actually failed) ──────────────────
  if (llm.calls < budget.maxLlmCalls) {
    try {
      await maybeEmitIncidentReport({
        llm,
        ctx,
        goal: currentGoal(),
        failures,
        recoveries,
        outcome: outcomeSentence(verification.verdict, failures, recoveries),
      });
    } catch (error) {
      log.warn('incident report could not be composed', {
        runId,
        message: (error as Error).message,
      });
    }
  }

  await emit(EVENT_TYPE.runCompleted, {
    verdict: verification.verdict,
    artifact: deliverable.name,
    criteria_passed: verification.criteria.filter((criterion) => criterion.pass).length,
    criteria_total: verification.criteria.length,
  });
  await finishRun(db, runId, {
    status: RUN_STATUS.completed,
    verdict: verification.verdict,
    resultPath: deliverable.name,
  });
}
