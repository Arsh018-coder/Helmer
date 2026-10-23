# HELMER MOBILE APPLICATION SPECIFICATION (BLUEPRINT)
**Version:** 1.0.0  
**Target Environments:** iOS (Apple VisionOS / SF Grade), Android (Material You / Dynamic Blur), Progressive Web App (PWA)  
**Architecture:** Next.js 15 + React Native / Expo (or Capacitor iOS/Android Native Shell) + Supabase (PostgreSQL 16, pgBouncer, Realtime)  
**Primary Aesthetic:** Apple VisionOS Extreme Frosted Glassmorphism (Light Specular Aesthetic)  

---

## 1. Overview & System Concept

### 1.1 Executive Summary
**Helmer** is a deterministic, verifiably safe autonomous AI execution engine. Unlike conventional black-box LLM agents that execute untracked commands in opaque loops, Helmer enforces:
1. **Cryptographic Flight Recording:** Every meaningful action (step started, model reasoning, tool call, tool result, fault injection, recovery attempt, drift assessment) is immutably appended to an ordered, SHA-256 hash-chained ledger in Supabase.
2. **Intent Contracts:** Before any tool is dispatched, the agent synthesizes a binding contract with explicit deterministic criteria (e.g., file existence, minimum verified citations, word range) and capped qualitative criteria.
3. **Active Human Steering & Drift Control:** A runtime drift guard continuously measures task divergence, while an operator can pause, resume, inject runtime steering directives, or trigger a 12ms Emergency Stop (E-STOP).
4. **Pocket Steer (Mobile Remote Control):** Operators can monitor execution and steer active runs from their phone in real time by scanning a cryptographic QR code displayed on the console.

### 1.2 Core Objectives for Mobile Translation
Translating the Helmer web experience into a mobile application (or native wrapper) requires achieving four primary objectives:
* **Zero-Compromise Glassmorphism:** Replicate the desktop app's multi-layered visionOS frosted glassmorphism (`backdrop-filter: blur(40px) saturate(230%)`, specular highlight bevels, ambient chromatic underlays) using native GPU-accelerated blur surfaces (`BlurView`).
* **Tactile Pocket Steering:** Elevate the `/r/[id]` mobile steering interface into a high-utility native remote control equipped with physical haptic feedback (`expo-haptics`), instantaneous status synchronization, and gesture controls.
* **Instant QR Hardware Pairing:** Provide instant device pairing using native mobile cameras (`expo-camera` / `@capacitor/camera`) to scan QR share codes and open live steering sessions in under 400ms.
* **Resilient Offline Verification:** Leverage client-side cryptographic functions (`lib/chain.ts`, `lib/verifyBundle.ts`) so mobile operators can verify exported flight recorder bundles completely offline without trusting external servers.

---

## 2. Design System & Theming

The mobile application strictly inherits Helmer's **Apple & Superhuman Grade Extreme Frosted Glassmorphism** (Light Aesthetic). It avoids generic flat colors in favor of refractive gradients, specular highlights, and ambient atmospheric depth.

### 2.1 Core Color Palette & Design Tokens

| Token Name | Hex / CSS Value | Description / Usage |
| :--- | :--- | :--- |
| `--bg` | `#F5F7FB` | Primary canvas background |
| `--bg-subtle` | `#EEF2F8` | Secondary container & table header fill |
| `--bg-card` | `#FFFFFF` | Fallback opaque card base |
| `--text` | `#0B1F3A` | Primary high-contrast typography (deep navy) |
| `--text-2` | `#5B6B7A` | Secondary metadata, subtitles, and descriptions |
| `--text-3` | `#8A99A8` | Tertiary labels, timestamps, and muted captions |
| `--accent` | `#0E7C86` | **The Singular Accent:** Deep Teal |
| `--accent-tint` | `rgba(14, 124, 134, 0.09)` | Light teal tint for badges & active states |
| `--accent-border`| `rgba(14, 124, 134, 0.25)` | Border for accent elements and focus rings |
| `--accent-hover` | `#096169` | Pressed / active state for primary teal buttons |
| `--accent-glow`  | `rgba(14, 124, 134, 0.35)` | Box-shadow glow for floating CTA actions |
| `--ok` | `#16A34A` | Verified status, intact chain, passing criterion |
| `--ok-bg` | `rgba(22, 163, 74, 0.09)` | Background pill for passing checks |
| `--ok-border` | `rgba(22, 163, 74, 0.26)` | Border for verified elements |
| `--warn` | `#D97706` | Warning state, paused run, drift caution |
| `--warn-bg` | `rgba(217, 119, 6, 0.09)` | Background pill for paused status & drift warnings |
| `--warn-border`| `rgba(217, 119, 6, 0.26)` | Border for warning notifications |
| `--err` | `#DC2626` | E-STOP, broken chain, injected fault, error |
| `--err-bg` | `rgba(220, 38, 38, 0.09)` | Background pill for failed/broken states |
| `--err-border` | `rgba(220, 38, 38, 0.26)` | Border for emergency stop buttons and alert cards |

