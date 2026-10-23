/**
 * server/runs.ts — run lifecycle queries shared by the API and the worker.
 *
 * Everything that reads or writes the `runs` table lives here, so route handlers stay
 * thin (AGENTS.md section 19) and the worker uses exactly the same shapes the UI sees.
 * Budgets are stored as JSON text on the row and parsed here into `BudgetConfig`.
 */

import { randomBytes } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  ACTIVE_STATUSES,
  RUN_ID_LENGTH,
  RUN_STATUS,
  type RunStatus,
  type Verdict,
} from './constants';
import { defaultBudget, type BudgetConfig } from './config';
import { notFound, runActive } from './errors';
import type { ContractInput } from './validation';
import type { PlanInput } from './validation';

/**
 * Alphabet for generated run ids: no 0/O/1/l/i, so a run id can be read aloud on stage
 * or typed from a shared screen without ambiguity.
 */
const RUN_ID_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

/** Generate an 8-character run id using the platform CSPRNG (not Math.random). */
export function generateRunId(): string {
  const bytes = randomBytes(RUN_ID_LENGTH);
  let id = '';
  for (let i = 0; i < RUN_ID_LENGTH; i++) {
    id += RUN_ID_ALPHABET[bytes[i] % RUN_ID_ALPHABET.length];
  }
  return id;
}

/** Columns the list endpoint returns; kept explicit to avoid over-fetching. */
const RUN_SUMMARY_SELECT = {
  id: true,
  goal: true,
  status: true,
  verdict: true,
  createdAt: true,
  finishedAt: true,
} satisfies Prisma.RunSelect;

export interface RunSummary {
  id: string;
  goal: string;
  status: RunStatus;
  verdict: Verdict | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface RunDetail extends RunSummary {
  contract: ContractInput | null;
  plan: PlanInput | null;
  budget: BudgetConfig;
}

/** Parse the JSON text stored in `runs.budget`, falling back to the configured defaults. */
export function parseBudget(raw: string): BudgetConfig {
  try {
    const parsed = JSON.parse(raw) as Partial<BudgetConfig>;
    return { ...defaultBudget(), ...parsed };
  } catch {
    return defaultBudget();
  }
}

function parseJsonColumn<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function toSummary(row: {
  id: string;
  goal: string;
  status: string;
  verdict: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}): RunSummary {
  return {
    id: row.id,
    goal: row.goal,
    status: row.status as RunStatus,
    verdict: row.verdict as Verdict | null,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

/** Newest-first run list for the console and history pages. */
export async function listRuns(db: PrismaClient, limit = 50): Promise<RunSummary[]> {
  const rows = await db.run.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: RUN_SUMMARY_SELECT,
  });
  return rows.map(toSummary);
}

/**
 * Fetch one run with its contract, plan and budget.
 * @throws AppError 404 `not_found` when the id does not exist.
 */
export async function getRunDetail(db: PrismaClient, id: string): Promise<RunDetail> {
  const row = await db.run.findUnique({
    where: { id },
    select: {
      ...RUN_SUMMARY_SELECT,
      contract: true,
      plan: true,
      budget: true,
    },
  });
  if (!row) throw notFound(`Run ${id} not found`);

  return {
    ...toSummary(row),
    contract: parseJsonColumn<ContractInput>(row.contract),
    plan: parseJsonColumn<PlanInput>(row.plan),
    budget: parseBudget(row.budget),
  };
}

/** Raw status only — used by the polling endpoint where the whole row is not needed. */
export async function getRunStatus(db: PrismaClient, id: string): Promise<RunStatus> {
  const row = await db.run.findUnique({ where: { id }, select: { status: true } });
  if (!row) throw notFound(`Run ${id} not found`);
  return row.status as RunStatus;
}

/**
 * The run blocking a new one for this worker tag, if any.
 *
 * One agent run at a time protects the free-tier LLM limits, and this is enforced in the
 * database rather than in memory (AGENTS.md section 2) so two tabs cannot start two runs.
 */
export async function findActiveRun(db: PrismaClient, workerTag: string): Promise<RunSummary | null> {
  const row = await db.run.findFirst({
    where: { workerTag, status: { in: [...ACTIVE_STATUSES] } },
    orderBy: { createdAt: 'asc' },
    select: RUN_SUMMARY_SELECT,
  });
  return row ? toSummary(row) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a queued run owned by `workerTag`.
 * @throws AppError 409 `run_active` when this tag already has an active run.
 */
export async function createRun(
  db: PrismaClient,
  input: { goal: string; budget?: Partial<BudgetConfig>; workerTag: string },
): Promise<string> {
  const active = await findActiveRun(db, input.workerTag);
  if (active) {
    const ageMs = Date.now() - (Date.parse(active.createdAt) || 0);
    // If previous run is paused or stale (>90s), auto-stop it so the new run can proceed immediately without blocking!
    if (active.status === 'paused' || ageMs > 90_000) {
      await db.run.update({
        where: { id: active.id },
        data: { status: RUN_STATUS.stopped, finishedAt: new Date() },
      });
    } else {
      throw runActive(`Run ${active.id} is still ${active.status}; stop it before starting another`);
    }
  }

  const budget: BudgetConfig = { ...defaultBudget(), ...input.budget };

  // Retry only on the (vanishingly unlikely) primary-key collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = generateRunId();
    try {
      await db.run.create({
        data: {
          id,
          goal: input.goal,
          status: RUN_STATUS.queued,
          budget: JSON.stringify(budget),
          workerTag: input.workerTag,
        },
      });
      return id;
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
    }
  }
  throw new Error('createRun: could not allocate a unique run id');
}

/** Persist the contract the agent generated, so the UI can render it before it is replayed. */
export async function saveContract(db: PrismaClient, runId: string, contract: ContractInput): Promise<void> {
  await db.run.update({ where: { id: runId }, data: { contract: JSON.stringify(contract) } });
}

/** Persist the plan the agent generated. */
export async function savePlan(db: PrismaClient, runId: string, plan: PlanInput): Promise<void> {
  await db.run.update({ where: { id: runId }, data: { plan: JSON.stringify(plan) } });
}

/**
 * Write the terminal state of a run in one statement so `status`, `verdict` and
 * `resultPath` can never disagree with each other.
 */
export async function finishRun(
  db: PrismaClient,
  runId: string,
  state: { status: RunStatus; verdict?: Verdict | null; resultPath?: string | null },
): Promise<void> {
  await db.run.update({
    where: { id: runId },
    data: {
      status: state.status,
      verdict: state.verdict ?? undefined,
      resultPath: state.resultPath ?? undefined,
      finishedAt: new Date(),
    },
  });
}
