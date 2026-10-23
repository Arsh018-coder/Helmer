/**
 * server/errors.ts — the single error type crossing module boundaries.
 *
 * Why: route handlers must never leak a raw Prisma or fetch exception to the client,
 * and they must all return the same JSON envelope. `AppError` carries the HTTP status
 * and a stable machine-readable `code` so the frontend can branch on it, while
 * `handleRoute` (server/http.ts) is the only place that turns it into a Response.
 *
 * Error codes used by the API (documented in docs/CONTRACT.md):
 *   unauthorized | invalid_code | run_active | not_found | no_artifact |
 *   tamper_disabled | bad_request | internal
 */

export class AppError extends Error {
  /** HTTP status to send when this error reaches the route boundary. */
  readonly status: number;
  /** Stable machine-readable code; never a free-form sentence. */
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

/** 400 — the request body, query or path param failed validation. */
export function badRequest(message: string): AppError {
  return new AppError(400, 'bad_request', message);
}

/** 401 — no valid access code and no valid share token for this run. */
export function unauthorizedError(message = 'Access code required'): AppError {
  return new AppError(401, 'unauthorized', message);
}

/** 404 — the run, artifact or resource does not exist. */
export function notFound(message = 'Resource not found'): AppError {
  return new AppError(404, 'not_found', message);
}

/** 409 — the worker tag already has an active run. */
export function runActive(message: string): AppError {
  return new AppError(409, 'run_active', message);
}

/** 401 — the supplied access code was well-formed but wrong. */
export function invalidCode(message = 'Invalid access code'): AppError {
  return new AppError(401, 'invalid_code', message);
}

/** 404 — the run exists but no deliverable has been written yet. */
export function noArtifact(message = 'This run has no artifact yet'): AppError {
  return new AppError(404, 'no_artifact', message);
}

/** 403 — the demo-only tamper route was called while ALLOW_TAMPER is off. */
export function tamperDisabled(message = 'Tamper is disabled on this deployment'): AppError {
  return new AppError(403, 'tamper_disabled', message);
}