---

### 2.2 Extreme Frosted Glass Tokens (VisionOS Spec)

On mobile, glass cards must refract background colors rather than rendering flat grey or white transparencies.

```css
/* Core Frosted Glass Layers */
--glass: linear-gradient(135deg, rgba(255, 255, 255, 0.54) 0%, rgba(255, 255, 255, 0.16) 48%, rgba(255, 255, 255, 0.38) 100%);
--glass-elevated: linear-gradient(135deg, rgba(255, 255, 255, 0.68) 0%, rgba(255, 255, 255, 0.24) 48%, rgba(255, 255, 255, 0.50) 100%);
--glass-subtle: linear-gradient(135deg, rgba(255, 255, 255, 0.44) 0%, rgba(255, 255, 255, 0.12) 100%);
--glass-hover: linear-gradient(135deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.28) 100%);

/* Specular Glass Borders */
--stroke-glass: rgba(255, 255, 255, 0.94);
--stroke-glass-top: #FFFFFF;
--stroke-subtle: rgba(11, 31, 58, 0.08);
--stroke-border: rgba(11, 31, 58, 0.12);

/* Physical Glass Specular Bevel & Shadow System */
--shadow-glass: 
  inset 0 2px 2.5px 0 #FFFFFF, 
  inset 0 -1.5px 2px 0 rgba(11, 31, 58, 0.04), 
  inset 2px 0 2.5px 0 rgba(255, 255, 255, 0.8),
  0 24px 54px -10px rgba(11, 31, 58, 0.12), 
  0 8px 20px -3px rgba(11, 31, 58, 0.05);

--shadow-glass-elevated: 
  inset 0 2.5px 3px 0 #FFFFFF, 
  inset 0 -2px 3px 0 rgba(11, 31, 58, 0.04), 
  inset 2.5px 0 3px 0 rgba(255, 255, 255, 0.85),
  0 30px 64px -12px rgba(11, 31, 58, 0.16), 
  0 10px 26px -2px rgba(11, 31, 58, 0.06);

--shadow-glass-card:
  inset 0 1.5px 2px 0 #FFFFFF,
  inset 0 -1px 1.5px 0 rgba(11, 31, 58, 0.03),
  0 14px 34px -6px rgba(11, 31, 58, 0.08);
```

#### Atmospheric Ambient Sky Underlay
To guarantee that frosted glass surfaces have rich chromatic light to refract, the mobile root view must render an animated ambient mesh underlay:
* **Teal Core:** `radial-gradient(circle, rgba(14, 124, 134, 0.18) 0%, transparent 70%)`
* **Sky Blue:** `radial-gradient(circle, rgba(56, 189, 248, 0.38) 0%, transparent 68%)`
* **Indigo Glow:** `radial-gradient(circle, rgba(165, 180, 252, 0.42) 0%, transparent 72%)`
* **Blur Factor:** 55px Gaussian blur with subtle 50s continuous breathing animation.

---

### 2.3 Typography Specifications

* **Primary Body & Display Font:** SF Pro Display / SF Pro Text (iOS native) or Inter / System Default (Android).
* **Monospace Font:** SF Mono / Cascadia Code / UI Monospace (used for SHA-256 hashes, sequence numbers, step tags, execution latencies).
* **Editorial Title Accent:** Instrument Serif / New York Serif (used exclusively for landing headlines).

