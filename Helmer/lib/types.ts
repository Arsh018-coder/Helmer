/**
 * Shared TypeScript interfaces — Helmer
 * These are the exact shapes declared in src/App.tsx.
 * The backend MUST serve data matching these shapes (see docs/CONTRACT.md).
 */

export interface Criterion {
  id: string;
  text: string;
  check: 'min_urls' | 'word_range' | 'file_exists' | 'llm';
  arg?: any;
  status: 'pending' | 'pass' | 'fail';
  evidence?: string;
}

export interface PlanStep {
  step_no: number;
  title: string;
  tool: string;
  status: 'completed' | 'running' | 'pending' | 'injected';
}

export interface RunStep {
  step_no: number;
  title: string;
  tool: string;
  duration_ms: number;
  status: 'passed' | 'injected' | 'verified';
  reasoning: string;
  payload: string;
  /**
   * Set when the injection shield flagged instructions found inside fetched text for this
   * step (feature F7). Distinct from `status: 'injected'`, which is a chaos fault we
   * deliberately introduced; this one is real page content we refused to obey.
   */
  injection?: { url: string; snippet: string };
}

export interface AgentRun {
  id: string;
  goal: string;
  status: 'running' | 'paused' | 'completed' | 'stopped' | 'failed';
  verdict: 'verified' | 'partially_verified' | 'unverified';
  driftScore: number;
  stepsBudget: { current: number; max: number };
  timeBudget: { current: number; max: number };
  llmBudget: { current: number; max: number };
  criteria: Criterion[];
  plan: PlanStep[];
  steps: RunStep[];
  created_at: string;
  duration: string;
  artifactContent?: string;
  preRedirectArtifact?: string | null;
  redirectInstruction?: string | null;
  incidentReport?: string;
  /**
   * Running token totals from `llm_usage` events (feature F6, shown next to the budget bars).
   * Absent until the run has made its first LLM call.
   */
  tokens?: { input: number; output: number; total: number };
  /** How many recovery-ladder rungs have run so far; drives "attempt n of 3" on screen. */
  recoveries?: number;
}
