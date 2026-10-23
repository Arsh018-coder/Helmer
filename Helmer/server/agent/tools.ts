/**
 * server/agent/tools.ts — the only four things the agent is allowed to do.
 *
 * `search_web`, `search_wikipedia`, `fetch_page` and `write_file`. There is no shell tool
 * and no code execution anywhere in this project (AGENTS.md section 13); everything the
 * agent produces comes from these calls, which is why the deliverable's citations can be
 * traced back to a `tool_result` event.
 *
 * Chaos commands are consumed here, before execution, so an injected fault happens inside
 * the same code path a real failure would (AGENTS.md section 8). An injected failure is
 * always reported as `injected: true` so the UI can badge it and nobody mistakes it for a
 * genuine outage.
 */

import * as cheerio from 'cheerio';
import { config } from '../config';
import {
  ALLOWED_ARTIFACT_EXTENSIONS,
  FETCH_MAX_BYTES,
  FETCH_MAX_REDIRECTS,
  FETCH_TEXT_MAX_CHARS,
  FETCH_TIMEOUT_MS,
  MAX_ARTIFACT_BYTES,
  TOOL_NAME,
  TOOL_OUTPUT_MAX_CHARS,
  type ChaosMode,
  type ToolName,
} from '../constants';
import { AppError } from '../errors';
import { logger } from '../logger';
import { assertPublicUrl } from './ssrf';
import type { AgentContext, SearchHit, ToolResult } from './types';

const log = logger('tools');

/** How long a `slow` chaos command sleeps before proceeding. */
const CHAOS_SLOW_MS = 4_000;

/**
 * Raised when a chaos command breaks a tool on purpose.
 * The `injected` flag is what lets the loop label the failure honestly in the UI.
 */
export class ChaosInjectedError extends Error {
  readonly injected = true;
  constructor(tool: string, mode: ChaosMode) {
    super(`injected: ${tool} unavailable (chaos mode: ${mode})`);
    this.name = 'ChaosInjectedError';
  }
}

/** Cut long tool output so stored events stay small (Supabase free-tier quota). */
export function truncate(text: string, max = TOOL_OUTPUT_MAX_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[truncated ${text.length - max} characters]`;
}

/** Artifact names are the only user-controlled string that reaches storage. */
export const ARTIFACT_NAME_PATTERN = new RegExp(
  `^[A-Za-z0-9._-]+\\.(${ALLOWED_ARTIFACT_EXTENSIONS.join('|')})$`,
);

/**
 * Validate a deliverable name.
 * @throws AppError 400 `bad_request` for separators, traversal or a wrong extension.
 */
export function assertArtifactName(name: string): void {
  if (!ARTIFACT_NAME_PATTERN.test(name)) {
    throw new AppError(
      400,
      'bad_request',
      `Artifact name must match ${ARTIFACT_NAME_PATTERN.source} (no slashes, no "..")`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared HTTP helper
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch with a hard timeout; the caller always sees a rejected promise, never a hang. */
async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read at most `maxBytes` of a response body, then stop and cancel the stream.
 * Reading a hostile endless response into memory would be a trivial denial of service.
 */
async function readCapped(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      chunks.push(value);
      total += value.byteLength;

      if (total >= maxBytes) {
        await reader.cancel();
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const room = merged.length - offset;
    if (room <= 0) break;
    merged.set(chunk.subarray(0, room), offset);
    offset += Math.min(chunk.byteLength, room);
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

// ─────────────────────────────────────────────────────────────────────────────
// Chaos
// ─────────────────────────────────────────────────────────────────────────────

interface ChaosCommandPayload {
  tool: string;
  mode: ChaosMode;
  count?: number;
}

/**
 * Consume one pending chaos command for `tool`, if any.
 *
 * `count` lets one injection break several consecutive calls. The command row is only
 * marked consumed when its count reaches zero, so `handleCommands` never sees it.
 */
async function consumeChaos(ctx: AgentContext, tool: ToolName): Promise<ChaosCommandPayload | null> {
  const pending = await ctx.db.command.findMany({
    where: { runId: ctx.runId, kind: 'chaos', consumedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, payload: true },
  });

  for (const command of pending) {
    let payload: ChaosCommandPayload;
    try {
      payload = JSON.parse(command.payload) as ChaosCommandPayload;
    } catch {
      continue;
    }
    if (payload.tool !== tool) continue;

    const remaining = (payload.count ?? 1) - 1;
    await ctx.db.command.update({
      where: { id: command.id },
      data:
        remaining > 0
          ? { payload: JSON.stringify({ ...payload, count: remaining }) }
          : { consumedAt: new Date() },
    });

    return payload;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Search providers
// ─────────────────────────────────────────────────────────────────────────────

/** Strip tags from a provider snippet, which often arrives as small HTML. */
function plainText(html: string): string {
  return cheerio.load(html).text().replace(/\s+/g, ' ').trim();
}

async function searchWikipedia(query: string): Promise<SearchHit[]> {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'search');
  url.searchParams.set('srsearch', query);
  url.searchParams.set('srlimit', '5');
  url.searchParams.set('format', 'json');

  const response = await fetchWithTimeout(url.toString(), {
    headers: { 'User-Agent': 'Helmer/0.1 (hackathon agent; contact: team devX)' },
  });
  if (!response.ok) {
    throw new AppError(502, 'tool_error', `Wikipedia search failed (http_${response.status})`);
  }

  const body = (await response.json()) as {
    query?: { search?: Array<{ title: string; snippet: string; pageid: number }> };
  };

  return (body.query?.search ?? []).map((hit) => ({
    title: hit.title,
    url: `https://en.wikipedia.org/?curid=${hit.pageid}`,
    snippet: plainText(hit.snippet),
  }));
}

