/**
 * server/auth.ts — the two ways a caller may prove it is allowed in.
 *
 * 1. Access code: `X-Access-Code: <ACCESS_CODE>` on every API route. Compared in
 *    constant time so the response cannot be used as a timing oracle.
 * 2. Share token: `?t=<token>` scoped to exactly one run and valid for two hours. This
 *    is what the phone Steer page uses, so a phone never holds the project-wide code.
 *
 * Values come from `server/config.ts`; this module never reads `process.env` itself.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config';
import { SHARE_TOKEN_TTL_MS } from './constants';
import { unauthorizedError } from './errors';

/** Length-independent constant-time string compare. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

// ─────────────────────────────────────────────────────────────────────────────
// Access code
// ─────────────────────────────────────────────────────────────────────────────

/** True when `code` matches ACCESS_CODE. Used by `POST /api/auth` and the header check. */
export function verifyAccessCode(code: string): boolean {
  const expected = config.accessCode;
  if (!expected) return false;
  return safeEqual(code, expected);
}

/**
 * True when the request carries a valid `X-Access-Code` header.
 * @throws Error when ACCESS_CODE is not configured (a server misconfiguration, not a 401).
 */
export function checkAccessCode(request: Request): boolean {
  const provided = request.headers.get('X-Access-Code');
  if (!provided) return false;
  return verifyAccessCode(provided);
}

/**
 * Enforce full access on a route.
 * @throws AppError 401 `unauthorized` when the header is missing or wrong.
 */
export function requireAccessCode(request: Request): void {
  if (!checkAccessCode(request)) {
    throw unauthorizedError('Valid X-Access-Code header required');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Share tokens
// ─────────────────────────────────────────────────────────────────────────────

function sign(runId: string, expiry: number): string {
  return createHmac('sha256', config.secretKey).update(`${runId}.${expiry}`).digest('hex');
}

/**
 * Sign a share token for one run.
 * Format: `<runId>.<expiry>.<hmac>` where `expiry` is a ms-since-epoch timestamp.
 */
export function signShareToken(runId: string): string {
  const expiry = Date.now() + SHARE_TOKEN_TTL_MS;
  return `${runId}.${expiry}.${sign(runId, expiry)}`;
}

/**
 * Verify a share token.
 * @returns the run id the token was issued for, or null when malformed, forged or expired.
 */
export function verifyShareToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [runId, expiryText, provided] = parts;
  const expiry = Number.parseInt(expiryText, 10);
  if (!Number.isInteger(expiry)) return null;

  // Signature first: rejecting an expired-but-valid token later avoids leaking which
  // part of the token was wrong.
  if (!safeEqual(provided, sign(runId, expiry))) return null;
  if (Date.now() > expiry) return null;

  return runId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined check used by run-scoped routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * True when the request may act on `runId`, either through the access code or through a
 * share token issued for that same run. A token for another run is rejected.
 */
export function isRunAuthorized(request: Request, runId: string): boolean {
  if (checkAccessCode(request)) return true;

  const token = new URL(request.url).searchParams.get('t');
  if (!token) return false;

  return verifyShareToken(token) === runId;
}

/**
 * Enforce run-scoped access.
 * @throws AppError 401 `unauthorized` when neither credential is valid for this run.
 */
export function requireRunAuth(request: Request, runId: string): void {
  if (!isRunAuthorized(request, runId)) {
    throw unauthorizedError('Provide X-Access-Code or a share token for this run');
  }
}
