/**
 * server/artifacts.ts — reads of the `artifacts` table.
 *
 * `write_file` stores the deliverable as a row (never on disk) so the web app and the worker
 * can run on different machines and a phone can still download the result. This module is the
 * read side of that contract; the download route stays thin by calling `getDeliverable`.
 */

import type { PrismaClient } from '@prisma/client';
import { notFound, noArtifact } from './errors';

/** One stored deliverable, ready to send to the browser. */
export interface Deliverable {
  name: string;
  content: string;
  bytes: number;
  createdAt: string;
}

const ARTIFACT_SELECT = {
  name: true,
  content: true,
  bytes: true,
  createdAt: true,
} as const;

function toDeliverable(row: {
  name: string;
  content: string;
  bytes: number;
  createdAt: Date;
}): Deliverable {
  return {
    name: row.name,
    content: row.content,
    bytes: row.bytes,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * The deliverable to hand back for a run.
 *
 * The run's `resultPath` names the file the agent declared; when it is set we read exactly
 * that row so a repair pass that rewrote a differently-named file cannot change the answer.
 * Without a declared path we fall back to the most recently written artifact.
 *
 * @throws AppError 404 `not_found` when the run does not exist.
 * @throws AppError 404 `no_artifact` when the run has not produced a file yet.
 */
export async function getDeliverable(db: PrismaClient, runId: string): Promise<Deliverable> {
  const run = await db.run.findUnique({
    where: { id: runId },
    select: { resultPath: true },
  });
  if (!run) throw notFound(`Run ${runId} not found`);

  const row = run.resultPath
    ? await db.artifact.findUnique({
        where: { runId_name: { runId, name: run.resultPath } },
        select: ARTIFACT_SELECT,
      })
    : null;

  const resolved =
    row ??
    (await db.artifact.findFirst({
      where: { runId },
      orderBy: { createdAt: 'desc' },
      select: ARTIFACT_SELECT,
    }));

  if (!resolved) throw noArtifact(`Run ${runId} has not written a deliverable yet`);

  return toDeliverable(resolved);
}
