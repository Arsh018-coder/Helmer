/**
 * lib/api.ts — every call the browser makes to the Helmer API.
 *
 * The UI never talks to the database or the worker; it creates a run, polls its events and reads
 * the run row back through these functions (AGENTS.md section 2). Keeping them in one module means
 * the access code, the share token, the response envelope and the error shape are handled once
 * rather than at every call site.
 *
 * Two response conventions exist on the server and both are honoured here:
 *  - most routes wrap their payload as `{ ok: true, ...data }` (`okJson`), which is unwrapped;
 *  - `verify-chain` returns the chain verdict itself, where `ok` *is* the answer, so it is read raw.
 */

import type { ChainVerdict } from './chain';
import type { RunBundle } from './verifyBundle';

// ─────────────────────────────────────────────────────────────────────────────
// Wire types (the shapes the route handlers actually send)
// ─────────────────────────────────────────────────────────────────────────────

export type RunStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
export type RunVerdict = 'verified' | 'partially_verified' | 'unverified';

/** Statuses after which polling stops, mirroring `server/constants.ts` TERMINAL_STATUSES. */
export const TERMINAL_RUN_STATUSES: readonly RunStatus[] = ['completed', 'failed', 'stopped'];

/** One row of `events` as returned by the polling endpoint. */
export interface EventRecord {
  runId: string;
  seq: number;
  ts: number;
  type: string;
  payload: string;
  prevHash: string;
  hash: string;
}

export interface RunSummary {
  id: string;
  goal: string;
  status: RunStatus;
  verdict: RunVerdict | null;
  createdAt: string;
  finishedAt: string | null;
  tokens?: { input: number; output: number; total: number } | null;
}

export interface ContractWire {
  criteria: Array<{ id: string; text: string; check: string; arg?: unknown }>;
}

export interface PlanWire {
  steps: Array<{ step_no: number; title: string; tool: string }>;
}

export interface BudgetWire {
  maxSteps: number;
  maxSeconds: number;
  maxLlmCalls: number;
}

export interface RunDetail extends RunSummary {
  contract: ContractWire | null;
  plan: PlanWire | null;
  budget: BudgetWire;
}

export interface HealthStatus {
  ok: boolean;
  db_reachable: boolean;
  llm_reachable: boolean;
  worker_alive: boolean;
  version: string;
}

export interface CommandRequest {
  kind: 'pause' | 'resume' | 'stop' | 'redirect';
  payload?: Record<string, unknown>;
  source?: 'console' | 'phone';
}

export interface ChaosRequest {
  tool: string;
  mode: 'fail' | 'slow' | 'garbage';
  count?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

/** A failed API call, carrying the server's stable error code and HTTP status. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Access code
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Where the access code is kept between requests.
 *
 * The access code is a soft gate for the demo, not a secret on the level of an API key: whoever
 * holds it can spend the team's LLM quota, so it is worth guarding, but every other secret (the
 * LLM key, the database password) stays server-side. It is read from `localStorage` first so a
 * deployment behind a public tunnel does not have to inline it into the bundle; the build-time
 * `NEXT_PUBLIC_ACCESS_CODE` is a convenience for local development.
 */
const ACCESS_CODE_STORAGE_KEY = 'helmer.accessCode';

/** The access code this browser will send: a stored one, else the build-time default. */
export function getAccessCode(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(ACCESS_CODE_STORAGE_KEY);
      if (stored) return stored;
    } catch {
      // Storage can be unavailable (private mode); fall through to the build-time value.
    }
  }
  return process.env.NEXT_PUBLIC_ACCESS_CODE ?? '';
}

/** Remember a code for this browser session, so it is not retyped on every request. */
export function setAccessCode(code: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACCESS_CODE_STORAGE_KEY, code);
  } catch {
    // A browser that refuses storage simply re-prompts next time.
  }
}

/** Forget the stored code. */
export function clearAccessCode(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ACCESS_CODE_STORAGE_KEY);
  } catch {
    // Nothing to clean up.
  }
}

