# docs/AUDIT.md — Helmer B0 Audit

> Read-only audit from Phase B0. No files were changed. Generated from reading every file in the repo.

---

## 1. Executive summary

The real frontend is a **Vite + React SPA**, not a Next.js app. Every value on screen is mock/hardcoded. There are no API calls, no polling hooks, no `lib/` utilities, no `components/` subdirectory, no `fixtures/` directory, no `app/` router directory. The entire application — all six pages, all state, all UI — lives in a single file: `src/App.tsx` (1817 lines).

This is a significant structural mismatch from `AGENTS.md` and `BACKEND_PLAN.md`, which both assume Next.js App Router with specific file locations. The mismatch is a **BLOCKER** that must be resolved before B1.

---

## 2. Visible element audit table

| Page | UI Element | Current data source | What it needs from the backend |
|---|---|---|---|
| **All pages** | Navigation bar | Static HTML | None (stays static) |
| **/** Landing | Hero title / subtitle | Hard-coded strings | None (marketing copy) |
| **/** | Protocol badge "Flight Protocol v4.2 · Verified Deterministic" | **HARD-CODED STRING** | Remove or derive from real version |
| **/** | Robot mascot + beacon "TELEMETRY ACTIVE · 60 FPS" | Hard-coded + animation | None (decorative) |
| **/** | Left card "Continuous Telemetry" / "RUN #0894-F" / "100% AUDITED" | **HARD-CODED STRINGS** | Remove run number and stat, or derive from real run |
| **/** | Right card "< 12ms GUARANTEE" | **HARD-CODED STAT** | This is not measured; must be removed or labeled "target" |
| **/** | Metrics strip: "100% Audit Traceability", "< 12ms Human-in-Loop Halt", "gVisor Sandbox Confinement", "99.98% Autonomous Resilience" | **ALL HARD-CODED** | All must be removed or replaced; gVisor and 99.98% are fabricated |
| **/** | "120k+ Runs Audited Daily" / "0.0ms Unlogged State Drift" | **FABRICATED STATS** | Must be removed |
| **/** | Feature 1 criteria box (SEC EDGAR, ECDSA, etc.) | Hard-coded from `INITIAL_RUNS[0]` | Will come from a real run's `contract_created` event |
| **/** | Hash chain demo (e8a1..390b etc.) | **HARD-CODED FAKE HASHES** | Must eventually show real run hashes |
| **/** | Verify log button on landing | Simulates with `setTimeout` | Must call `GET /api/runs/:id/verify-chain` |
| **/** | Feature 2 chaos console (API Timeout Delay 4500ms, etc.) | Local `useState` | Must show real chaos command state |
| **/** | Feature 3 hash tree nodes ("ROOT_GENESIS_SEED", etc.) | **HARD-CODED FAKE EVENT NAMES** | Must show real event types from DB |
| **/** | Replay section "Deterministic Replay" | Loops over `INITIAL_RUNS[0].steps` via interval | Must loop over real `fixtures/golden_run.json` |
| **/** | Footer / attribution | Hard-coded strings | None (stays static) |
| **/console** | Goal composer textarea | Local `useState` | Sends to `POST /api/runs` |
| **/console** | Preset goal buttons | Hard-coded strings | Stays static |
| **/console** | Run list (recent runs) | `INITIAL_RUNS` array | Must come from `GET /api/runs` |
| **/run/:id** | Contract panel (criteria + plan) | `activeRun.criteria`, `activeRun.plan` from mock | Must come from `contract_created` + `plan_created` events |
| **/run/:id** | Timeline steps | `activeRun.steps` from mock | Must come from polling `GET /api/runs/:id/events` |
| **/run/:id** | Drift score | `activeRun.driftScore` hard-coded | Must come from `drift_check` events |
| **/run/:id** | Budget bars (steps / time / LLM) | `activeRun.stepsBudget` etc. hard-coded | Must come from `budget` field on run + event counts |
| **/run/:id** | Pause / Resume button | Calls `setIsRunPaused` local state | Must call `POST /api/runs/:id/commands` |
| **/run/:id** | Stop button | No-op (UI only) | Must call `POST /api/runs/:id/commands {kind: "stop"}` |
| **/run/:id** | Redirect sheet | Sets `redirectInstruction` local state | Must call `POST /api/runs/:id/commands {kind: "redirect", payload: {instruction}}` |
| **/run/:id** | Chaos menu (Break Tool) | Appends to local `runs` state via `handleBreakTool` | Must call `POST /api/runs/:id/chaos` |
| **/run/:id** | Verify log button | `handleRunVerifyLog` → setTimeout → sets `runVerifyStatus` | Must call `GET /api/runs/:id/verify-chain` |
| **/run/:id** | Tamper button | Sets `isTamperBroken` local state | Must call `POST /api/runs/:id/tamper` |
| **/run/:id** | Head hash display | **HARD-CODED** in component | Must come from `verify-chain` response |
| **/run/:id** | Export bundle button | Not wired (UI element exists visually but no handler) | Must call `GET /api/runs/:id/bundle` |
| **/run/:id** | Deliverable / artifact content | `activeRun.artifactContent` hard-coded | Must come from `GET /api/runs/:id/artifact` |
| **/run/:id** | Incident report | `activeRun.incidentReport` hard-coded | Must come from `incident_report` event |
| **/run/:id** | Verdict + criteria evidence | Hard-coded | Must come from `verify_result` events |
| **/run/:id** | QR popover | Shows `isQrModalOpen` but QR content is hard-coded | Must call `POST /api/runs/:id/share` then render QR from returned URL |
| **/run/:id** | Status pill | Derived from local run status mock | Must reflect real DB status |
| **/history** | Run list | `INITIAL_RUNS` array | Must come from `GET /api/runs` |
| **/history** | Replay each run | Uses local `runs` state | Must load events from `GET /api/runs/:id/events` |
| **/r/:id** (Steer) | Status / latest step | Same mock state | Must use share token + poll events |
| **/r/:id** | Pause / Resume / Stop / Redirect | Same local handlers as `/run/:id` | Must call commands API with share token auth |
| **/verify** | Offline verifier | **NOT RENDERED** — no `case '/verify'` in routing | Needs new page component |
| **Health** | db / llm / worker status | **NOT IN FRONTEND** — no health check UI | `GET /api/health` exists but UI element is not built |

