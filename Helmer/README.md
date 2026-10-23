# Helmer

**Autonomous agents with a black box recorder and a stop button.**

The user types one goal. Helmer turns it into an explicit *contract* (what "done" means), plans,
uses real tools, recovers from failures, checks its own result against the contract, and delivers a
file. Every step is visible, steerable (pause / redirect / stop), stored in a hash-chained log, and
replayable. See `AGENTS.md` for the full product definition and build plan.

---

## 📚 Documentation & Guides

- 🗺️ **[Project Map & Directory Guide](file:///c:/Users/ldhim/Documents/GitHub/Helmer/Helmer/docs/PROJECT_MAP.md)**: Find any file or feature instantly.
- 🏗️ **[System Architecture](file:///c:/Users/ldhim/Documents/GitHub/Helmer/Helmer/docs/ARCHITECTURE.md)**: Full 3-tier system design & Merkle flight recorder breakdown.
- 🏆 **[Hackathon Judges' Guide](file:///c:/Users/ldhim/Documents/GitHub/Helmer/Helmer/docs/JUDGES_GUIDE.md)**: Key innovations & 2-minute demo pitch.

---

## Architecture

```
                ┌────────────────────────┐        ┌─────────────────────────┐
   browser ───▶ │  Next.js (App Router)  │ ─────▶ │  Supabase Postgres      │
   (polls every │  app/**  + app/api/**  │ Prisma │  runs / events / …      │
    700 ms)     └────────────────────────┘        └─────────────────────────┘
                                                            ▲
                ┌────────────────────────┐                  │ Prisma
                │  worker/ (Node + tsx)  │ ─────────────────┘
                │  claims queued runs    │
                │  runs the agent loop   │
                └────────────────────────┘
```

- **Web** (`app/`) renders the UI and serves the JSON API from route handlers. It never runs the
  agent loop.
- **Worker** (`worker/index.ts`) is a plain Node process. It claims a queued run with an atomic
  `UPDATE … FOR UPDATE SKIP LOCKED`, runs the agent loop, and repeats. A run can last minutes and
  must be able to pause, which is why it is not a serverless function.
- **Database** (Supabase Postgres via Prisma) is the only shared state. The browser polls
  `/api/runs/[id]/events?after=<seq>` for new events; there is no in-memory state in the web tier.
- `components/AppShell.tsx` is a single client component that renders every page from the live event
  list through the pure reducer `lib/reduceEvents.ts`.

The shared agent code lives in `server/` (recorder, config, auth, agent loop, tools). Both the route
handlers and the worker import it with relative paths, because the worker runs under `tsx` outside
Next.js and cannot use the `@/` alias.

---

## Prerequisites

- **Node.js 20 or newer**
- A **Supabase Postgres** project (or any Postgres). Free tier is fine.
- An **OpenAI-compatible LLM endpoint** and key (Gemini, Groq, OpenAI, a local Ollama, …).
- Optional: a keyed search provider (Tavily / Brave / Serper). Without one, the agent falls back to
  the keyless Wikipedia API.

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file and fill it in (see the table below)
cp .env.example .env          # Windows: copy .env.example .env

# 3. Create the database tables
npm run db:generate
npm run db:deploy             # first machine on a fresh DB: npm run db:migrate
```

> Only one person on the team runs `prisma migrate dev`. Everyone else runs `npm run db:deploy`.
> Never run `prisma migrate reset` against the shared database (`AGENTS.md` section 17).

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Pooled Postgres connection used by the running app (port `6543`, `?pgbouncer=true`). Each Prisma process defaults to at most 5 connections and waits up to 20 seconds for a pool connection; existing `connection_limit` and `pool_timeout` URL values are preserved. |
| `DIRECT_URL` | yes | Direct / session-pooler connection used by migrations (port `5432`). |
| `ACCESS_CODE` | yes | Gate for the console and run creation; sent as the `X-Access-Code` header. |
| `SECRET_KEY` | yes | HMAC key for the per-run share tokens used by the phone Steer page. |
| `LLM_BASE_URL` | yes | Base URL of the OpenAI-compatible endpoint. |
| `LLM_API_KEY` | yes | Key for that endpoint. |
| `LLM_MODEL` | yes | Model name (e.g. `gemini-2.5-flash`). |
| `SEARCH_PROVIDER` | no | `tavily` \| `brave` \| `wikipedia_only`. Defaults to the Wikipedia fallback. |
| `SEARCH_API_KEY` | no | Key for the chosen search provider. |
| `WORKER_TAG` | yes | Which worker may claim a run. Each developer sets their own; the demo machine uses `prod`. |
| `MAX_STEPS` / `MAX_SECONDS` / `MAX_LLM_CALLS` | no | Run budgets. Defaults `8` / `180` / `25`. |
| `ALLOW_TAMPER` | no | `1` enables the demo-only Tamper button. |
| `PORT` | no | Next.js port. Defaults to `3000`. |

Secrets live only in `.env`, which is never committed. The Supabase service role key and the
database password never reach the browser.

---

## Running the app

```bash
npm run dev
```

Starts **both** processes together under `concurrently`:

- `next dev` — the web app on <http://localhost:3000>
- `npm run worker` — the agent worker

Run them separately when you want the logs in two terminals:

```bash
npm run dev:next      # terminal 1
npm run worker        # terminal 2
```

Production build on one machine:

```bash
npm run build
npm run start         # Next on :3000
npm run worker        # in a second terminal
```

Verify everything is up before a demo — `GET /api/health` returns
`{ ok, db_reachable, llm_reachable, worker_alive, version }`. `worker_alive` comes from the worker's
heartbeat row; if it is `false`, runs will stay queued.

### Accessing it from a phone

The Steer view (`/r/[id]?t=<share-token>`) is reached by scanning the QR popover in the run view.
Expose the laptop to the phone on the same Wi-Fi with `npx next start -H 0.0.0.0` and open
`http://<lan-ip>:3000`, or use a tunnel such as `cloudflared tunnel --url http://localhost:3000`.

---

## Recording the offline replay fixture

The landing hero replays a real, previously recorded run so it works with zero network access. The
fixture is served from `public/` at the site root:

```bash
npx tsx --tsconfig tsconfig.worker.json scripts/export-run.ts <run_id> \
  > public/fixtures/golden_run.json
```

The script refuses to export a run whose hash chain is broken, writes the JSON bundle to stdout
(hence the redirect), and prints its progress to stderr.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next + worker together (`concurrently`). |
| `npm run dev:next` | Next dev server only. |
| `npm run worker` | The agent worker only. |
| `npm run build` | Production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | ESLint via `next lint`. |
| `npm run db:generate` | Prisma client generation. |
| `npm run db:deploy` | Apply committed migrations (all teammates). |
| `npm run db:migrate` | Create a migration (team lead only, needs a fresh DB). |
| `npm run clean` | Remove `dist/`, `.next/`, `server.js`. |

---

## Demo walkthrough

1. Open `/console`, enter the access code, and type a goal (or pick a preset).
2. The agent writes a contract and a plan; the timeline fills with reasoning and real tool calls.
3. Open the chaos menu and break `search_web` mid-run: the error is badged `INJECTED` and the
   recovery ladder retries, falls back, then replans.
4. Scan the QR code to steer from a phone: pause, redirect, resume.
5. At the end, review the deliverable and each criterion's pass/fail with evidence.
6. Press **Verify log** (green). Press **Tamper** to break one event, then verify again — the chain
   reports the exact event where it broke.
7. **Export bundle** and paste it into `/verify` with the pinned head hash to check the chain in the
   browser, without trusting the server.

---

Built by devX · CGC University, Mohali · HACK-O-OCTO 4.0 (PS01).
