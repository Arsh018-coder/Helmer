-- Migration 0002: enable Row Level Security on all five tables.
--
-- Why: Supabase exposes every public-schema table through its REST API using the
-- anon key. With RLS enabled and no policies, that REST API returns nothing.
-- Prisma connects with the Postgres role directly and is unaffected — all reads
-- and writes go through our own Next.js API routes which check the access code.
--
-- This is a raw-SQL migration because Prisma's schema DSL has no @rls directive.

ALTER TABLE "runs"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commands"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "artifacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workers"   ENABLE ROW LEVEL SECURITY;