---

## 3. Hard-coded values that must be removed or labelled

| Location | Value | Action |
|---|---|---|
| `App.tsx` `INITIAL_RUNS` | All 3 fake runs with fake IDs, fake tools, fake hashes | Replace with real API data |
| `App.tsx` metrics strip | "100% Audit Traceability", "< 12ms Human-in-Loop Halt", "gVisor", "99.98%" | Remove fabricated stats; replace or delete |
| `App.tsx` observability section | "120k+ Runs Audited Daily", "0.0ms Unlogged State Drift" | Remove entirely |
| `App.tsx` hero card | "RUN #0894-F · 100% AUDITED" | Remove or use real run id |
| `App.tsx` hero card | "< 12ms GUARANTEE" | Label as "target" or remove |
| `App.tsx` landing hash tree | Fake hash values "e8a1..390b" etc. | Replace with real chain head from a real run |
| `App.tsx` protocol badge | "Flight Protocol v4.2 · Verified Deterministic" | Either keep as product copy or derive version from API |
| `App.tsx` | Tool names like `tool::sec_edgar_crawler`, `proof::zk_attestation`, `evm::decompiler` | Replace with real tool names: `search_web`, `search_wikipedia`, `fetch_page`, `write_file` |
| `App.tsx` | `ECDSA`, `gVisor`, `Merkle`, `ZK attestation` terminology | None of these exist in the real backend; UI copy must be updated to match actual features |

---

## 4. Mismatch list (real frontend vs AGENTS.md / BACKEND_PLAN.md)

| # | Item | AGENTS.md / BACKEND_PLAN says | Reality |
|---|---|---|---|
| M1 | Framework | Next.js App Router | Vite + React SPA |
| M2 | Language | JavaScript ESM | TypeScript |
| M3 | Frontend file locations | `app/`, `lib/api.js`, `lib/useRun.js`, `lib/reduceEvents.js`, `components/`, `fixtures/` | None of these exist |
| M4 | API client | `lib/api.js` wraps fetch calls | No API client; no fetch calls at all |
| M5 | Polling hook | `lib/useRun.js` polls `/events?after=<seq>` every 700ms | No polling; all state is local mock |
| M6 | Event reducer | `lib/reduceEvents.js` pure function | Does not exist |
| M7 | Chain compatibility | `lib/chain.js` and `lib/verifyBundle.js` | Neither exists |
| M8 | Fixtures | `fixtures/golden_run.json` | Does not exist |
| M9 | Mock switch | `NEXT_PUBLIC_USE_MOCK=0/1` | No mock switch; entire app is always mock |
| M10 | Design tokens | `--color-accent: #0a0a0a` (black), system fonts only, no Google Fonts | Teal accent `#0E7C86`, Google Fonts (Geist, Instrument Serif, JetBrains Mono) |
| M11 | Dependencies | No shadcn, no Framer Motion, no icon packs | Uses `framer-motion` (via `motion` package), `lucide-react` |
| M12 | Accent color | Black only | Teal `#0E7C86` — a fundamental design difference |
| M13 | Tool names in UI | `search_web`, `search_wikipedia`, `fetch_page`, `write_file` | Fake tools: `tool::sec_edgar_crawler`, `proof::zk_attestation`, `fault::simulate_rpc_drop`, `evm::decompiler`, etc. |
| M14 | `/verify` page | Must exist as a route | Not rendered (missing case in routing switch) |
| M15 | `scripts/export-run.js` | Must exist | Does not exist |
| M16 | `DECISIONS.md` | Must exist | Does not exist |
| M17 | `prisma/` | Must exist | Does not exist |
| M18 | `worker/` | Must exist | Does not exist |
| M19 | `server/` | Must exist | Does not exist |
| M20 | `NEXT_PUBLIC_*` env vars | Used for mock switch | `.env.example` only has `GEMINI_API_KEY` and `APP_URL`; no Next.js env vars |
| M21 | Package name / scripts | `worker`, `db:migrate`, `db:deploy`, `lint`, `format`, `test` | Only `dev`, `start`, `install`, `build`, `preview`, `clean`, `lint` (which runs `tsc --noEmit`) |