| Style | Font Family | Size | Weight | Line Height | Letter Spacing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Large Title** | SF Pro Display | 28px – 32px | 700 (Bold) | 1.2 | -0.025em |
| **Section Header**| SF Pro Display | 20px – 22px | 600 (Semibold)| 1.3 | -0.015em |
| **Card Title** | SF Pro Display | 16px – 17px | 600 (Semibold)| 1.35 | -0.01em |
| **Body (Regular)**| SF Pro Text | 14px – 15px | 400 (Regular) | 1.55 | 0 |
| **Body (Medium)** | SF Pro Text | 14px – 15px | 500 (Medium) | 1.5 | 0 |
| **Caption / Meta**| SF Pro Text | 12px – 13px | 400 / 500 | 1.4 | +0.01em |
| **Micro Badge** | SF Mono | 10px – 11px | 600 (Semibold)| 1.2 | +0.04em (Uppercase) |
| **Code / Hash** | SF Mono | 11px – 12.5px | 400 / 500 | 1.45 | -0.02em |

---

### 2.4 UI Geometry & Touch Rules

* **Corner Radii:**
  * Small Badges & Input Fields: `--r-sm = 14px`
  * Standard Cards & Glass Panels: `--r-md = 22px`
  * Large Action Sheets & Modals: `--r-lg = 30px`
  * Pill Buttons & Status Indicators: `--radius-pill = 9999px`
* **Minimum Touch Target Size:** 44pt × 44pt (Apple HIG / Material 48dp standard).
* **Safe-Area Insets:** Dynamic padding top (`env(safe-area-inset-top)`) and bottom (`env(safe-area-inset-bottom)`) to guarantee UI elements never collide with the dynamic island, sensor notch, or home indicator bar.

---

## 3. Core Features & Screen Breakdown

### Screen 1: Mobile Steer / Pocket Remote (`/r/[id]`)
*The flagship mobile screen allowing operators to steer live execution.*

* **Key Components:**
  1. `ProtocolHeader`: Displays Helmer logo badge, live connection status dot (`badge-dot-green`), and 8-character active Run ID badge (`RUN: uhpwpnza`).
  2. `GoalCard`: VisionOS frosted panel displaying the operator's current active goal in high-contrast text.
  3. `SteerGiantButtonGrid`: Dual large-format action buttons:
     * **Pause/Resume Button (`.steer-btn-pause`):** Warm amber frosted glass (`background: linear-gradient(135deg, rgba(254, 243, 199, 0.75) 0%, rgba(253, 230, 138, 0.35) 100%)`). Toggles between `⏸ Pause Run` and `▶ Resume Run`. Immediately freezes time budget.
     * **E-STOP Button (`.steer-btn-stop`):** High-alert red frosted glass (`background: linear-gradient(135deg, rgba(254, 242, 242, 0.75) 0%, rgba(254, 226, 226, 0.35) 100%)`). Executes emergency stop in 12ms.
  4. `RedirectButton`: Full-width primary pill button: `↳ Redirect Instruction`. Opens `RedirectModal`.
  5. `LatestStepCard`: Glass card with live status indicator (`200 OK` in green), active step title, and streaming model reasoning snippet.
  6. `ChaosTestCard`: Developer testing trigger to simulate tool failures: `⚡ Break search_web from Phone`.
  7. `SwitchToDesktopLink`: Quick navigation to full desktop telemetry dashboard.
* **Touch Interactions & Feedback:**
  * Pause/Resume tap: Triggers `ImpactFeedbackStyle.Medium` haptic.
  * E-STOP tap: Triggers `NotificationFeedbackType.Error` double-heavy haptic vibration with visual confirmation modal.
  * Active button press scale: `transform: scale(0.97)` with `transition: 0.15s ease`.

---

### Screen 2: Console Dashboard (`/console`)
*The mission control center for configuring, budgeting, and launching autonomous runs.*

