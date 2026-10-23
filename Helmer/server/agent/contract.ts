/**
 * server/agent/contract.ts — what "done" means, and the proof that it was reached.
 *
 * The contract is written **before** the agent acts, and it is the reason a Helmer run can be
 * trusted more than a chat answer: every criterion is checked at the end and each one carries
 * evidence (AGENTS.md section 1).
 *
 * Most checks are code, not model judgement. `min_urls` is the important one: it counts URLs
 * that appear in the deliverable *and* in this run's own `tool_result` events, so a model that
 * invents a citation fails the check rather than passing it. Only `llm` criteria are graded by
 * the model, they are capped, and they are labelled as model-judged in the UI.
 */

import { EVENT_TYPE, CONTRACT_CHECK, MAX_LLM_CRITERIA, VERDICT, type Verdict } from '../constants';
import { contractSchema, type ContractInput, type CriterionInput } from '../validation';
import { saveContract } from '../runs';
import type { AgentContext, SearchHit } from './types';
import type { LlmClient } from './llm';
import { contractPrompt, UNTRUSTED_CONTENT_RULE } from './prompts';

/** One criterion's outcome, exactly as the `verify_result` event carries it. */
export interface CriterionResult {
  id: string;
  pass: boolean;
  evidence: string;
  /** True when a model graded this, false when code did. The UI shows them differently. */
  model_judged: boolean;
}

export interface ContractVerification {
  criteria: CriterionResult[];
  verdict: Verdict;
}

// ─────────────────────────────────────────────────────────────────────────────
// Creation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Keep at most `MAX_LLM_CRITERIA` model-judged criteria.
 *
 * A contract graded mostly by the same model that wrote the answer is not much of a check, so
 * any extra `llm` criteria are dropped rather than quietly counted.
 */
function capLlmCriteria(criteria: CriterionInput[]): CriterionInput[] {
  let seen = 0;
  return criteria.filter((criterion) => {
    if (criterion.check !== CONTRACT_CHECK.llm) return true;
    seen += 1;
    return seen <= MAX_LLM_CRITERIA;
  });
}

/**
 * Ask the model for an intent contract and persist it.
 *
 * @throws AppError 502 `llm_error` when the model will not produce a valid contract.
 */
export async function createContract(input: {
  llm: LlmClient;
  ctx: AgentContext;
  goal: string;
}): Promise<ContractInput> {
  const { llm, ctx, goal } = input;

  const parsed = await llm.json([{ role: 'system', content: UNTRUSTED_CONTENT_RULE }, ...contractPrompt(goal)], (value) =>
    contractSchema.parse(value),
  );

  const contract: ContractInput = { criteria: capLlmCriteria(parsed.criteria) };

  await ctx.emit(EVENT_TYPE.contractCreated, { criteria: contract.criteria });
  await saveContract(ctx.db, ctx.runId, contract);

  return contract;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic checks
// ─────────────────────────────────────────────────────────────────────────────

/** Count words the way a reader would; whitespace runs are one separator. */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Strip the punctuation that clings to a URL copied into prose, so two forms compare equal. */
function normalizeUrl(raw: string): string {
  return raw.replace(/[.,;:)\]}'"]+$/, '').replace(/\/$/, '').toLowerCase();
}

/**
 * Every URL this run actually retrieved, read back from its own `tool_result` events.
 *
 * Reading the log rather than trusting the loop's memory is the point: the log is the same
 * artefact the user can verify, so a "citation" is real only if the run really fetched it.
 */
async function collectRetrievedUrls(ctx: AgentContext): Promise<Set<string>> {
  const rows = await ctx.db.event.findMany({
    where: { runId: ctx.runId, type: EVENT_TYPE.toolResult },
    select: { payload: true },
  });

  const urls = new Set<string>();
  for (const row of rows) {
    try {
      const payload = JSON.parse(row.payload) as { urls?: SearchHit[] };
      for (const hit of payload.urls ?? []) urls.add(normalizeUrl(hit.url));
    } catch {
      // A payload we cannot parse simply contributes no URLs; the check stays strict.
    }
  }
  return urls;
}

