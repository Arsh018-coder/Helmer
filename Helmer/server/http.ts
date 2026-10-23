/**
 * server/http.ts — the single boundary between thrown errors and HTTP responses.
 *
 * AGENTS.md section 19 requires every route handler to be thin: parse input, call one
 * function in `server/`, return a response. `handleRoute` removes the repeated
 * try/catch, guarantees a consistent error envelope and makes sure no unexpected
 * exception (Prisma, fetch, a bug) ever reaches the client as a stack trace.
 *
 * Success responses are returned directly by the handler; only failures pass through
 * the envelope below, matching docs/CONTRACT.md.
 */

import { ZodError } from 'zod';
import { AppError } from './errors';
import { logger as createLogger, redact } from './logger';

const log = createLogger('http');

interface ErrorBody {
  ok: false;
  error: string;
  message: string;
}

function errorResponse(status: number, code: string, message: string): Response {
  const body: ErrorBody = { ok: false, error: code, message };
  return Response.json(body, { status });
}

/** JSON success helper so handlers read as one statement. */
export function okJson<T>(data: T, status = 200): Response {
  return Response.json({ ok: true, ...data }, { status });
}

/**
 * Wrap a route handler so any thrown error becomes a JSON response.
 *
 * The returned function keeps Next's `(request, context)` signature; `scope` is used
 * for log lines only (`runs`, `events`, `commands`, …).
 */
export function handleRoute<Ctx>(
  scope: string,
  handler: (request: Request, context: Ctx) => Promise<Response>,
): (request: Request, context: Ctx) => Promise<Response> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof AppError) {
        if (error.status >= 500) log.error(`${scope}: ${error.code}`, { message: error.message });
        return errorResponse(error.status, error.code, error.message);
      }

      if (error instanceof ZodError) {
        // Zod issues are safe to expose: they describe the request, not the server.
        const message = error.issues
          .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
          .join('; ');
        return errorResponse(400, 'bad_request', message);
      }

      const message = error instanceof Error ? error.message : String(error);
      log.error(`${scope}: unhandled error`, { message: redact(message) });
      return errorResponse(500, 'internal', 'Unexpected server error');
    }
  };
}