* **Key Components:**
  1. `ConsoleHeader`: Live system status badge (`gVisor Sandbox Isolated`, `Deterministic Engine Ready`).
  2. `GoalComposer`: Rich text area with pre-set suggestion pills (e.g. *Q3 Financial Drift Reconciliation*, *EDGAR 10-Q Filing Attestation*, *Semiconductor Supply Audit*).
  3. `ProviderModelSelector`: Segmented control switching between Groq (`qwen/qwen3.8-27b`), Gemini (`gemini-2.0-flash`), and OpenAI (`gpt-4o-mini`).
  4. `BudgetConfigSliders`: Visual sliders for Max Steps (1–15), Max Seconds (30s–300s), and Max LLM Calls (5–50).
  5. `LaunchPillButton`: Prominent teal action button (`Launch Autonomous Run →`) with loading spinner and transaction lock.
  6. `TerminalLogStream`: Monospace execution log window supporting log level filters (`all`, `llm`, `tool`, `recorder`, `pass`).
* **Responsive Mobile Guidelines:**
  * Converts the multi-column desktop layout into a vertical stack with fixed bottom launch bar.
  * Virtual keyboard avoidance: Floating action button docks above the software keyboard when typing.

---

### Screen 3: Live Run Telemetry (`/run/[id]`)
*The comprehensive observability dashboard tracking verification and execution in real time.*

* **Key Components:**
  1. `IntentContractCard`: Code-verified criteria breakdown showing verification status (`pass`, `fail`, `pending`) and quotable evidence strings.
  2. `StepTimeline`: Accordion list of executed steps with tool badges (`search_web`, `search_wikipedia`, `fetch_page`, `write_file`), duration badges (e.g., `42ms`), and expandable JSON payloads.
  3. `DriftMeter`: SVG sparkline tracking agent task alignment with nominal score display (`NOMINAL · 94/100`).
  4. `ResourceBudgetBars`:
     * **Steps Budget:** `X / 8` with animated progress fill.
     * **Seconds Budget:** `Net Active Xs / 180s` (dynamically pauses during operator holds).
     * **LLM Calls:** `X / 25` with input/output token metrics.
  5. `DeliverablePreviewCard`: Capped preview (`maxHeight: 340px`) of `briefing.md` with:
     * Word count badge (`✓ 100 words`).
     * `⛶ Maximize` button opening `DeliverableModal`.
     * `Download` button.
     * Clickable preview link: `Open Full View ↗`.

---

### Screen 4: Deliverable Fullscreen Modal (`DeliverableModal.tsx`)
*Wide reading sheet providing full document review without layout clipping.*

* **Key Components:**
  1. `ModalHeader`:
     * Document title: `briefing.md` with file type icon.
     * Verification badge: `✓ VERIFIED DELIVERABLE`.
     * Word count and character count statistics (`240 words · 1,420 characters`).
     * View toggle: `Formatted` vs `Raw Source`.
     * Action buttons: `📋 Copy` (with animated `✓ Copied` state) and `⬇ Download`.
     * Close button (`✕`).
  2. `GoalBanner`: Contextual header reminding the reader of the exact task goal.
  3. `DocumentBody`:
     * Formatted mode: Renders clean typography, hierarchical headers (`#`, `##`, `###`), bullet points with teal glyphs, bold styling, and clickable external source URLs.
     * Raw Source mode: Monospace block showing raw markdown content.
  4. `ModalFooter`: Cryptographic verification attestation with quick close button.
* **Mobile Gesture Guidelines:**
  * Supports pull-to-dismiss sheet gesture.
  * Full screen sheet on mobile devices (`max-height: 92vh`).

---

### Screen 5: Offline Bundle Verifier (`/verify`)
*Zero-trust client-side verification tool to mathematically validate flight recorder logs.*

* **Key Components:**
  1. `BundleUploader`: Drag-and-drop or file picker accepting `.json` run bundles.
  2. `PinnedHeadInput`: Monospace input field for the 64-character SHA-256 head hash.
  3. `VerifyAction`: Button triggering `verifyBundle(json, pinnedHead)`.
  4. `VerdictCard`:
     * `✓ Chain Intact`: Displays event count, sequence integrity, and matching head hash.
     * `✕ Chain Broken`: Identifies the exact sequence number (`brokenAt: seq`) where hash verification failed, proving tampering.

---

