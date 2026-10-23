/**
 * server/events.ts — reads of the flight recorder, shared by every route handler.
 *
 * Route handlers must stay thin (AGENTS.md section 19), so the queries live here: the polling
 * endpoint, the offline-verifier bundle export, and the demo-only tamper edit.
 *
 * Nothing here writes to the chain except `tamperEventPayload`, which exists precisely because it
 * breaks the rules: it edits a stored payload *without* recomputing hashes, so `verifyChain` can
 * show the break. It is only reachable when ALLOW_TAMPER=1.
 */

import type { PrismaClient } from '@prisma/client';
import { EVENT_PAGE_LIMIT } from './constants';
import { notFound } from './errors';
import { GENESIS } from './recorder';

/** One row of `events`, with the payload kept as the exact stored text. */
export interface EventRecord {
  runId: string;
  seq: number;
  ts: number;
  type: string;
  payload: string;
  prevHash: string;
  hash: string;
}

/** Bundle shape consumed by the browser-side offline verifier (`lib/verifyBundle.ts`). */
export interface RunBundle {
  runId: string;
  events: EventRecord[];
  head: string;
}

const EVENT_SELECT = {
  runId: true,
  seq: true,
  ts: true,
  type: true,
  payload: true,
  prevHash: true,
  hash: true,
} as const;

/**
 * Events after `afterSeq`, oldest first.
 *
 * The cursor is what makes polling cheap: the browser keeps the last seq it saw and asks only for
 * what is new.
 */
export async function listEvents(
  db: PrismaClient,
  runId: string,
  afterSeq: number,
): Promise<EventRecord[]> {
  return db.event.findMany({
    where: { runId, seq: { gt: afterSeq } },
    orderBy: { seq: 'asc' },
    take: EVENT_PAGE_LIMIT,
    select: EVENT_SELECT,
  });
}

/**
 * Export everything needed to re-verify a run somewhere else.
 *
 * @throws AppError 404 `not_found` when the run has no events, which means the id is wrong.
 */
export async function exportBundle(db: PrismaClient, runId: string): Promise<RunBundle> {
  const events = await db.event.findMany({
    where: { runId },
    orderBy: { seq: 'asc' },
    select: EVENT_SELECT,
  });

  if (events.length === 0) throw notFound(`Run ${runId} has no events to export`);

  return { runId, events, head: events[events.length - 1].hash };
}

/** The stored head hash of a run, or GENESIS when the run has no events yet. */
export async function headHash(db: PrismaClient, runId: string): Promise<string> {
  const last = await db.event.findFirst({
    where: { runId },
    orderBy: { seq: 'desc' },
    select: { hash: true },
  });
  return last?.hash ?? GENESIS;
}

/**
 * Overwrite one event's payload **without** touching its hash.
 *
 * This is the tamper demo. Raw SQL is used because Prisma's typed update would look like a normal
 * write; the missing hash recomputation is the whole point. Each affected row count is returned so
 * the caller can tell a real edit from a wrong seq.
 */
export async function tamperEventPayload(
  db: PrismaClient,
  runId: string,
  seq: number,
  payload: string,
): Promise<number> {
  const affected = await db.$executeRaw`
    UPDATE events
    SET payload = ${payload}
    WHERE "runId" = ${runId} AND seq = ${seq}
  `;
  return affected;
}