async function searchTavily(query: string): Promise<SearchHit[]> {
  const response = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: config.searchApiKey, query, max_results: 5 }),
  });
  if (!response.ok) {
    throw new AppError(502, 'tool_error', `Tavily search failed (http_${response.status})`);
  }

  const body = (await response.json()) as {
    results?: Array<{ title: string; url: string; content: string }>;
  };
  return (body.results ?? []).map((hit) => ({
    title: hit.title,
    url: hit.url,
    snippet: hit.content,
  }));
}

async function searchBrave(query: string): Promise<SearchHit[]> {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', '5');

  const response = await fetchWithTimeout(url.toString(), {
    headers: { Accept: 'application/json', 'X-Subscription-Token': config.searchApiKey },
  });
  if (!response.ok) {
    throw new AppError(502, 'tool_error', `Brave search failed (http_${response.status})`);
  }

  const body = (await response.json()) as {
    web?: { results?: Array<{ title: string; url: string; description: string }> };
  };
  return (body.web?.results ?? []).map((hit) => ({
    title: hit.title,
    url: hit.url,
    snippet: plainText(hit.description),
  }));
}

/**
 * Keyed web search.
 *
 * With `SEARCH_PROVIDER=wikipedia_only` (or no key configured) this deliberately fails so
 * the recovery ladder falls back to `search_wikipedia` — the same path a provider outage
 * takes, and the fallback is therefore exercised on every demo run.
 */
async function searchWeb(query: string): Promise<SearchHit[]> {
  const provider = config.searchProvider;

  if (provider === 'wikipedia_only') {
    throw new AppError(502, 'tool_error', 'search_web has no keyed provider configured');
  }
  if (!config.searchApiKey) {
    throw new AppError(502, 'tool_error', `SEARCH_API_KEY is required for ${provider}`);
  }

  return provider === 'tavily' ? searchTavily(query) : searchBrave(query);
}

// ─────────────────────────────────────────────────────────────────────────────
// fetch_page
// ─────────────────────────────────────────────────────────────────────────────

/** Extract readable text; scripts, styles, navigation and footers are noise for the model. */
export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, nav, footer, header, svg, form, iframe').remove();
  const text = $('body').text() || $.root().text();
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Fetch a page as text.
 *
 * Redirects are followed manually so the SSRF guard re-runs on every hop; `fetch`'s
 * automatic redirect following would let a public URL bounce us into the private network.
 */