### Screen 6: Profile & Security Key Vault (`/profile`)
*User identity and encrypted local credential storage.*

* **Key Components:**
  1. `UserIdentityCard`: Displays authenticated user avatar, email, provider badge (`Google` / `GitHub` / `Email`), and session timestamp.
  2. `CredentialVault`: Encrypted key storage for custom API keys (`GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`).
  3. `NodeHealthStatus`: Displays worker status (`Worker Tag: acode-mac`), database connectivity, and backend heartbeat.
  4. `AuthModal`: VisionOS frosted popup handling Google OAuth, GitHub OAuth, and email/password authentication.

---

## 4. Mobile Steer / Remote Control Mechanism

The Pocket Steer architecture decouples browser execution from backend worker processes, allowing a mobile device to control an agent operating on a remote server without requiring a shared local network.

```
┌─────────────────────────────────┐           ┌──────────────────────────────────┐
│   Desktop Web Console (/run)    │           │    Mobile Steer Device (/r)      │
│  - Displays QrModal with token  │           │  - Scans QR Code                 │
│  - Polls /api/runs/[id]/events  │           │  - Opens /r/[id]?t=<share_token> │
└────────────────┬────────────────┘           └─────────────────┬────────────────┘
                 │                                              │
                 │                                              │ POST /api/runs/[id]/commands
                 ▼                                              ▼ (pause, resume, stop, redirect)
    ┌───────────────────────────────────────────────────────────────┐
    │              Supabase PostgreSQL Database                     │
    │  - runs: Status, goal, budget, contract                       │
    │  - events: Hash-chained audit logs (runStarted, toolResult)   │
    │  - commands: Queue consumed by agent loop between steps       │
    │  - artifacts: Completed deliverables (briefing.md)            │
    └───────────────────────────────┬───────────────────────────────┘
                                    │
                                    │ Claims queued commands between steps
                                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                  Background Agent Worker                      │
    │  - Executes tools (searchWeb, fetchPage, writeFile)           │
    │  - Measures task drift via LLM guard                          │
    │  - Extends deadlines when paused: ctx.deadline += pausedMs    │
    └───────────────────────────────────────────────────────────────┘
```

### 4.1 Step-by-Step Flow

#### Phase 1: Share Token Minting & QR Display
1. The operator on the desktop web app clicks **"Steer Phone"** in the top navigation or control panel.
2. The client calls `POST /api/runs/[id]/share`.
3. The server validates the operator's access and generates an encrypted HMAC share token containing `runId` and expiration timestamp (`SHARE_TOKEN_TTL_MS = 2 hours`).
4. The server returns the steer URL: `https://helmer.app/r/[id]?t=<token>`.
5. The desktop renders a high-contrast QR code inside `QrModal.tsx` using `qrcode.toDataURL()`.

#### Phase 2: Mobile Scan & Initialization
1. The operator opens the Helmer mobile app (or camera scanner).
2. The scanner extracts the URL and navigates directly to `/r/[id]?t=<token>`.
3. The mobile client extracts `t` from search parameters and initializes `useRun(id, { token })`.
4. `useRun` immediately polls `/api/runs/[id]/events?after=0&t=<token>` and stores initial telemetry.

#### Phase 3: Real-Time Synchronization
* **Primary Real-Time Mechanism (Supabase Realtime):**
  The mobile app subscribes to PostgreSQL changes on the `events` table filtered by `runId`:
  ```ts
  const channel = supabase
    .channel(`run:${runId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'events', filter: `runId=eq.${runId}` },
      (payload) => handleNewEvent(payload.new)
    )
    .subscribe();
  ```
* **Resilient Polling Fallback:**
  If WebSocket connections drop (e.g. conference Wi-Fi restrictions), `lib/useRun.ts` automatically maintains cursor polling:
  * Active run cadence: **700ms**
  * Paused or completed run cadence: **3,000ms**
  * Only new events (`after = lastSeqRef.current`) are transferred, minimizing cellular data overhead.

#### Phase 4: Action Dispatch Handlers
When the operator presses a control button on mobile, actions are transmitted to `POST /api/runs/[id]/commands` with the authorization token:

```ts
// 1. Pause / Resume Toggle
await submitCommand(runId, { 
  kind: isRunPaused ? 'resume' : 'pause', 
  source: 'phone' 
}, shareToken);

