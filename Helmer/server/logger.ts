/**
 * server/logger.ts — the only logging surface in server/ and worker/.
 *
 * `no-console` is an error in the worker and in server code (AGENTS.md section 19),
 * so everything goes through here. Output is human-readable in development and
 * single-line JSON in production so a log collector can parse it.
 *
 * Never log secrets, connection strings, API keys or raw fetched page content —
 * `redact` exists for the few places that must log a URL or an error message.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isProduction = process.env.NODE_ENV === 'production';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Minimum level that is emitted; DEBUG/LOG_LEVEL can raise it in production. */
const minLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ?? (isProduction ? 'info' : 'debug');

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

function emit(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const line = isProduction
    ? JSON.stringify({ ts: new Date().toISOString(), level, scope, message, ...meta })
    : `${level.toUpperCase().padEnd(5)} [${scope}] ${message}${meta ? ' ' + JSON.stringify(meta) : ''}`;

  if (level === 'error') {
    process.stderr.write(line + '\n');
    return;
  }
  process.stdout.write(line + '\n');
}

/** A logger bound to one module; pass the file's domain, e.g. `logger('worker')`. */
export function logger(scope: string) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) => emit('debug', scope, message, meta),
    info: (message: string, meta?: Record<string, unknown>) => emit('info', scope, message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => emit('warn', scope, message, meta),
    error: (message: string, meta?: Record<string, unknown>) => emit('error', scope, message, meta),
  };
}

/**
 * Strip credentials that can leak through connection strings or provider error bodies
 * (for example a Postgres URL containing a password). Used before logging an error.
 */
export function redact(value: string): string {
  return value
    .replace(/:\/\/[^@\s/]+@/g, '://<redacted>@')
    .replace(/(api[_-]?key|authorization|bearer|password|token)["'\s:=]+[^\s"',]+/gi, '$1=<redacted>');
}
