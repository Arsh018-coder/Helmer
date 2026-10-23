/**
 * server/agent/llm.ts — the only place that talks to the language model.
 *
 * The provider is any OpenAI-compatible endpoint (`LLM_BASE_URL`), so the same code works
 * against Gemini, Groq, OpenAI or a local Ollama. We call the REST endpoint with global
 * `fetch` rather than pulling in a vendor SDK: the wire format is three fields, and one
 * less dependency is one less thing to break on venue Wi-Fi (DECISIONS.md).
 *
 * Two reliability rules from AGENTS.md section 8 are implemented here:
 *  - a 429 or 5xx is retried up to three times with backoff, and every retry emits an
 *    `llm_retry` event so the UI can show why a step is slow;
 *  - token usage is emitted as `llm_usage` after every call. When the provider omits a
 *    usage block we estimate from character counts and say so (`estimated: true`) instead
 *    of inventing a precise number.
 */

import { config } from '../config';
import { LLM_MAX_RETRIES, LLM_RETRY_BASE_MS, LLM_TIMEOUT_MS, EVENT_TYPE } from '../constants';
import { AppError } from '../errors';
import { logger, redact } from '../logger';
import type { EmitFn } from './types';

const log = logger('llm');

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmUsage {
  /** Completed calls made through this client. */
  calls: number;
  tokensIn: number;
  tokensOut: number;
  /** True when any call had to estimate its token counts. */
  estimated: boolean;
}

export interface LlmClient {
  /** Number of successful calls so far — the loop checks this against the budget. */
  readonly calls: number;
  readonly usage: LlmUsage;
  /** Raw completion; use `json` when the answer must be structured. */
  chat(messages: ChatMessage[]): Promise<string>;
  /** Free-form markdown answer (report composition). */
  text(messages: ChatMessage[]): Promise<string>;
  /**
   * Call the model and parse a JSON object out of the answer.
   * Retries once with a repair instruction before giving up.
   * @throws AppError 502 `llm_error` when the model will not return parsable JSON.
   */
  json<T>(messages: ChatMessage[], parse: (value: unknown) => T): Promise<T>;
}

export interface LlmClientOptions {
  runId: string;
  emit: EmitFn;
}

/** Rough chars-per-token used only when the provider returns no usage block. */
const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ProviderUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: ProviderUsage;
  error?: { message?: string };
}

/** True when an HTTP status is worth retrying (rate limit or provider-side failure). */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}

/**
 * Pull a JSON object out of a model answer.
 *
 * Models wrap JSON in prose or code fences no matter how firmly the prompt says not to,
 * so we strip fences and then scan for the first balanced `{...}` block. Returns null
 * instead of throwing; the caller decides whether to repair or fail.
 */
export function extractJsonObject(raw: string): unknown | null {
  const withoutFences = raw
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();

  const start = withoutFences.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < withoutFences.length; i++) {
    const char = withoutFences[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) {
        const candidate = withoutFences.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Instruction appended to the retry call when the first answer was not valid JSON. */
const REPAIR_INSTRUCTION: ChatMessage = {
  role: 'user',
  content:
    'Your previous answer was not valid JSON. Reply with valid JSON only — no prose, no code fences.',
};

/**
 * Create a client bound to one run.
 *
 * Bound (rather than a module singleton) because every retry and every usage update must
 * be written into *that* run's hash chain.
 */
export function createLlmClient(options: LlmClientOptions): LlmClient {
  const usage: LlmUsage = { calls: 0, tokensIn: 0, tokensOut: 0, estimated: false };

  async function request(messages: ChatMessage[]): Promise<string> {
    const url = `${config.llmBaseUrl.replace(/\/$/, '')}/chat/completions`;

    for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.llmApiKey}`,
          },
          body: JSON.stringify({
            model: config.llmModel,
            messages,
            temperature: 0.2,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.text();
          const reason = `http_${response.status}`;

          if (isRetryableStatus(response.status) && attempt < LLM_MAX_RETRIES) {
            await options.emit(EVENT_TYPE.llmRetry, {
              attempt: attempt + 1,
              reason,
            });
            await sleep(LLM_RETRY_BASE_MS * 2 ** attempt);
            continue;
          }
          log.warn('completion failed', { reason });
          throw new AppError(502, 'llm_error', `LLM request failed (${reason})`);
        }

        const payload = (await response.json()) as ChatCompletionResponse;
        const content = payload.choices?.[0]?.message?.content ?? '';

        usage.calls += 1;
        if (payload.usage?.prompt_tokens !== undefined || payload.usage?.completion_tokens !== undefined) {
          usage.tokensIn += payload.usage.prompt_tokens ?? 0;
          usage.tokensOut += payload.usage.completion_tokens ?? 0;
        } else {
          // No usage block: estimate honestly and flag it.
          usage.estimated = true;
          usage.tokensIn += estimateTokens(messages.map((m) => m.content).join('\n'));
          usage.tokensOut += estimateTokens(content);
        }

        await options.emit(EVENT_TYPE.llmUsage, {
          calls: usage.calls,
          tokens_in: usage.tokensIn,
          tokens_out: usage.tokensOut,
          estimated: usage.estimated,
        });

        return content;
      } catch (error) {
        if (error instanceof AppError) throw error;

        // AbortError (timeout) and network failures are retryable for the same reason a
        // 503 is: the provider is temporarily unreachable (free tiers do this a lot).
        const reason = (error as Error).name === 'AbortError' ? 'timeout' : 'network';
        if (attempt < LLM_MAX_RETRIES) {
          await options.emit(EVENT_TYPE.llmRetry, { attempt: attempt + 1, reason });
          await sleep(LLM_RETRY_BASE_MS * 2 ** attempt);
          continue;
        }
        log.error('completion aborted', { reason: redact(reason) });
        throw new AppError(502, 'llm_error', `LLM request failed (${reason})`);
      } finally {
        clearTimeout(timer);
      }
    }

    throw new AppError(502, 'llm_error', 'LLM request failed after retries');
  }

  return {
    get calls() {
      return usage.calls;
    },
    usage,

    chat: request,
    text: request,

    async json<T>(messages: ChatMessage[], parse: (value: unknown) => T): Promise<T> {
      const first = await request(messages);
      const parsed = extractJsonObject(first);
      if (parsed !== null) {
        try {
          return parse(parsed);
        } catch (error) {
          log.warn('json shape rejected', { message: (error as Error).message });
        }
      }

      // One repair attempt, exactly as AGENTS.md section 8 allows.
      const second = await request([...messages, { role: 'assistant', content: first }, REPAIR_INSTRUCTION]);
      const repaired = extractJsonObject(second);
      if (repaired === null) {
        throw new AppError(502, 'llm_error', 'Model did not return parsable JSON');
      }
      return parse(repaired);
    },
  };
}
