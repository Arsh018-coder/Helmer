/**
 * scripts/export-run.ts — record a real run as the offline replay fixture (feature F3).
 *
 * The landing hero must play a **real** run with zero database access, so this script writes the
 * same bundle `GET /api/runs/[id]/bundle` returns to stdout, and the caller redirects it into
 * `public/fixtures/golden_run.json` (Next serves anything under `public/` at the site root).
 *
 * It refuses to export a run whose chain does not verify: shipping a recording we cannot prove
 * would defeat the point of the fixture.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.worker.json scripts/export-run.ts <run_id> \
 *     > public/fixtures/golden_run.json
 *
 * stdout is the fixture file, so nothing else may be written there — diagnostics go to stderr,
 * which is why this script does not use the shared `server/logger.ts` (its info level is stdout).
 *
 * `dotenv/config` is imported first because this script runs under `tsx`, not Next.js: nothing has
 * loaded `.env` for it, and the database client needs `DATABASE_URL` before it connects.
 */

import 'dotenv/config';

import { db } from '../server/db.js';
import { exportBundle } from '../server/events.js';
import { logger, redact } from '../server/logger.js';
import { verifyChain } from '../server/recorder.js';

const log = logger('export-run');

async function main(): Promise<void> {
  const runId = process.argv[2];
  if (!runId) {
    process.stderr.write('Usage: tsx scripts/export-run.ts <run_id> > public/fixtures/golden_run.json\n');
    process.exitCode = 1;
    return;
  }

  const verdict = await verifyChain(db, runId);
  if (!verdict.ok) {
    throw new Error(`Refusing to export: the chain for ${runId} is broken at event ${verdict.brokenAt}`);
  }

  const bundle = await exportBundle(db, runId);

  // The JSON *is* the output; everything else would corrupt the redirect.
  process.stdout.write(JSON.stringify(bundle, null, 2) + '\n');
  process.stderr.write(`Exported ${bundle.events.length} events from ${runId} (head ${bundle.head.slice(0, 12)}…)\n`);
}

main()
  .catch((error: unknown) => {
    log.error('export failed', { error: redact(error instanceof Error ? error.message : String(error)) });
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
