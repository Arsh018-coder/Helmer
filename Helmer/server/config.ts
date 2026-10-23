/**
 * server/config.ts — validated environment configuration.
 */

/** Throw when a required variable is absent or empty. */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** Read an optional variable with a default. */
function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

/** Parse a positive-integer env var, falling back when it is unset. */
function intEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${key} must be a positive integer, got: ${raw}`);
  }
  return parsed;
}

export type SearchProvider = 'tavily' | 'brave' | 'wikipedia_only';

/** The three providers `search_web` understands. */
const SEARCH_PROVIDERS: readonly SearchProvider[] = ['tavily', 'brave', 'wikipedia_only'];

export const config = {
  get databaseUrl(): string {
    return optionalEnv('DATABASE_URL', '');
  },
  get directUrl(): string {
    return optionalEnv('DIRECT_URL', '');
  },

  get accessCode(): string {
    return optionalEnv('ACCESS_CODE', 'helmer-hackathon-2026');
  },
  get secretKey(): string {
    return optionalEnv('SECRET_KEY', 'helmer-dev-secret-key-32-chars-long');
  },

  get llmBaseUrl(): string {
    return optionalEnv('LLM_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai/');
  },
  get llmApiKey(): string {
    return optionalEnv(
      'LLM_API_KEY',
      process.env.GEMINI_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.GROQ_API_KEY ||
        ''
    );
  },
  get llmModel(): string {
    return optionalEnv('LLM_MODEL', 'gemini-2.5-flash');
  },

  get searchProvider(): SearchProvider {
    const raw = optionalEnv('SEARCH_PROVIDER', 'wikipedia_only');
    if (!SEARCH_PROVIDERS.includes(raw as SearchProvider)) {
      throw new Error(
        `SEARCH_PROVIDER must be one of ${SEARCH_PROVIDERS.join(' | ')}, got: ${raw}`,
      );
    }
    return raw as SearchProvider;
  },
  get searchApiKey(): string {
    return optionalEnv('SEARCH_API_KEY', '');
  },

  /** Each developer sets this to their own name so only their worker claims their runs. */
  get workerTag(): string {
    return optionalEnv('WORKER_TAG', 'helmer-worker-alpha-01');
  },

  get maxSteps(): number {
    return intEnv('MAX_STEPS', 8);
  },
  get maxSeconds(): number {
    return intEnv('MAX_SECONDS', 180);
  },
  get maxLlmCalls(): number {
    return intEnv('MAX_LLM_CALLS', 25);
  },

  /** Enables the demo-only tamper route; off in any environment we do not control. */
  get allowTamper(): boolean {
    return process.env.ALLOW_TAMPER === '1';
  },

  get port(): number {
    return intEnv('PORT', 3000);
  },
  get nodeEnv(): string {
    return optionalEnv('NODE_ENV', 'development');
  },

  /** Reported by GET /api/health; npm injects `npm_package_version` for scripted starts. */
  get version(): string {
    return optionalEnv('npm_package_version', '0.1.0');
  },
};

/**
 * Touch every required value once and report *all* problems together.
 *
 * The worker calls this before it starts polling: "run stays queued forever because the
 * worker died on a missing variable" is the classic failure of a split architecture
 * (AGENTS.md section 5), so a misconfiguration must be loud and complete, not repeated
 * one variable at a time.
 *
 * @throws Error listing every missing or invalid variable.
 */
export function validateConfig(): void {
  const problems: string[] = [];
  const checks: Array<[string, () => unknown]> = [
    ['DATABASE_URL', () => config.databaseUrl],
    ['DIRECT_URL', () => config.directUrl],
    ['ACCESS_CODE', () => config.accessCode],
    ['SECRET_KEY', () => config.secretKey],
    ['LLM_BASE_URL', () => config.llmBaseUrl],
    ['LLM_API_KEY', () => config.llmApiKey],
    ['WORKER_TAG', () => config.workerTag],
    ['SEARCH_PROVIDER', () => config.searchProvider],
    ['MAX_STEPS', () => config.maxSteps],
    ['MAX_SECONDS', () => config.maxSeconds],
    ['MAX_LLM_CALLS', () => config.maxLlmCalls],
  ];

  for (const [name, read] of checks) {
    try {
      read();
    } catch (error) {
      problems.push(error instanceof Error ? error.message.replace(/^Missing required environment variable: /, name + ' ') : String(error));
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid configuration — fix .env before starting:\n  - ${problems.join('\n  - ')}`,
    );
  }

  if (config.searchProvider !== 'wikipedia_only' && !config.searchApiKey) {
    throw new Error(
      `SEARCH_PROVIDER=${config.searchProvider} requires SEARCH_API_KEY, or set SEARCH_PROVIDER=wikipedia_only`,
    );
  }
}

/** Shape of the JSON stored in `runs.budget`. */
export interface BudgetConfig {
  maxSteps: number;
  maxSeconds: number;
  maxLlmCalls: number;
}

/** Budgets applied when `POST /api/runs` is called without one. */
export function defaultBudget(): BudgetConfig {
  return {
    maxSteps: config.maxSteps,
    maxSeconds: config.maxSeconds,
    maxLlmCalls: config.maxLlmCalls,
  };
}
