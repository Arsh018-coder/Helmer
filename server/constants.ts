/**
 * server/constants.ts — domain constants shared by the API, the agent and the worker.
 *
 * Why this file exists (AGENTS.md section 19): statuses, event names, tool names and
 * every limit live here so no magic string or number is scattered across the codebase.
 * Emitters and consumers import from one place, so a typo becomes a compile error
 * instead of a silently ignored event.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Run lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * queued -> running <-> paused -> completed | failed | stopped
 * Enforced by whoever writes `runs.status`; the DB column is a plain string.
 */
export const RUN_STATUS = {
  queued: 'queued',
  running: 'running',
  paused: 'paused',
  completed: 'completed',
  failed: 'failed',
  stopped: 'stopped',
} as const;

export type RunStatus = (typeof RUN_STATUS)[keyof typeof RUN_STATUS];

/** Statuses after which the UI stops polling. */
export const TERMINAL_STATUSES: readonly RunStatus[] = [
  RUN_STATUS.completed,
  RUN_STATUS.failed,
  RUN_STATUS.stopped,
];

/** Statuses that block creating a second run for the same worker tag. */
export const ACTIVE_STATUSES: readonly RunStatus[] = [
  RUN_STATUS.queued,
  RUN_STATUS.running,
  RUN_STATUS.paused,
];

// ─────────────────────────────────────────────────────────────────────────────
// Verdicts (AGENTS.md section 7, `run_completed.verdict`)
// ─────────────────────────────────────────────────────────────────────────────

export const VERDICT = {
  verified: 'verified',
  partiallyVerified: 'partially_verified',
  unverified: 'unverified',
} as const;

export type Verdict = (typeof VERDICT)[keyof typeof VERDICT];

// ─────────────────────────────────────────────────────────────────────────────
// Event types — the single source of truth for `events.type`
// ─────────────────────────────────────────────────────────────────────────────

export const EVENT_TYPE = {
  runStarted: 'run_started',
  contractCreated: 'contract_created',
  planCreated: 'plan_created',
  stepStarted: 'step_started',
  reasoning: 'reasoning',
  toolCall: 'tool_call',
  toolResult: 'tool_result',
  toolError: 'tool_error',
  recovery: 'recovery',
  llmRetry: 'llm_retry',
  llmUsage: 'llm_usage',
  driftCheck: 'drift_check',
  injectionFlagged: 'injection_flagged',
  commandReceived: 'command_received',
  paused: 'paused',
  resumed: 'resumed',
  redirected: 'redirected',
  stopped: 'stopped',
  verifyResult: 'verify_result',
  artifactWritten: 'artifact_written',
  incidentReport: 'incident_report',
  runCompleted: 'run_completed',
  runFailed: 'run_failed',
} as const;

export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

// ─────────────────────────────────────────────────────────────────────────────
// Commands — user control messages carried in the `commands` table
// ─────────────────────────────────────────────────────────────────────────────

export const COMMAND_KIND = {
  pause: 'pause',
  resume: 'resume',
  stop: 'stop',
  redirect: 'redirect',
  chaos: 'chaos',
} as const;

export type CommandKind = (typeof COMMAND_KIND)[keyof typeof COMMAND_KIND];

/** Where a command came from; shown in the `command_received` event. */
export const COMMAND_SOURCE = {
  console: 'console',
  phone: 'phone',
} as const;

export type CommandSource = (typeof COMMAND_SOURCE)[keyof typeof COMMAND_SOURCE];

// ─────────────────────────────────────────────────────────────────────────────
// Tools — the only four the agent may use. No shell tool exists, ever.
// ─────────────────────────────────────────────────────────────────────────────

export const TOOL_NAME = {
  searchWeb: 'search_web',
  searchWikipedia: 'search_wikipedia',
  fetchPage: 'fetch_page',
  writeFile: 'write_file',
} as const;

export type ToolName = (typeof TOOL_NAME)[keyof typeof TOOL_NAME];

export const ALL_TOOL_NAMES: readonly ToolName[] = Object.values(TOOL_NAME);

/** The natural fallback when a search provider is unavailable (AGENTS.md section 8). */
export const TOOL_FALLBACK: Partial<Record<ToolName, ToolName>> = {
  [TOOL_NAME.searchWeb]: TOOL_NAME.searchWikipedia,
  [TOOL_NAME.searchWikipedia]: TOOL_NAME.searchWeb,
};

