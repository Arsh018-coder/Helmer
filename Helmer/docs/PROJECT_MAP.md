# 🗺️ Helmer Project Map & Navigation Guide

Welcome to **Helmer**! This document is designed for team members and judges to quickly navigate the codebase without getting lost.

---

## 📁 Directory Structure at a Glance

```
Helmer/
├── app/                  # Next.js 15 App Router (Pages, Layouts & API Endpoints)
│   ├── api/              # Serverless API routes (runs, events, auth, health, chaos)
│   ├── console/          # Console page (task composer & run trigger)
│   ├── history/          # History page (past runs & audit verification)
│   ├── run/[id]/         # Live Run page (real-time telemetry & step timeline)
│   ├── r/[id]/           # Mobile Steer remote page (phone interface)
│   ├── verify/           # Offline independent verifier page
│   ├── globals.css       # Design tokens, Apple frosted glassmorphism & animations
│   ├── layout.tsx        # Root HTML layout and font loading
│   └── page.tsx          # Landing page entry
│
├── components/           # Reusable Modular UI Components
│   ├── AppShell.tsx      # Main application shell orchestrator
│   ├── Navbar.tsx        # Frosted glass top navigation bar
│   ├── MascotRobot.tsx   # 3D interactive robot mascot with cursor parallax & telemetry
│   └── modals/           # Popups & modal dialogs
│       ├── QrModal.tsx       # QR code modal for mobile steering
│       └── RedirectModal.tsx # Mid-flight instruction injection modal
│
├── server/               # Core Autonomous Agent Engine & Backend Services
│   ├── agent/            # Agent loop, contract generator, LLM client, and tools
│   │   ├── loop.ts       # Main iterative agent execution cycle
│   │   ├── contract.ts   # Synthesizes user goals into testable pass/fail contracts
│   │   ├── tools.ts      # Verifiable tools (search_web, calc, sec_edgar_crawler)
│   │   ├── recovery.ts   # Self-healing recovery ladder (retry, fallback, escalate)
│   │   └── prompts.ts    # System instructions and prompt templates
│   ├── recorder.ts       # Tamper-proof black-box flight recorder (SHA-256 hash chain)
│   ├── config.ts         # Centralized environment variable validator
│   └── db.ts             # Prisma client connection manager
│
├── worker/               # Dedicated Long-Running Background Agent Process
│   └── index.ts          # Atomic run claiming (`SKIP LOCKED`), heartbeats & execution
│
├── lib/                  # Shared Client-side Helpers, Types & Utilities
│   ├── api.ts            # Client HTTP API client
│   ├── chain.ts          # Hash chain cryptographic primitives
│   ├── reduceEvents.ts   # Pure functional state reducer for event logs
│   ├── types.ts          # TypeScript interfaces for runs, steps, and criteria
│   └── useRun.ts         # Real-time polling hook for live event streams
│
├── prisma/               # Database Architecture
│   ├── schema.prisma     # Postgres schema (runs, events, worker tags)
│   └── migrations/       # Version-controlled database migrations
│
├── public/               # Static Assets
│   ├── robo.png          # Mascot robot image
│   └── fixtures/         # Golden replay run fixtures for offline demos
│
├── docs/                 # Documentation & Guides
│   ├── ARCHITECTURE.md   # System architecture & sequence diagrams
│   ├── PROJECT_MAP.md    # This file!
│   └── JUDGES_GUIDE.md   # Hackathon judge pitch and demo walkthrough
```

---

## 🧭 Cheat Sheet: "Where do I find..."

| If you want to change... | Look in this file / folder |
| :--- | :--- |
| **Navbar links or brand logo** | `components/Navbar.tsx` |
| **Interactive 3D Robot behavior** | `components/MascotRobot.tsx` |
| **QR code modal or Redirect popup** | `components/modals/` |
| **Page styling, glass colors & themes** | `app/globals.css` |
| **Agent system prompts & persona** | `server/agent/prompts.ts` |
| **Agent tool definitions (Search, Calc, SEC)** | `server/agent/tools.ts` |
| **Agent failure recovery & self-healing** | `server/agent/recovery.ts` |
| **Cryptographic hash chain / recorder** | `server/recorder.ts` |
| **Database models (tables & fields)** | `prisma/schema.prisma` |
| **Background worker loop & polling** | `worker/index.ts` |
| **API Endpoints (runs, events, health)** | `app/api/` |
