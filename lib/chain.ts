/**
 * lib/chain.ts — the browser's copy of the flight-recorder hash chain.
 *
 * The offline verifier must be able to re-check a bundle **without trusting the server**, so this
 * is a deliberate second implementation of `server/recorder.ts` rather than a shared import: the
 * server hashes with `node:crypto`, the browser hashes with WebCrypto. Both must produce the same
 * bytes, so the two rules that matter are repeated here verbatim:
 *
 *  1. `payload` is hashed as the *exact stored string*, never re-serialised.
 *  2. `hash = SHA-256(prevHash | runId | seq | ts | type | payloadText)`, with the first event
 *     chaining off `GENESIS`.
 *
 * `scripts/chain-compat.mjs` asserts the two implementations agree; if they ever drift, that
 * script fails rather than a demo.
 */

/** The `prevHash` of the first event of every run. */
export const GENESIS = '0'.repeat(64);

/**
 * Stable JSON serialisation: object keys sorted, `undefined` values dropped.
 * Arrays keep their order because order is meaningful inside an event payload.
 */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map(canonical).join(',') + ']';
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (
      '{' +
      Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + canonical(record[key]))
        .join(',') +
      '}'
    );
  }
  // JSON.stringify(undefined) returns undefined; normalise it so the hash input is always a string.
  return JSON.stringify(value) ?? 'null';
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/**
 * Hash one link of the chain.
 *
 * @param payloadText the exact string stored in `events.payload` — a re-serialised object would
 *        produce a different hash and fake a tamper.
 */
export async function computeHash(
  prevHash: string,
  runId: string,
  seq: number,
  ts: number,
  type: string,
  payloadText: string,
): Promise<string> {
  const input = `${prevHash}|${runId}|${seq}|${ts}|${type}|${payloadText}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return toHex(digest);
}

/** One event as it travels in an exported bundle (`GET /api/runs/[id]/bundle`). */
export interface ChainEvent {
  seq: number;
  ts: number;
  type: string;
  payload: string;
  prevHash: string;
  hash: string;
}

export interface ChainVerdict {
  ok: boolean;
  /** Sequence number of the first event whose hash does not match, or null when intact. */
  brokenAt: number | null;
  /** Hash of the last event, or GENESIS for an empty run. */
  head: string;
}

/**
 * Recompute the whole chain from a bundle and compare it with the stored hashes.
 * Pure: it reads the array it is given and touches nothing else.
 */
export async function verifyChain(runId: string, events: ChainEvent[]): Promise<ChainVerdict> {
  let prev = GENESIS;

  for (const event of events) {
    const expected = await computeHash(prev, runId, event.seq, event.ts, event.type, event.payload);
    if (event.prevHash !== prev || event.hash !== expected) {
      return { ok: false, brokenAt: event.seq, head: prev };
    }
    prev = event.hash;
  }

  return { ok: true, brokenAt: null, head: prev };
}
