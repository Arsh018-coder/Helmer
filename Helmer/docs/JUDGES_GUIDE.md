# 🏆 Hackathon Judges' Guide — Helmer

> **Track / Category**: Autonomous AI Agents, Reliability, Observability & Security  
> **Tagline**: *Agents that show their work. Run autonomous tasks you can watch, steer, and verify.*

---

## 🎯 The Core Problem Helmer Solves

Modern autonomous LLM agents are dangerous black boxes:
1. **Silent Drift & Hallucination**: You prompt an agent, wait 3 minutes, and receive an answer with zero evidence of what tools were run or whether intermediate steps hallucinated.
2. **Zero Human Control**: Once an agent enters an infinite retry loop or starts modifying critical records, there is no sub-second stop button.
3. **No Forensic Traceability**: Regulators, auditors, and enterprises cannot mathematically prove whether an agent's output was manipulated after execution.

---

## 🚀 Key Innovations to Demonstrate to Judges

### 1. The Pre-Flight Contract (`server/agent/contract.ts`)
Before calling any tool, Helmer prompts the planner LLM to synthesize the user's intent into an explicit **contract** with checkable criteria (e.g. `min_urls: 3`, `zero_variance: $0.00`, `file_exists: briefing.md`). At the end of the run, every criterion is evaluated deterministically against raw tool outputs — giving an undeniable Pass/Fail verdict.

### 2. Cryptographic Black-Box Recorder (`server/recorder.ts`)
Inspired by aviation flight recorders, every reasoning step, tool invocation, and payload is hashed sequentially into a **SHA-256 Merkle chain**.
- *Judge Demo*: Click **Tamper Log (Demo)** in the UI to simulate an attacker altering an event in the database. Watch the UI immediately flag the exact broken sequence number (`BROKEN AT SEQ #3`).

### 3. Zero-Latency Human-in-the-Loop Remote (`components/modals/QrModal.tsx`)
Scan the QR code with your smartphone to open the mobile steering remote. You can:
- **Pause** execution mid-flight.
- **Redirect** the working instruction (e.g. *"Focus only on European ledgers"*), which the agent incorporates into its next decision step.
- **Emergency Stop** the agent in under 12ms.

### 4. Self-Healing Chaos Recovery (`server/agent/recovery.ts`)
Test agent resiliency by injecting simulated faults (e.g. 4,500ms RPC timeout on SEC EDGAR crawler). Helmer automatically climbs its **Recovery Ladder** (Rung 1: Retry with exponential backoff → Rung 2: Hot standby fallback agent → Rung 3: Human escalation) and completes the deliverable without dropping frames.

---

## ⚡ Quick 2-Minute Demo Script for Judges

1. **Start on the Landing Page (`/`)**: Show the live 3D robot mascot (mouse tilt & eye gaze tracking) and the offline golden replay run.
2. **Navigate to the Console (`/console`)**: Select a prompt or type a goal. Click **Launch Task**.
3. **Open Live Run (`/run/[id]`)**: Show the live criteria checklist, the step-by-step reasoning payload diffs, and the real-time budget monitors (steps, seconds, LLM tokens).
4. **Trigger Chaos Fault**: Click **Inject Fault** to demonstrate self-healing recovery.
5. **Demonstrate Audit Verification (`/verify`)**: Download the bundle, open the offline verifier, and verify the cryptographic proof with zero server dependencies.
