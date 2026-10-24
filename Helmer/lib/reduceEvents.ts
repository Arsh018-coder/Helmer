/**
 * lib/reduceEvents.ts — the one place events become what the user sees.
 *
 * The UI is a pure function of the run's event list (AGENTS.md section 7): the live view, the
 * phone Steer view and the replay all render the same `AgentRun`, so a screen can never disagree
 * with the log it is showing. This module is deliberately pure — it parses the stored payload
 * text and touches no network, clock or database — which is also what makes `Replay` possible:
 * replaying is just calling this function with `events.slice(0, n)`.
 *
 * Event type strings come from `server/constants.ts` rather than being retyped here. That file has
 * no imports and no Node APIs, so it is safe in the browser bundle, and it keeps the emitters and
 * this reader from drifting apart.
 */

import { EVENT_TYPE, TOOL_NAME } from '../server/constants';
import type { AgentRun, Criterion, PlanStep, RunStep } from './types';

/** The minimal event shape the reducer needs; both the polling response and a bundle satisfy it. */
export interface ReducerEvent {
  seq: number;
  ts: number;
  type: string;
  /** The exact stored payload text (`events.payload`), never a re-serialised object. */
  payload: string;
}

export interface ReduceOptions {
  /** Authoritative lifecycle status from the API; events alone cannot tell `queued` from `running`. */
  status?: string;
  /** Verdict persisted on the run row, used until a `run_completed` event overrides it. */
  verdict?: string | null;
  /** Wall clock for the time budget of a run that has not finished. Defaults to `Date.now()`. */
  now?: number;
}

type ViewStatus = AgentRun['status'];
type ViewVerdict = AgentRun['verdict'];

/** Budget maxima used only until `run_started` supplies the run's real ones. */
const FALLBACK_BUDGET = { maxSteps: 8, maxSeconds: 180, maxLlmCalls: 25 } as const;

