/**
 * server/agent/drift.ts — the drift guard.
 *
 * After each step the agent asks itself one question in plain language: "am I still working on
 * the goal?" The numeric answer is shown in the UI as a meter, and it is labelled
 * *self-assessed* because it is the model's own estimate, not a measurement (AGENTS.md
 * section 1, differentiator 3).
 *
 * The policy is deliberately simple and visible: a score below `DRIFT_WARN_THRESHOLD` is a
 * warning, and `DRIFT_PAUSE_STREAK` of them in a row pauses the run and asks the human. A guard
 * the user cannot see is no guard at all, which is why every assessment is an event.
 */

import { DRIFT_INITIAL_SCORE, DRIFT_PAUSE_STREAK, DRIFT_WARN_THRESHOLD, EVENT_TYPE } from '../constants';
import { logger } from '../logger';
import type { AgentContext } from './types';
import type { LlmClient } from './llm';
import { UNTRUSTED_CONTENT_RULE } from './prompts';

const log = logger('drift');

/** The section of the run a drift check was asked about. */
export interface DriftCheckInput {
  stepNo: number;
  goal: string;
  /** The step's one-line reasoning, so the model judges the action it just took. */
  thought: string;
}

export interface DriftAssessment {
  score: number;
  reason: string;
  /** True when the policy wants the run paused for the human (two low scores in a row). */
  autoPause: boolean;
}

export interface DriftMonitor {
  /** Most recent score; starts at `DRIFT_INITIAL_SCORE` so the meter never renders as NaN. */
  readonly score: number;
  /** Consecutive assessments below the warning threshold. */
  readonly lowStreak: number;
  /** Score one step, emit `drift_check`, and apply the pause policy. */
  assess(input: DriftCheckInput): Promise<DriftAssessment>;
}

interface DriftAnswer {
  score?: number;
  reason?: string;
}

/** Clamp a model answer into the 0–100 the meter expects, whatever it sent. */
function clampScore(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return DRIFT_WARN_THRESHOLD;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

/**
 * Create a monitor bound to one run.
 *
 * Bound because the streak is per-run: a low score from an unrelated run must never tip this
 * one into a pause.
 */
export function createDriftMonitor(input: { llm: LlmClient; ctx: AgentContext }): DriftMonitor {
  const { llm, ctx } = input;
  let score = DRIFT_INITIAL_SCORE;
  let lowStreak = 0;

  return {
    get score() {
      return score;
    },
    get lowStreak() {
      return lowStreak;
    },

    async assess(check: DriftCheckInput): Promise<DriftAssessment> {
      const answer = await llm.json<DriftAnswer>(
        [
          { role: 'system', content: UNTRUSTED_CONTENT_RULE },
          {
            role: 'user',
            content: [
              'Score how much the work still serves the goal, from 0 to 100.',
              '100 means the last action clearly advanced the goal; 0 means it drifted away.',
              `Goal: ${check.goal}`,
              `Last action's reasoning: ${check.thought}`,
              'Reply with JSON only: {"score": <0-100>, "reason": "<one short sentence>"}.',
            ].join('\n'),
          },
        ],
        (value) => value as DriftAnswer,
      );

      score = clampScore(answer.score);
      lowStreak = score < DRIFT_WARN_THRESHOLD ? lowStreak + 1 : 0;

      const reason = (answer.reason ?? '').trim() || 'No reason given.';
      const autoPause = lowStreak >= DRIFT_PAUSE_STREAK;

      await ctx.emit(EVENT_TYPE.driftCheck, {
        step_no: check.stepNo,
        score,
        reason,
        self_assessed: true,
      });

      if (autoPause) {
        log.warn('drift policy wants a pause', { runId: ctx.runId, score, lowStreak });
      }

      return { score, reason, autoPause };
    },
  };
}