// 2. Emergency Stop (E-STOP)
await submitCommand(runId, { 
  kind: 'stop', 
  source: 'phone' 
}, shareToken);

// 3. Prompt Redirection Directive
await submitCommand(runId, { 
  kind: 'redirect', 
  payload: { instruction: redirectText }, 
  source: 'phone' 
}, shareToken);

// 4. Chaos Injection
await submitChaos(runId, { 
  tool: 'search_web', 
  mode: 'fail' 
}, shareToken);
```

#### Phase 5: Worker Consumption & Precise Pause Freezing
* The backend worker checks the `commands` table **between steps** (`handleCommands`).
* When `pause` is detected:
  1. The worker emits `paused` event and enters an idle poll loop (`COMMAND_POLL_MS = 500ms`).
  2. The frontend reducer records `lastPausedAt = event.ts` and freezes the time budget.
  3. When `resume` is received, the worker measures elapsed pause time (`pausedMs = Date.now() - pauseStart`) and extends the execution deadline: `ctx.deadline += pausedMs`.
  4. The frontend reducer accumulates `totalPausedMs += event.ts - lastPausedAt`, resuming the clock without penalty.

---

## 5. Essential Technical Components & Dependencies

### 5.1 Architecture Decision: Framework Selection

To deliver the visionOS frosted glassmorphism specified by Helmer, two viable mobile architectures exist:

#### Option A: React Native + Expo (Recommended for Native Performance)
* **Pros:** Native GPU blur shaders via `expo-blur`, instant native haptics via `expo-haptics`, hardware QR scanning via `expo-camera`, and optimal fluid 120fps gesture response.
* **Cons:** Requires porting JSX templates into React Native primitives (`View`, `Text`, `Pressable`).

#### Option B: Capacitor Mobile Shell / PWA (Fastest Time-to-Market)
* **Pros:** 100% direct reuse of existing Next.js 15 App Router code, components, and CSS styles (`app/globals.css`). The entire web app runs directly inside iOS WKWebView / Android WebView with native bridge plugins.
* **Cons:** CSS `backdrop-filter` in WebViews must be tested on older Android devices.

---

### 5.2 Required Dependencies Specification

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.48.0",
    "expo": "~52.0.0",
    "expo-blur": "~14.0.1",
    "expo-haptics": "~14.0.0",
    "expo-camera": "~16.0.0",
    "expo-clipboard": "~7.0.0",
    "expo-secure-store": "~14.0.0",
    "react-native-safe-area-context": "^5.0.0",
    "react-native-svg": "^15.11.0",
    "lucide-react-native": "^0.475.0"
  }
}
```

---

### 5.3 Backend API Endpoints & Supabase Schema

