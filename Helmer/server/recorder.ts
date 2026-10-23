/**
 * server/recorder.ts — the append-only, hash-chained flight recorder.
 *
 * This is the reliability core of Helmer: every meaningful thing the agent does is an
 * event appended through `appendEvent`, and `verifyChain` can later prove that no row
 * was edited without being detected (AGENTS.md section 7).
 *
 * Two invariants make the chain verifiable:
 *  1. `payload` is stored as canonical JSON text (sorted keys, `undefined` dropped) so
 *     the same logical payload always produces the same bytes. It is hashed as the
 *     exact stored string, never re-serialised at verification time.
 *  2. Each row hashes its predecessor, so changing any row breaks every later hash.
 *
 * Honesty note: anyone with database write access can recompute the whole chain.
 * The chain makes edits *detectable*, especially when the head hash is pinned outside
 * the database (that is what the offline verifier and the share link are for).
 */

import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

/** The `prevHash` of the first event in every run. */
export const GENESIS = '0'.repeat(64);

/** Lowercase hex, 64 characters — the shape of every hash this module produces. */
const HASH_PATTERN = /^[0-9a-f]{64}$/;

/** How many times `appendEvent` retries when a concurrent writer took the seq. */
const SEQ_RETRY_ATTEMPTS = 3;

/**
 * Stable JSON serialisation: object keys sorted, `undefined` values dropped.
 * Arrays keep their order because order is meaningful in event payloads.
 *
 * Exported because the offline verifier and the tests must use the exact same bytes.
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
  // JSON.stringify(undefined) returns undefined; normalise it to a JSON null so the
  // function always returns a string and never corrupts the hash input.
  return JSON.stringify(value) ?? 'null';
}

/**
 * Hash one link of the chain.
 *
 * `payloadText` must be the exact string stored in `events.payload`. Passing a
 * re-serialised object would produce a different hash and fake a tamper.
 */
export function computeHash(
  prevHash: string,
  runId: string,
  seq: number,
  ts: number,
  type: string,
  payloadText: string,
): string {
  return createHash('sha256')
    .update(`${prevHash}|${runId}|${seq}|${ts}|${type}|${payloadText}`)
    .digest('hex');
}

/** Narrow view of the Prisma client so this module works in Next and in the worker. */
export type RecorderDb = Pick<PrismaClient, 'event'>;

/**
 * Append one event to a run's chain and return its sequence number.
 *
 * The `(runId, seq)` primary key is the guard: if two writers race, one gets P2002 and
 * starts over. The run is only ever written by one worker, so a retry costs nothing.
 *
 * @throws Error when no free sequence number can be obtained after three attempts.
 */
export async function appendEvent(
  db: RecorderDb,
  runId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<number> {
  for (let attempt = 0; attempt < SEQ_RETRY_ATTEMPTS; attempt++) {
    const last = await db.event.findFirst({
      where: { runId },
      orderBy: { seq: 'desc' },
      select: { seq: true, hash: true },
    });

    const seq = (last?.seq ?? 0) + 1;
    const prevHash = last?.hash ?? GENESIS;
    const ts = Date.now();
    const body = canonical(payload);

    try {
      await db.event.create({
        data: {
          runId,
          seq,
          ts,
          type,
          payload: body,
          prevHash,
          hash: computeHash(prevHash, runId, seq, ts, type, body),
        },
      });
      return seq;
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      // P2002 = unique constraint on (runId, seq); another writer took this seq.
    }
  }
  throw new Error(`appendEvent: could not obtain a free seq for run ${runId}`);
}

export interface ChainVerdict {
  ok: boolean;
  /** Sequence number of the first event whose hash does not match, or null when intact. */
  brokenAt: number | null;
  /** Hash of the last event, or GENESIS for an empty run. */
  head: string;
}

/**
 * Recompute the whole chain from the stored rows and compare it with the stored hashes.
 * Pure with respect to the database: it reads, never writes.
 */
export async function verifyChain(db: RecorderDb, runId: string): Promise<ChainVerdict> {
  const rows = await db.event.findMany({
    where: { runId },
    orderBy: { seq: 'asc' },
    select: { seq: true, ts: true, type: true, payload: true, prevHash: true, hash: true },
  });

  let prev = GENESIS;
  for (const row of rows) {
    const expected = computeHash(prev, runId, row.seq, row.ts, row.type, row.payload);
    if (row.prevHash !== prev || row.hash !== expected) {
      return { ok: false, brokenAt: row.seq, head: prev };
    }
    prev = row.hash;
  }
  return { ok: true, brokenAt: null, head: prev };
}

/** Largest sequence number currently stored for a run (0 when the run has no events). */
export async function lastSeq(db: RecorderDb, runId: string): Promise<number> {
  const last = await db.event.findFirst({
    where: { runId },
    orderBy: { seq: 'desc' },
    select: { seq: true },
  });
  return last?.seq ?? 0;
}

/** True when `value` looks like a SHA-256 hex digest, used to validate pinned head hashes. */
export function isHash(value: string): boolean {
  return HASH_PATTERN.test(value);
}
