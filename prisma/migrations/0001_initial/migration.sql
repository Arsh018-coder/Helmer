-- Migration 0001: initial schema
-- Creates all five tables that match schema.prisma.
-- Run via: npx prisma migrate deploy (team lead only, against the shared Supabase project).

-- runs
CREATE TABLE "runs" (
  "id"         TEXT         NOT NULL,
  "goal"       TEXT         NOT NULL,
  "status"     TEXT         NOT NULL,
  "contract"   TEXT,
  "plan"       TEXT,
  "resultPath" TEXT,
  "budget"     TEXT         NOT NULL,
  "verdict"    TEXT,
  "workerTag"  TEXT         NOT NULL,
  "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "finishedAt" TIMESTAMPTZ,
  CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- events — payload is TEXT (not JSONB) so jsonb key-reordering never breaks hashes
CREATE TABLE "events" (
  "runId"    TEXT    NOT NULL,
  "seq"      INTEGER NOT NULL,
  "ts"       FLOAT8  NOT NULL,
  "type"     TEXT    NOT NULL,
  "payload"  TEXT    NOT NULL,
  "prevHash" TEXT    NOT NULL,
  "hash"     TEXT    NOT NULL,
  CONSTRAINT "events_pkey" PRIMARY KEY ("runId", "seq"),
  CONSTRAINT "events_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id")
);

-- commands
CREATE TABLE "commands" (
  "id"         SERIAL       NOT NULL,
  "runId"      TEXT         NOT NULL,
  "kind"       TEXT         NOT NULL,
  "payload"    TEXT         NOT NULL DEFAULT '{}',
  "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "consumedAt" TIMESTAMPTZ,
  CONSTRAINT "commands_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commands_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id")
);

-- artifacts
CREATE TABLE "artifacts" (
  "runId"     TEXT        NOT NULL,
  "name"      TEXT        NOT NULL,
  "content"   TEXT        NOT NULL,
  "bytes"     INTEGER     NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "artifacts_pkey" PRIMARY KEY ("runId", "name")
);

-- workers
CREATE TABLE "workers" (
  "tag"    TEXT        NOT NULL,
  "seenAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "workers_pkey" PRIMARY KEY ("tag")
);