The mobile application communicates with the following REST routes (all protected by `ACCESS_CODE` header or `?t=` share token):

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/api/runs` | `GET` | Fetch list of recent runs with status and duration |
| `/api/runs` | `POST` | Create and queue a new autonomous agent run |
| `/api/runs/[id]` | `GET` | Fetch full run details (contract, plan, budget) |
| `/api/runs/[id]/events` | `GET` | Cursor polling endpoint (`?after=<seq>&t=<token>`) |
| `/api/runs/[id]/commands`| `POST` | Submit control directives (`pause`, `resume`, `stop`, `redirect`) |
| `/api/runs/[id]/chaos` | `POST` | Inject runtime faults (`fail`, `slow`, `garbage`) |
| `/api/runs/[id]/artifact`| `GET` | Download raw untruncated deliverable (`briefing.md`) |
| `/api/runs/[id]/bundle` | `GET` | Export cryptographic run bundle for offline verification |
| `/api/runs/[id]/verify-chain` | `GET` | Server-side cryptographic hash verification verdict |
| `/api/runs/[id]/share` | `POST` | Mint a 2-hour signed mobile steer token |
| `/api/health` | `GET` | System heartbeat, worker alive status, database latency |
| `/api/auth/login` | `POST` | Email/password or OAuth session exchange |

---

### 5.4 Database Models (Prisma / Supabase PostgreSQL)

The mobile app reads and reacts to five core PostgreSQL tables:
1. **`runs`**: Primary task row (`id`, `goal`, `status`, `contract`, `plan`, `budget`, `verdict`, `workerTag`, `createdAt`, `finishedAt`).
2. **`events`**: Append-only flight recorder ledger (`runId`, `seq`, `ts`, `type`, `payload`, `prevHash`, `hash`). Primary key: `(runId, seq)`.
3. **`commands`**: In-flight control queue (`id`, `runId`, `kind`, `payload`, `createdAt`, `consumedAt`).
4. **`artifacts`**: Stored markdown/text deliverables (`runId`, `name`, `content`, `bytes`, `createdAt`).
5. **`workers`**: Worker tag heartbeats (`tag`, `seenAt`).

---

## 6. Performance & Optimization Guidelines

### 6.1 Native Touch & Interaction Response
* **Eliminate 300ms Click Delay:** In WebView/PWA wrappers, verify `touch-action: manipulation` is applied globally to prevent delayed touch gestures.
* **Instant Active Feedback:** Every interactive card and button must immediately apply `transform: scale(0.97)` on touch start, returning to `1.0` on release.
* **Haptic Hierarchy:**
  * **Light (`ImpactFeedbackStyle.Light`):** Tab bar selection, accordion step toggle, copy to clipboard.
  * **Medium (`ImpactFeedbackStyle.Medium`):** Pause/Resume toggle, tool break trigger.
  * **Heavy / Notification (`NotificationFeedbackType.Error`):** E-STOP execution, chain breach detection.

### 6.2 Offline Strategy & Local Caching
* **Local Run Cache:** Store the last 20 viewed runs in SQLite (or `AsyncStorage`) so the app opens instantly with cached telemetry even when offline.
* **Offline Verifier Execution:** Bundle the SHA-256 Merkle verifier (`lib/chain.ts`) inside the client bundle. The user can export or inspect bundles on a flight with zero internet access.
* **Optimistic Local Reducer:** When the user taps Pause on mobile, the UI reducer immediately transitions status to `paused` and halts local timers, eliminating waiting on network roundtrips.

### 6.3 VisionOS Blur Rendering Optimization on Mobile
* **Hardware Acceleration:** Ensure all glass containers have `will-change: transform, opacity` and `transform: translateZ(0)`.
* **Layer Capping:** Avoid nesting more than two blur layers on top of each other. The ambient sky underlay is fixed on the background, while floating cards sit on the top layer.
* **Battery / Low Power Mode Handling:** If the device enters low-power mode, automatically fall back from dynamic 40px backdrop blur to translucent white surface fills (`rgba(255, 255, 255, 0.88)`).

---

## 7. Implementation Roadmap & Blueprint Checklist

- [ ] **Phase 1: Shell & Navigation Setup**
  - Configure Expo / Capacitor project with standard safe-area wrappers.
  - Implement dynamic visionOS ambient mesh background underlay.
  - Establish CSS token system and glassmorphism container primitives (`GlassPanel`, `GlassCard`).
- [ ] **Phase 2: Authentication & QR Pairing**
  - Connect Supabase Auth client for session persistence.
  - Implement native camera scanner view for instant pairing from desktop QR codes.
  - Handle deep linking for incoming steer URLs (`helmer://r/[id]?t=[token]`).
- [ ] **Phase 3: Pocket Remote (`/r/[id]`) Integration**
  - Implement giant action buttons for Pause, Resume, and E-STOP with haptic feedback.
  - Connect WebSocket / Supabase Realtime channel for live step streaming.
  - Implement `RedirectModal` for runtime directive injection.
- [ ] **Phase 4: Telemetry & Deliverable Viewer**
  - Replicate the 5-step live execution timeline with expandable payload inspectors.
  - Integrate `DeliverableModal` for wide, formatted markdown deliverable reading.
  - Implement offline cryptographic bundle verification.
- [ ] **Phase 5: Performance & Production Hardening**
  - Validate touch responsiveness and eliminate touch latency.
  - Verify seamless pause/resume clock synchronization without budget leakage.
  - Test cross-platform build packaging for iOS App Store and Google Play.