/** True when this browser already holds a code. */
export function hasAccessCode(): boolean {
  return getAccessCode().length > 0;
}

/**
 * Ask the user for the access code, remember it and return it.
 * `window.prompt` is used deliberately: adding an access-code screen would change the frozen UI.
 */
export function promptForAccessCode(): string | null {
  if (typeof window === 'undefined') return null;
  const answer = window.prompt('Enter the Helmer access code');
  if (!answer) return null;
  const code = answer.trim();
  if (!code) return null;
  setAccessCode(code);
  return code;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport
// ─────────────────────────────────────────────────────────────────────────────

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** `?after=` etc. for the endpoints that take one. */
  query?: Record<string, string | number>;
  /** Share token for the phone Steer view; sent as `?t=`. */
  token?: string | null;
  signal?: AbortSignal;
}

function buildUrl(path: string, options: RequestOptions): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) params.set(key, String(value));
  if (options.token) params.set('t', options.token);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

async function readError(response: Response): Promise<{ code: string; message: string }> {
  try {
    const body = (await response.json()) as { error?: unknown; message?: unknown };
    return {
      code: typeof body.error === 'string' ? body.error : 'internal',
      message: typeof body.message === 'string' ? body.message : `Request failed (${response.status})`,
    };
  } catch {
    return { code: 'internal', message: `Request failed (${response.status})` };
  }
}

/** Perform a request, turning a non-2xx response into an `ApiError`. */
async function send(path: string, options: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  const accessCode = getAccessCode();
  if (accessCode) headers['X-Access-Code'] = accessCode;

  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options), {
      method: options.method ?? 'GET',
      headers,
      body,
      // Live data must never be served from a cache (the routes are force-dynamic).
      cache: 'no-store',
      signal: options.signal,
    });
  } catch {
    throw new ApiError(0, 'network', 'Could not reach the Helmer server. Is it running?');
  }

  if (!response.ok) {
    const { code, message } = await readError(response);
    throw new ApiError(response.status, code, message);
  }
  return response;
}

/** Read a route's `{ ok: true, ...data }` payload, returning only the data part. */
async function apiJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  const body = (await response.json()) as Record<string, unknown>;
  if (body.ok === true) {
    const data = { ...body };
    delete data.ok;
    return data as T;
  }
  return body as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