/** URLs the deliverable claims as sources, in the order they appear. */
function citedUrls(artifact: string): string[] {
  const matches = artifact.match(/https?:\/\/[^\s)"'<>]+/g) ?? [];
  return [...new Set(matches.map(normalizeUrl))];
}

// ─────────────────────────────────────────────────────────────────────────────
// Model-judged check
// ─────────────────────────────────────────────────────────────────────────────

interface JudgeAnswer {
  pass?: boolean;
  evidence?: string;
}

/** Longest quote the judge may give as evidence; keeps the event payload small and readable. */
const EVIDENCE_MAX_WORDS = 20;

/**
 * Grade one qualitative criterion.
 *
 * The judge must quote the deliverable, so its verdict is checkable by the reader in the UI.
 * A judge that cannot be parsed is treated as a fail, never as a pass.
 */
async function judgeCriterion(llm: LlmClient, criterion: CriterionInput, artifact: string): Promise<CriterionResult> {
  const answer = await llm.json<JudgeAnswer>(
    [
      { role: 'system', content: UNTRUSTED_CONTENT_RULE },
      {
        role: 'user',
        content: [
          'You are grading a deliverable against one criterion.',
          `Criterion: ${criterion.text}`,
          `Deliverable:\n${artifact}`,
          'Reply with JSON only: {"pass": true|false, "evidence": "<quote of at most 20 words from the deliverable>"}.',
        ].join('\n'),
      },
    ],
    (value) => value as JudgeAnswer,
  );

  const evidence = (answer.evidence ?? '').trim().split(/\s+/).slice(0, EVIDENCE_MAX_WORDS).join(' ');
  return {
    id: criterion.id,
    pass: answer.pass === true,
    evidence: evidence || 'The grader gave no quotable evidence.',
    model_judged: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification
// ─────────────────────────────────────────────────────────────────────────────

/** Run the code checks for one criterion. Returns null when the criterion needs the model. */
function runDeterministicCheck(
  criterion: CriterionInput,
  artifact: { name: string | null; content: string; retrieved: Set<string> },
): CriterionResult | null {
  switch (criterion.check) {
    case CONTRACT_CHECK.fileExists: {
      const expected = typeof criterion.arg === 'string' ? criterion.arg : null;
      const pass = expected !== null && artifact.name === expected;
      return {
        id: criterion.id,
        pass,
        evidence: pass
          ? `Deliverable saved as ${expected}.`
          : `Expected a file named ${expected ?? '(unspecified)'}, found ${artifact.name ?? 'no file'}.`,
        model_judged: false,
      };
    }

    case CONTRACT_CHECK.wordRange: {
      const range = Array.isArray(criterion.arg) ? criterion.arg : [0, Number.MAX_SAFE_INTEGER];
      const [min, max] = [range[0] ?? 0, range[1] ?? Number.MAX_SAFE_INTEGER];
      const words = countWords(artifact.content);
      const pass = words >= min && words <= max;
      return {
        id: criterion.id,
        pass,
        evidence: `Word count was ${words} (required ${min}–${max}).`,
        model_judged: false,
      };
    }

    case CONTRACT_CHECK.minUrls: {
      const required = typeof criterion.arg === 'number' ? criterion.arg : 1;
      const claimed = citedUrls(artifact.content);
      const backed = claimed.filter((url) => artifact.retrieved.has(url));
      const pass = backed.length >= required;
      return {
        id: criterion.id,
        pass,
        evidence: `${backed.length} of the ${claimed.length} cited URLs appear in this run's tool results (required ${required}).`,
        model_judged: false,
      };
    }

    case CONTRACT_CHECK.llm:
      return null;

    default:
      // Exhaustiveness guard: a new check type must be handled here before it can ship.
      return { id: criterion.id, pass: false, evidence: 'Unknown check type.', model_judged: false };
  }
}

/** An empty deliverable cannot satisfy any criterion, so every one is reported as failed. */
const NO_ARTIFACT_EVIDENCE = 'No deliverable was written, so this could not be satisfied.';

/**
 * Check the deliverable against the contract and emit `verify_result`.
 *
 * Deterministic checks always run; `llm` checks are skipped when there is no deliverable to
 * read (the API would fail regardless and burning a call on it would be dishonest).
 */
export async function verifyContract(input: {
  llm: LlmClient;
  ctx: AgentContext;
  contract: ContractInput;
  artifact: { name: string | null; content: string };
}): Promise<ContractVerification> {
  const { llm, ctx, contract, artifact } = input;
  const retrieved = await collectRetrievedUrls(ctx);

  const results: CriterionResult[] = [];
  for (const criterion of contract.criteria) {
    const deterministic = runDeterministicCheck(criterion, { ...artifact, retrieved });
    if (deterministic) {
      results.push(deterministic);
      continue;
    }
    if (!artifact.content) {
      results.push({ id: criterion.id, pass: false, evidence: NO_ARTIFACT_EVIDENCE, model_judged: true });
      continue;
    }
    results.push(await judgeCriterion(llm, criterion, artifact.content));
  }

  const verdict = deriveVerdict(results);
  await ctx.emit(EVENT_TYPE.verifyResult, { criteria: results, verdict });
  return { criteria: results, verdict };
}

/** Every criterion passed → verified; some passed → partially verified; none → unverified. */
export function deriveVerdict(results: CriterionResult[]): Verdict {
  if (results.length === 0) return VERDICT.unverified;
  const passed = results.filter((result) => result.pass).length;
  if (passed === results.length) return VERDICT.verified;
  if (passed === 0) return VERDICT.unverified;
  return VERDICT.partiallyVerified;
}

/** The criteria that did not pass, as plain sentences, for the single repair pass. */
export function failedCriteriaText(results: CriterionResult[], contract: ContractInput): string[] {
  const byId = new Map(contract.criteria.map((criterion) => [criterion.id, criterion.text]));
  return results
    .filter((result) => !result.pass)
    .map((result) => `${byId.get(result.id) ?? result.id} (${result.evidence})`);
}