/** The meter must render a number before the first check, so it starts at 100 (drift.ts does the same). */
const DRIFT_INITIAL_SCORE = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Payload reading
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a payload without ever throwing: an unreadable event simply contributes nothing. */
function parsePayload(text: string): Record<string, unknown> {
  try {
    const value = JSON.parse(text) as unknown;
    return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers (pure, so a replay of an old run formats identically)
// ─────────────────────────────────────────────────────────────────────────────

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * `created_at` shown in the UI, as `YYYY-MM-DD HH:MM UTC`.
 *
 * Exported because the run list in `components/AppShell.tsx` formats its rows the same way, and
 * two date formats in one product is the kind of detail that makes a screen look assembled
 * rather than designed.
 */
export function formatUtc(ms: number): string {
  const date = new Date(ms);
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`
  );
}

/** Seconds with one decimal, e.g. `48.2s`. */
export function formatDuration(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal accumulators
// ─────────────────────────────────────────────────────────────────────────────

interface StepAccumulator {
  step_no: number;
  title: string;
  tool: string;
  ms: number;
  reasoning: string;
  injected: boolean;
  verified: boolean;
  injection?: { url: string; snippet: string };
  /** The tool's input plus whatever it returned, rendered as the expanded-card payload. */
  payload: Record<string, unknown>;
}

function emptyAccumulator(stepNo: number): StepAccumulator {
  return {
    step_no: stepNo,
    title: `Step ${stepNo}`,
    tool: '',
    ms: 0,
    reasoning: '',
    injected: false,
    verified: false,
    payload: {},
  };
}

/** Map the DB lifecycle status onto the four states the UI renders. */
function toViewStatus(raw: string | undefined, fallback: ViewStatus): ViewStatus {
  switch (raw) {
    case 'running':
    case 'queued':
      return 'running';
    case 'paused':
      return 'paused';
    case 'completed':
      return 'completed';
    case 'stopped':
      return 'stopped';
    case 'failed':
      return 'failed';
    default:
      return fallback;
  }
}

function toViewVerdict(raw: string | null | undefined, fallback: ViewVerdict): ViewVerdict {
  return raw === 'verified' || raw === 'partially_verified' || raw === 'unverified' ? raw : fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fold a run's events into the single view model the UI renders.
 *
 * @param runId the run's id (events carry it too, but not in an exported bundle).
 * @param events every event of the run, in any order — they are sorted by `seq` here.
 * @returns an `AgentRun`; the run view, phone view and replay all render this same object.
 */
export function reduceEvents(
  runId: string,
  events: readonly ReducerEvent[],
  options: ReduceOptions = {},
): AgentRun {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);

  let goal = '';
  let maxSteps: number = FALLBACK_BUDGET.maxSteps;
  let maxSeconds: number = FALLBACK_BUDGET.maxSeconds;
  let maxLlmCalls: number = FALLBACK_BUDGET.maxLlmCalls;

  const steps = new Map<number, StepAccumulator>();
  const executedSteps = new Set<number>();
  let criteria: Criterion[] = [];
  let plan: PlanStep[] = [];

  let driftScore = DRIFT_INITIAL_SCORE;
  let llmCalls = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let recoveries = 0;
  let artifactContent: string | undefined;
  let preRedirectArtifact: string | undefined;
  let redirectInstruction: string | undefined;
  let incidentReport: string | undefined;
  let tokens: AgentRun['tokens'];

  let startedAt: number | null = null;
  let finishedAt: number | null = null;
  let totalPausedMs = 0;
  let lastPausedAt: number | null = null;
  let derivedStatus: ViewStatus = 'running';
  let verdict: ViewVerdict = toViewVerdict(options.verdict, 'unverified');

  for (const event of ordered) {
    const payload = parsePayload(event.payload);
    if (startedAt === null) startedAt = event.ts;

    switch (event.type) {
      case EVENT_TYPE.runStarted: {
        goal = str(payload.goal, goal);
        const budget = (payload.budget ?? {}) as Record<string, unknown>;
        maxSteps = num(budget.maxSteps, maxSteps);
        maxSeconds = num(budget.maxSeconds, maxSeconds);
        maxLlmCalls = num(budget.maxLlmCalls, maxLlmCalls);
        break;
      }

      case EVENT_TYPE.contractCreated: {
        const raw = Array.isArray(payload.criteria) ? payload.criteria : [];
        criteria = raw.map((entry) => {
          const item = entry as Record<string, unknown>;
          const criterion: Criterion = {
            id: str(item.id),
            text: str(item.text),
            check: (str(item.check) || 'llm') as Criterion['check'],
            status: 'pending',
          };
          if (item.arg !== undefined && item.arg !== null) criterion.arg = item.arg;
          return criterion;
        });
        break;
      }

      case EVENT_TYPE.planCreated: {
        const raw = Array.isArray(payload.steps) ? payload.steps : [];
        plan = raw.map((entry) => {
          const item = entry as Record<string, unknown>;
          return {
            step_no: num(item.step_no),
            title: str(item.title),
            tool: str(item.tool),
            status: 'pending',
          } satisfies PlanStep;
        });
        break;
      }

      case EVENT_TYPE.stepStarted: {
        const stepNo = num(payload.step_no);
        const step = steps.get(stepNo) ?? emptyAccumulator(stepNo);
        step.title = str(payload.title, step.title);
        steps.set(stepNo, step);
        for (const planStep of plan) {
          if (planStep.step_no === stepNo) planStep.status = 'running';
        }
        break;
      }

      case EVENT_TYPE.reasoning: {
        const stepNo = num(payload.step_no);
        const step = steps.get(stepNo) ?? emptyAccumulator(stepNo);
        step.reasoning = str(payload.thought, step.reasoning);
        steps.set(stepNo, step);
        break;
      }

      case EVENT_TYPE.toolCall: {
        const stepNo = num(payload.step_no);
        const step = steps.get(stepNo) ?? emptyAccumulator(stepNo);
        step.tool = str(payload.tool, step.tool);
        const args = (payload.args ?? {}) as Record<string, unknown>;
        step.payload = { ...args };
        steps.set(stepNo, step);
        executedSteps.add(stepNo);
        break;
      }

      case EVENT_TYPE.toolResult: {
        const stepNo = num(payload.step_no);
        const step = steps.get(stepNo) ?? emptyAccumulator(stepNo);
        step.tool = str(payload.tool, step.tool);
        step.ms = num(payload.ms, step.ms);
        if (payload.injected === true) step.injected = true;
        if (step.tool === TOOL_NAME.writeFile) step.verified = true;

        step.payload = {
          ...step.payload,
          result: {
            summary: str(payload.summary),
            ms: step.ms,
            urls: Array.isArray(payload.urls) ? payload.urls : [],
            output: str(payload.output),
          },
        };
        steps.set(stepNo, step);

        // The deliverable's body is the only output the result panel renders verbatim.
        if (step.tool === TOOL_NAME.writeFile && typeof payload.output === 'string') {
          artifactContent = payload.output;
        }
        for (const planStep of plan) {
          if (planStep.step_no === stepNo) planStep.status = 'completed';
        }
        break;
      }

      case EVENT_TYPE.toolError: {
        const stepNo = num(payload.step_no);
        const step = steps.get(stepNo) ?? emptyAccumulator(stepNo);
        step.tool = str(payload.tool, step.tool);
        if (payload.injected === true) step.injected = true;
        step.payload = { ...step.payload, error: str(payload.error) };
        steps.set(stepNo, step);
        break;
      }

      case EVENT_TYPE.recovery: {
        const stepNo = num(payload.step_no);
        const step = steps.get(stepNo) ?? emptyAccumulator(stepNo);
        recoveries += 1;

        // Keep every rung so the expanded card shows the ladder that actually ran.
        const history = Array.isArray(step.payload.recovery) ? step.payload.recovery : [];
        step.payload = {
          ...step.payload,
          recovery: [
            ...history,
            {
              rung: num(payload.rung),
              action: str(payload.action),
              outcome: str(payload.outcome),
            },
          ],
        };
        steps.set(stepNo, step);
        break;
      }

      case EVENT_TYPE.llmUsage: {
        llmCalls = num(payload.calls, llmCalls);
        tokensIn = num(payload.tokens_in, tokensIn);
        tokensOut = num(payload.tokens_out, tokensOut);
        tokens = { input: tokensIn, output: tokensOut, total: tokensIn + tokensOut };
        break;
      }

      case EVENT_TYPE.driftCheck: {
        driftScore = num(payload.score, driftScore);
        break;
      }

      case EVENT_TYPE.injectionFlagged: {
        const stepNo = num(payload.step_no);
        const step = steps.get(stepNo) ?? emptyAccumulator(stepNo);
        step.injection = { url: str(payload.url), snippet: str(payload.snippet) };
        steps.set(stepNo, step);
        break;
      }

      case EVENT_TYPE.verifyResult: {
        const raw = Array.isArray(payload.criteria) ? payload.criteria : [];
        const byId = new Map(criteria.map((criterion) => [criterion.id, criterion]));
        for (const entry of raw) {
          const item = entry as Record<string, unknown>;
          const id = str(item.id);
          const target = byId.get(id);
          if (!target) continue;
          target.status = item.pass === true ? 'pass' : 'fail';
          target.evidence = str(item.evidence, target.evidence ?? '');
        }
        break;
      }

      case EVENT_TYPE.artifactWritten:
        // The row exists now; its body already arrived with the `tool_result` above.
        break;

      case EVENT_TYPE.incidentReport: {
        incidentReport = str(payload.markdown, incidentReport ?? '');
        break;
      }

      case EVENT_TYPE.paused:
        derivedStatus = 'paused';
        lastPausedAt = event.ts;
        break;

      case EVENT_TYPE.resumed:
        derivedStatus = 'running';
        if (lastPausedAt !== null) {
          totalPausedMs += Math.max(0, event.ts - lastPausedAt);
          lastPausedAt = null;
        }
        break;

      case EVENT_TYPE.stopped:
        derivedStatus = 'stopped';
        finishedAt = event.ts;
        break;

      case EVENT_TYPE.runCompleted: {
        verdict = toViewVerdict(str(payload.verdict, ''), verdict);
        derivedStatus = 'completed';
        finishedAt = event.ts;
        break;
      }

      case EVENT_TYPE.runFailed:
        derivedStatus = 'failed';
        finishedAt = event.ts;
        break;

      case EVENT_TYPE.commandReceived: {
        const kind = str(payload.kind);
        if (kind === 'pause') {
          derivedStatus = 'paused';
          lastPausedAt = event.ts;
        } else if (kind === 'resume') {
          derivedStatus = 'running';
          if (lastPausedAt !== null) {
            totalPausedMs += Math.max(0, event.ts - lastPausedAt);
            lastPausedAt = null;
          }
        } else if (kind === 'stop') {
          derivedStatus = 'stopped';
          finishedAt = event.ts;
        }
        break;
      }

      case EVENT_TYPE.redirected: {
        const newInstruction = str(payload.new_instruction);
        if (newInstruction) {
          redirectInstruction = newInstruction;
          // If a complete deliverable already existed prior to this redirect, save it as pre-steering version
          if (artifactContent && artifactContent.trim().length > 30 && !preRedirectArtifact) {
            preRedirectArtifact = artifactContent;
          }

          // Check if an identical redirect step already exists in accumulator to prevent duplicate cards
          const isDuplicate = Array.from(steps.values()).some((s) => {
            if (s.tool !== 'human::redirect') return false;
            const existingInst = String((s.payload as any)?.instruction || s.reasoning || '').trim().toLowerCase();
            return existingInst === newInstruction.trim().toLowerCase() || existingInst.includes(newInstruction.trim().toLowerCase());
          });

          if (!isDuplicate) {
            const redirectStepNo = 900 + steps.size;
            const redirectStep = emptyAccumulator(redirectStepNo);
            redirectStep.title = `Human Steering Directive`;
            redirectStep.tool = 'human::redirect';
            redirectStep.ms = 12;
            redirectStep.reasoning = `Live operator redirected run: "${newInstruction}"`;
            redirectStep.payload = {
              instruction: newInstruction,
              source: str(payload.source, 'Live Operator'),
              timestamp: new Date(event.ts).toISOString(),
            };
            steps.set(redirectStepNo, redirectStep);
          }

          // Adapt wordRange criteria dynamically
          const wordMatch = newInstruction.match(
            /(?:reduce|cut|shrink|limit|to|around|about|under|approx(?:imately)?|between)?\s*(\d+)(?:\s*(?:to|-)\s*(\d+))?\s*words?/i,
          );
          if (wordMatch) {
            const num1 = parseInt(wordMatch[1], 10);
            const num2 = wordMatch[2] ? parseInt(wordMatch[2], 10) : null;
            let min: number;
            let max: number;
            if (num2) {
              min = Math.min(num1, num2);
              max = Math.max(num1, num2);
            } else if (num1 <= 15) {
              min = Math.max(1, num1 - 3);
              max = num1 + 4;
            } else if (num1 <= 50) {
              min = Math.max(5, Math.round(num1 * 0.7));
              max = Math.round(num1 * 1.3);
            } else {
              min = Math.max(20, Math.round(num1 * 0.75));
              max = Math.round(num1 * 1.25);
            }
            criteria = criteria.map((c) => {
              if (c.check === 'word_range') {
                return {
                  ...c,
                  arg: [min, max],
                  text: `Deliverable formatted with ${min} to ${max} words (steered: ${newInstruction}).`,
                };
              }
              return c;
            });
          }
        }
        break;
      }

      default:
        // llm_retry describes internal attempts, not deliverable
        break;
    }
  }

  const now = options.now ?? Date.now();
  const start = startedAt ?? now;
  const isCurrentlyPaused = options.status === 'paused' || derivedStatus === 'paused';
  const ongoingPauseMs = isCurrentlyPaused && lastPausedAt !== null ? Math.max(0, now - lastPausedAt) : 0;
  const netPausedMs = totalPausedMs + ongoingPauseMs;
  const end = finishedAt ?? now;
  const activeWorkingMs = Math.max(0, end - start - netPausedMs);
  const elapsedSec = Math.min(maxSeconds, Math.max(0, Math.round(activeWorkingMs / 1000)));

  const runSteps: RunStep[] = [...steps.values()]
    .sort((a, b) => a.step_no - b.step_no)
    .map((step) => {
      const result: RunStep = {
        step_no: step.step_no,
        title: step.title,
        tool: step.tool,
        duration_ms: step.ms,
        status: step.injected ? 'injected' : step.verified ? 'verified' : 'passed',
        reasoning: step.reasoning,
        payload: JSON.stringify(step.payload, null, 2),
      };
      if (step.injection) result.injection = step.injection;
      return result;
    });

  // A plan step whose execution was fault-injected shows it in the contract panel too.
  for (const planStep of plan) {
    const executed = runSteps.find((step) => step.step_no === planStep.step_no);
    if (executed?.status === 'injected') planStep.status = 'injected';
  }

  const run: AgentRun = {
    id: runId,
    goal,
    status: toViewStatus(options.status, derivedStatus),
    verdict,
    driftScore,
    stepsBudget: { current: executedSteps.size, max: maxSteps },
    timeBudget: { current: elapsedSec, max: maxSeconds },
    llmBudget: { current: llmCalls, max: maxLlmCalls },
    criteria,
    plan,
    steps: runSteps,
    created_at: formatUtc(start),
    duration: formatDuration(Math.min(maxSeconds * 1000, activeWorkingMs)),
  };

  if (artifactContent) run.artifactContent = artifactContent;
  if (preRedirectArtifact) run.preRedirectArtifact = preRedirectArtifact;
  if (redirectInstruction) run.redirectInstruction = redirectInstruction;
  if (incidentReport) run.incidentReport = incidentReport;
  if (tokens) run.tokens = tokens;
  if (recoveries > 0) run.recoveries = recoveries;

  return run;
}
