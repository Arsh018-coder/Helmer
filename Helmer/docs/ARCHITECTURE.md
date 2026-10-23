# 🏗️ Helmer System Architecture

Helmer is an **Autonomous Agent Observability & Flight Control Platform** built on four resilient pillars:

1. **Deterministic Contracts**: Agents write explicit, machine-checkable pass/fail criteria *before* taking any action.
2. **Black-Box Flight Recorder**: Every tool call, thought, and output is sealed in a continuous, tamper-evident SHA-256 hash chain.
3. **Sub-12ms Stop Button**: Human-in-the-loop steerability allows pausing, redirecting, or aborting rogue runs instantly from desktop or mobile.
4. **Self-Healing Recovery Ladder**: Injected chaos faults (dropped RPCs, timeouts, malformed responses) are automatically repaired through multi-rung fallbacks.

---

## 📐 High-Level Architecture Diagram

```
                 ┌────────────────────────────────────────────────────────┐
                 │                       BROWSER                          │
                 │   Next.js 15 Client App (Desktop & Mobile Steer)       │
                 │   Polls /api/runs/[id]/events every 700ms              │
                 └───────────────────▲───────────────┬────────────────────┘
                                     │               │
                                HTTP │ GET           │ HTTP POST (Pause / Steer)
                                     │               ▼
 ┌───────────────────────────────────┴───────────────┴────────────────────┐
 │                                WEB TIER                                │
 │             Next.js 15 App Router (`app/` + `app/api/`)                │
 │             - Serves UI pages, API endpoints, and share tokens         │
 │             - Appends human intervention commands to database          │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ Prisma ORM
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                              DATABASE                                  │
 │                      Supabase PostgreSQL Instance                      │
 │          Tables: `runs`, `events` (hash chain), `workers`              │
 └───────────────────────────────────▲────────────────────────────────────┘
                                     │
                                     │ Prisma ORM (FOR UPDATE SKIP LOCKED)
 ┌───────────────────────────────────┴────────────────────────────────────┐
 │                            WORKER TIER                                 │
 │                       `worker/index.ts` (Node.js)                      │
 │  - Claims queued runs atomically                                       │
 │  - Runs the Autonomous Agent Loop (`server/agent/loop.ts`)             │
 │  - Executes tools inside sandboxed confines                            │
 │  - Commits each step to the tamper-proof recorder (`server/recorder.ts`)│
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 🔒 The Cryptographic Flight Recorder (Black Box)

Every event emitted during an agent's lifecycle is appended to a Merkle-like hash chain:

```
Genesis (00000000...) 
         │
         ▼
[Event 1: contract_created] ──► SHA256(prev_hash + seq + payload) = Hash₁
         │
         ▼
[Event 2: tool_called]      ──► SHA256(Hash₁ + seq + payload)     = Hash₂
         │
         ▼
[Event 3: recovery_invoked] ──► SHA256(Hash₂ + seq + payload)     = Hash₃
```

- **Independent Offline Verification**: Anyone can download the `.bundle` file and verify the cryptographic chain inside [`app/verify/page.tsx`](file:///c:/Users/ldhim/Documents/GitHub/Helmer/Helmer/app/verify/page.tsx) without contacting our servers.
- **Tamper Detection**: If even 1 character in a tool payload is altered in the database, the hash chain breaks at that exact sequence number.