/** Chaos modes. `fail` throws, `slow` sleeps, `garbage` returns junk. */
export const CHAOS_MODE = {
  fail: 'fail',
  slow: 'slow',
  garbage: 'garbage',
} as const;

export type ChaosMode = (typeof CHAOS_MODE)[keyof typeof CHAOS_MODE];

export const ALL_CHAOS_MODES: readonly ChaosMode[] = Object.values(CHAOS_MODE);

// ─────────────────────────────────────────────────────────────────────────────
// Intent contract — the only check types the verifier understands
// ─────────────────────────────────────────────────────────────────────────────

export const CONTRACT_CHECK = {
  minUrls: 'min_urls',
  wordRange: 'word_range',
  fileExists: 'file_exists',
  llm: 'llm',
} as const;

export type ContractCheck = (typeof CONTRACT_CHECK)[keyof typeof CONTRACT_CHECK];

export const ALL_CONTRACT_CHECKS: readonly ContractCheck[] = Object.values(CONTRACT_CHECK);

// ─────────────────────────────────────────────────────────────────────────────
// Drift policy (AGENTS.md section 8)
// ─────────────────────────────────────────────────────────────────────────────

/** >= this score is healthy. */
export const DRIFT_OK_THRESHOLD = 70;
/** 50..69 is a warning state. Below 50 twice in a row auto-pauses the run. */
export const DRIFT_WARN_THRESHOLD = 50;
/** Consecutive sub-50 scores that trigger the automatic pause. */
export const DRIFT_PAUSE_STREAK = 2;
/** Score assumed before the first check so the meter never renders as NaN. */
export const DRIFT_INITIAL_SCORE = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Limits — timeouts, caps and retention
// ─────────────────────────────────────────────────────────────────────────────

/** `fetch_page` request timeout (AGENTS.md section 8). */
export const FETCH_TIMEOUT_MS = 8_000;
/** `fetch_page` response size cap: 1 MB. */
export const FETCH_MAX_BYTES = 1_000_000;
/** Manual redirects allowed before giving up (each one re-checked for SSRF). */
export const FETCH_MAX_REDIRECTS = 3;
/** Visible text handed to the model; the rest is dropped to protect the context. */
export const FETCH_TEXT_MAX_CHARS = 6_000;

/** Artifact cap enforced by `write_file` (AGENTS.md section 8). */
export const MAX_ARTIFACT_BYTES = 50 * 1024;
/** Tool outputs stored in events are truncated to stay inside the Supabase free tier. */
export const TOOL_OUTPUT_MAX_CHARS = 4_000;

/** Running research notes handed back to the model; older detail is dropped past this size. */
export const AGENT_NOTES_MAX_CHARS = 12_000;

/** LLM retries on 429/5xx before the call is treated as failed. */
export const LLM_MAX_RETRIES = 3;
/** Base backoff; attempt n waits BASE * 2^n. */
export const LLM_RETRY_BASE_MS = 600;
/** Hard timeout for a single LLM request. */
export const LLM_TIMEOUT_MS = 60_000;
/** Model-judged criteria are capped so the contract stays mostly code-checked. */
export const MAX_LLM_CRITERIA = 2;

/** Ladder rung 1 waits this long before retrying the same tool call. */
export const RECOVERY_RETRY_BACKOFF_MS = 700;

/** LLM calls held back from the step loop for composing, repairing and reporting. */
export const LLM_RESERVE_CALLS = 3;

/** File name used when the contract does not name the deliverable explicitly. */
export const DEFAULT_DELIVERABLE_NAME = 'briefing.md';

/** Cooldown between polls of the `commands` table while a run is paused. */
export const COMMAND_POLL_MS = 500;

/** Upper bound on events returned in one poll, so a long run cannot overflow a response. */
export const EVENT_PAGE_LIMIT = 2_000;
/** Worker heartbeat cadence. */
export const WORKER_HEARTBEAT_MS = 5_000;
/** Worker claim cadence. */
export const WORKER_POLL_MS = 1_000;
/** A worker is considered alive if its heartbeat is younger than this. */
export const WORKER_ALIVE_WINDOW_MS = 15_000;

/** Share tokens are valid for two hours (AGENTS.md section 9). */
export const SHARE_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

/** Run ids are 8 characters from an unambiguous alphabet. */
export const RUN_ID_LENGTH = 8;

/** Tool names in the deliverable must have appeared in this run's tool results. */
export const ALLOWED_ARTIFACT_EXTENSIONS = ['md', 'txt'] as const;