---

## 5. Build result

Command: `npm run build`  
Result: **PASS**  
Output:
```
✓ 16 modules transformed.
dist/index.html                   1.32 kB │ gzip:  0.58 kB
dist/assets/index-d-EmVl80.css   47.41 kB │ gzip:  9.00 kB
dist/assets/index-CL489Lkm.js   286.76 kB │ gzip: 83.83 kB
✓ built in 1.08s
```

---

## 6. BLOCKERS (must be resolved before B1)

### BLOCKER 1 — Framework: Vite SPA, not Next.js
The entire BACKEND_PLAN assumes Next.js App Router. The real frontend is a Vite SPA. This means:
- API routes **cannot** live in `app/api/` next to the frontend — there is no Next.js runtime.
- `lib/api.js`, `lib/useRun.js`, `lib/reduceEvents.js` do not exist and cannot simply be created in a Next.js-aware way.

**Decision required from you before B1:**

**Option A — Keep Vite, add Express backend (recommended for hackathon speed)**
- Add `server/index.js` as a standalone Express server for the API.
- Keep the Vite dev server for the frontend.
- In production: Express serves static `dist/` and the API under `/api/`.
- Add `lib/api.js` and `lib/useRun.js` as browser-side modules that the React SPA imports.
- The worker runs as a separate process exactly as planned.
- This is the fastest path and touches zero existing files.

**Option B — Migrate to Next.js**
- Replace Vite + `src/` with Next.js App Router.
- Requires rewriting `App.tsx` into Next.js page files — a significant frontend change.
- Contradicts the "FRONTEND FREEZE" rule.
- **Not recommended.**

**Option C — Vite with Vite proxy**
- Vite dev proxy forwards `/api/*` to an Express backend during development.
- Same as Option A in production.
- Identical to Option A with slightly nicer DX.

### BLOCKER 2 — Fabricated metrics and tool names
The frontend contains stats, terminology, and tool names that do not exist in the real backend (gVisor, ZK attestation, ECDSA per-step, 120k runs/day, SEC EDGAR crawler, etc.). Wiring up real data will make the demo look different from the current UI. **You must approve which fabricated elements to remove and which to keep as marketing copy before B1 proceeds.**

---

## 7. MISSING FEATURES (need your approval)

These UI elements exist in the frontend but have no backend counterpart yet, OR exist in the plan but are missing from the frontend:

| # | Feature | Status | Action needed |
|---|---|---|---|
| F1 | `/verify` offline verifier page | Route not rendered in `App.tsx` | Add a case to the routing switch + build the page component (additive) |
| F2 | Health indicator UI | No health row in the frontend | Backend `GET /api/health` can be built; frontend UI element does not exist yet — list only |
| F3 | `fixtures/golden_run.json` | Does not exist | Created by `scripts/export-run.js` after first real run; additive |
| F4 | QR code rendering | `isQrModalOpen` opens a modal but QR SVG is not rendered | Needs `qrcode` package + real share URL |
| F5 | `DECISIONS.md` | Missing | Additive: create with one entry per architectural decision made |
| F6 | Token count display ("cost meter") | Budget bars show steps/time/LLM calls but no token count display in current markup | Backend emits `llm_usage`; frontend display needs to be added (additive) |
| F7 | `injection_flagged` badge | Mentioned in AGENTS.md but not visible in current App.tsx rendering logic | Backend emits it; frontend rendering needs to be added (additive) |

---

## 8. MISMATCHES (informational — do not affect B1 if Option A is chosen)

- Design accent is teal, not black. This is a frontend decision that stands.
- `framer-motion` and `lucide-react` are used (on the AGENTS.md reject list). They are already installed and used; removing them would require frontend changes. Treat as accepted deviations.
- Google Fonts are loaded from `index.html`; AGENTS.md says system fonts only. Treat as an accepted deviation.
- The `"lint"` script runs `tsc --noEmit`, not ESLint. ESLint and Prettier are not installed.