/** Validate a code without storing it. `POST /api/auth` answers 401 for a wrong one. */
export async function checkAccessCode(code: string): Promise<boolean> {
  try {
    await send('/api/auth', { method: 'POST', body: { code } });
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return false;
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read `/api/health`.
 *
 * This route answers 503 when the database is unreachable, and that body is still the useful
 * answer, so it is parsed here instead of going through `send` (which would throw).
 */
export async function getHealth(): Promise<HealthStatus> {
  let response: Response;
  try {
    response = await fetch('/api/health', { cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'network', 'Could not reach the Helmer server. Is it running?');
  }

  const body = (await response.json()) as HealthStatus;
  return body;
}

// ─────────────────────────────────────────────────────────────────────────────
// Runs
// ─────────────────────────────────────────────────────────────────────────────

/** Newest-first run list. `GET /api/runs` */
export async function listRuns(): Promise<RunSummary[]> {
  const data = await apiJson<{ runs: RunSummary[] }>('/api/runs');
  return data.runs ?? [];
}

/**
 * Create a queued run. `POST /api/runs`
 *
 * @throws ApiError 409 `run_active` when this machine's worker already has a live run.
 */
export async function createRun(goal: string, budget?: Partial<BudgetWire>): Promise<string> {
  const data = await apiJson<{ id: string }>('/api/runs', {
    method: 'POST',
    body: budget ? { goal, budget } : { goal },
  });
  return data.id;
}

/** One run with its contract, plan and budget. `GET /api/runs/[id]` */
export async function getRun(id: string, token?: string | null): Promise<RunDetail> {
  const data = await apiJson<{ run: RunDetail }>(`/api/runs/${id}`, { token });
  return data.run;
}

/** Events newer than `after`, plus the run's current status. `GET /api/runs/[id]/events` */
export async function listEvents(
  id: string,
  after: number,
  token?: string | null,
): Promise<{ events: EventRecord[]; status: RunStatus }> {
  return apiJson<{ events: EventRecord[]; status: RunStatus }>(`/api/runs/${id}/events`, {
    query: { after },
    token,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Control
// ─────────────────────────────────────────────────────────────────────────────

/** Pause, resume, stop or redirect. `POST /api/runs/[id]/commands` */
export async function submitCommand(
  id: string,
  command: CommandRequest,
  token?: string | null,
): Promise<void> {
  await apiJson(`/api/runs/${id}/commands`, { method: 'POST', body: command, token });
}

/** Inject a chaos fault into one tool. `POST /api/runs/[id]/chaos` */
export async function submitChaos(
  id: string,
  chaos: ChaosRequest,
  token?: string | null,
): Promise<void> {
  await apiJson(`/api/runs/${id}/chaos`, { method: 'POST', body: chaos, token });
}

// ─────────────────────────────────────────────────────────────────────────────
// Flight recorder
// ─────────────────────────────────────────────────────────────────────────────

/** Server-side chain verdict. `GET /api/runs/[id]/verify-chain` (returned without the envelope). */
export async function verifyChain(id: string, token?: string | null): Promise<ChainVerdict> {
  const response = await send(`/api/runs/${id}/verify-chain`, { token });
  return (await response.json()) as ChainVerdict;
}

/** Export the run for the offline verifier. `GET /api/runs/[id]/bundle` */
export async function exportBundle(id: string, token?: string | null): Promise<RunBundle> {
  return apiJson<RunBundle>(`/api/runs/${id}/bundle`, { token });
}

/**
 * Download the exported bundle as a JSON file, ready to paste into `/verify`.
 *
 * Like `downloadArtifact`, the bytes come from the API rather than a bare `<a href>` so the same
 * action works on the phone view, where the credential is a `?t=` token.
 */
export async function downloadBundle(id: string, token?: string | null): Promise<string> {
  const bundle = await exportBundle(id, token);
  const filename = `helmer-run-${id}.json`;
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return filename;
}

/** Demo-only payload edit; breaks the chain at `seq`. `POST /api/runs/[id]/tamper` */
export async function tamperEvent(id: string, seq: number, payload: string): Promise<number> {
  const data = await apiJson<{ seq: number }>(`/api/runs/${id}/tamper`, {
    method: 'POST',
    body: { seq, payload },
  });
  return data.seq;
}

// ─────────────────────────────────────────────────────────────────────────────
// Share and artifact
// ─────────────────────────────────────────────────────────────────────────────

/** Mint the phone Steer link. `POST /api/runs/[id]/share` */
export async function createShareLink(id: string): Promise<string> {
  const data = await apiJson<{ url: string }>(`/api/runs/${id}/share`, { method: 'POST' });
  return data.url;
}

/** The direct download URL, usable as an `href` because the server sets Content-Disposition. */
export function artifactUrl(id: string, token?: string | null): string {
  return buildUrl(`/api/runs/${id}/artifact`, { token });
}

/** Read the deliverable's text and stored filename. `GET /api/runs/[id]/artifact` */
export async function fetchArtifact(
  id: string,
  token?: string | null,
): Promise<{ content: string; filename: string; bytes: number }> {
  const response = await send(`/api/runs/${id}/artifact`, { token });
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  return {
    content: await response.text(),
    filename: match?.[1] ?? 'deliverable.md',
    bytes: Number.parseInt(response.headers.get('X-Artifact-Bytes') ?? '0', 10),
  };
}

/**
 * Download the deliverable through the browser.
 *
 * The bytes come from the API rather than from a plain `<a href>` so the download also works on
 * the phone Steer view, where the credential is a `?t=` token rather than a stored header.
 */
export async function downloadArtifact(id: string, token?: string | null): Promise<string> {
  const { content, filename } = await fetchArtifact(id, token);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return filename;
}