async function fetchPage(rawUrl: string): Promise<{ hit: SearchHit; text: string }> {
  let current = await assertPublicUrl(rawUrl);

  for (let hop = 0; hop <= FETCH_MAX_REDIRECTS; hop++) {
    const response = await fetchWithTimeout(current.toString(), {
      redirect: 'manual',
      headers: { 'User-Agent': 'Helmer/0.1 (hackathon agent; contact: team devX)' },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new AppError(502, 'tool_error', `Redirect from ${current.hostname} had no Location`);
      }
      // Resolve relative redirects against the current URL, then re-validate from scratch.
      current = await assertPublicUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) {
      throw new AppError(502, 'tool_error', `Fetch failed (http_${response.status})`);
    }

    const html = await readCapped(response, FETCH_MAX_BYTES);
    const text = htmlToText(html).slice(0, FETCH_TEXT_MAX_CHARS);

    return {
      hit: {
        title: current.hostname + current.pathname,
        url: current.toString(),
        snippet: text.slice(0, 200),
      },
      text,
    };
  }

  throw new AppError(502, 'tool_error', `Too many redirects (max ${FETCH_MAX_REDIRECTS})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// write_file
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Store the deliverable in the `artifacts` table.
 *
 * Nothing is written to disk: web and worker may run on different machines, and keeping
 * the file in the shared database means the phone that steered the run can also download
 * it. Names are validated and byte-capped before the row is written.
 */
async function writeFile(
  ctx: AgentContext,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const name = String(args.name ?? args.filename ?? '');
  const content = String(args.content ?? '');

  assertArtifactName(name);

  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes === 0) {
    throw new AppError(400, 'bad_request', 'Refusing to write an empty artifact');
  }
  if (bytes > MAX_ARTIFACT_BYTES) {
    throw new AppError(400, 'bad_request', `Artifact is ${bytes} bytes; the limit is ${MAX_ARTIFACT_BYTES}`);
  }

  await ctx.db.artifact.upsert({
    where: { runId_name: { runId: ctx.runId, name } },
    create: { runId: ctx.runId, name, content, bytes },
    update: { content, bytes, createdAt: new Date() },
  });

  await ctx.emit('artifact_written', { path: name, bytes });

  return {
    tool: TOOL_NAME.writeFile,
    summary: `Wrote ${name} (${bytes} bytes)`,
    output: content,
    ms: 0,
    urls: [],
    artifactName: name,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────────────────────

export interface RunToolInput {
  ctx: AgentContext;
  stepNo: number;
  tool: ToolName;
  args: Record<string, unknown>;
}

/**
 * Execute one tool call, emitting `tool_call` / `tool_result` / `tool_error`.
 *
 * @throws AppError for a genuine tool failure, or `ChaosInjectedError` when a chaos
 *         command broke it on purpose. Both are handled by the loop's recovery ladder.
 */
export async function runTool(input: RunToolInput): Promise<ToolResult> {
  const { ctx, stepNo, tool, args } = input;

  await ctx.emit('tool_call', { step_no: stepNo, tool, args });

  const chaos = await consumeChaos(ctx, tool);
  if (chaos) {
    if (chaos.mode === 'slow') {
      await new Promise((resolve) => setTimeout(resolve, CHAOS_SLOW_MS));
    }
    if (chaos.mode === 'fail') {
      const error = new ChaosInjectedError(tool, chaos.mode);
      await ctx.emit('tool_error', {
        step_no: stepNo,
        tool,
        error: error.message,
        injected: true,
      });
      throw error;
    }
    // `garbage`: return unusable output and let the drift guard notice. Labelled so the
    // UI can still show that the fault was injected rather than real.
    const startedAt = Date.now();
    const summary = `injected: ${tool} returned unusable output`;
    await ctx.emit('tool_result', {
      step_no: stepNo,
      tool,
      summary,
      ms: Date.now() - startedAt,
      injected: true,
      urls: [],
    });
    return { tool, summary, output: summary, ms: Date.now() - startedAt, urls: [] };
  }

  const startedAt = Date.now();
  try {
    const result = await execute(ctx, tool, args);
    const ms = Date.now() - startedAt;
    result.ms = ms;

    await ctx.emit('tool_result', {
      step_no: stepNo,
      tool,
      summary: result.summary,
      ms,
      urls: result.urls,
      output: truncate(result.output),
      artifact: result.artifactName,
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await ctx.emit('tool_error', {
      step_no: stepNo,
      tool,
      error: message,
      injected: error instanceof ChaosInjectedError,
    });
    throw error;
  }
}

/** Route a validated tool name to its implementation. */
async function execute(
  ctx: AgentContext,
  tool: ToolName,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const query = String(args.query ?? args.q ?? '');

  switch (tool) {
    case TOOL_NAME.searchWeb: {
      const hits = await searchWeb(query);
      return {
        tool,
        summary: `search_web("${query}") → ${hits.length} results`,
        output: hits.map((h) => `${h.title}\n${h.url}\n${h.snippet}`).join('\n\n'),
        ms: 0,
        urls: hits,
      };
    }

    case TOOL_NAME.searchWikipedia: {
      const hits = await searchWikipedia(query);
      return {
        tool,
        summary: `search_wikipedia("${query}") → ${hits.length} results`,
        output: hits.map((h) => `${h.title}\n${h.url}\n${h.snippet}`).join('\n\n'),
        ms: 0,
        urls: hits,
      };
    }

    case TOOL_NAME.fetchPage: {
      const url = String(args.url ?? '');
      if (!url) throw new AppError(400, 'bad_request', 'fetch_page requires a url');
      const { hit, text } = await fetchPage(url);
      return {
        tool,
        summary: `fetch_page(${hit.url}) → ${text.length} chars`,
        output: text,
        ms: 0,
        urls: [hit],
      };
    }

    case TOOL_NAME.writeFile:
      return writeFile(ctx, args);

    default: {
      // Exhaustiveness: a new tool name without an implementation is a compile error.
      const neverTool: never = tool;
      throw new AppError(400, 'bad_request', `Unknown tool: ${String(neverTool)}`);
    }
  }
}

/** Log helper kept tiny: the interesting record of a call is the emitted event, not a log line. */
export function describeToolCall(tool: ToolName, args: Record<string, unknown>): string {
  return `${tool}(${Object.keys(args).join(', ')})`;
}

export { logger as toolLogger };
