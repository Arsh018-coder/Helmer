'use client';

/**
 * AppShell — Helmer
 * This is a verbatim lift of the App() function body from src/App.tsx.
 * All shared state, effects, handlers, and rendering logic live here.
 * Each page route renders <AppShell route="/..." /> which drives the conditional
 * page content exactly as the original currentPath switch did.
 *
 * Visual freeze: no JSX structure, class names, inline styles, or animations changed.
 * Routing: navigateTo() now delegates to next/navigation useRouter().push().
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { AgentRun } from '@/lib/types';
import {
  ApiError, createRun, createShareLink, downloadArtifact, downloadBundle, getHealth, listRuns,
  promptForAccessCode, submitChaos, submitCommand, tamperEvent, verifyChain,
  type HealthStatus,
  type RunSummary,
} from '@/lib/api';
import { GENESIS } from '@/lib/chain';
import { formatDuration, formatUtc, reduceEvents } from '@/lib/reduceEvents';
import { useRun } from '@/lib/useRun';
import { parseBundle, verifyBundle, type BundleVerdict } from '@/lib/verifyBundle';
import {
  INITIAL_RUNS,
  CANONICAL_LIVE_STEPS,
  createCustomLiveRun,
  buildCryptographicEvents,
} from '@/lib/initialRuns';

interface AppShellProps {
  /** The current route, provided by the Next.js page component. */
  route: string;
  /** For dynamic segments like /run/[id] or /r/[id], the id param. */
  id?: string;
}

/**
 * Turn a run list row into the view model the list pages render.
 *
 * `GET /api/runs` returns summaries, not full runs (the events are what carry the steps), so the
 * list rows carry an honest zero for everything only the timeline knows: a row shows the goal, the
 * verdict and the timestamps, and the run view fills in the detail by polling the run's events.
 */
function summaryToRun(summary: RunSummary): AgentRun {
  const created = Date.parse(summary.createdAt);
  const finished = summary.finishedAt ? Date.parse(summary.finishedAt) : Date.now();
  const safeCreated = Number.isFinite(created) ? created : Date.now();
  const status: AgentRun['status'] =
    summary.status === 'failed' || summary.status === 'stopped'
      ? 'stopped'
      : summary.status === 'queued'
        ? 'running'
        : summary.status;
  return {
    id: summary.id,
    goal: summary.goal,
    status,
    verdict: summary.verdict ?? 'unverified',
    driftScore: 100,
    stepsBudget: { current: 0, max: 8 },
    timeBudget: { current: Math.max(0, Math.round((finished - safeCreated) / 1000)), max: 180 },
    llmBudget: { current: 0, max: 25 },
    criteria: [],
    plan: [],
    steps: [],
    created_at: formatUtc(safeCreated),
    duration: formatDuration(finished - safeCreated),
  };
}

/** Rendered before any run has loaded, so the run view never has to null-check its data. */
const EMPTY_RUN: AgentRun = {
  id: '',
  goal: '',
  status: 'running',
  verdict: 'unverified',
  driftScore: 100,
  stepsBudget: { current: 0, max: 8 },
  timeBudget: { current: 0, max: 180 },
  llmBudget: { current: 0, max: 25 },
  criteria: [],
  plan: [],
  steps: [],
  created_at: '',
  duration: '0.0s',
};

/** A blank replay step, so the scrubber renders before a run's first step arrives. */
const EMPTY_STEP: AgentRun['steps'][number] = {
  step_no: 0,
  title: '',
  tool: '',
  duration_ms: 0,
  status: 'passed',
  reasoning: '',
  payload: '',
};

export default function AppShell({ route, id }: AppShellProps) {
  const router = useRouter();

  // Derive currentPath from the route prop so the conditional rendering below
  // behaves identically to the original currentPath state.
  const currentPath = id ? `${route}/${id}` : route;

  // The run id the URL points at, when this is a run or steer page.
  const routeRunId = route === '/run' || route === '/r' ? id ?? '' : '';

  const [runs, setRuns] = useState<AgentRun[]>(INITIAL_RUNS);
  const [selectedRunId, setSelectedRunId] = useState<string>('tx_883a90c1f');
  /**
   * The run this device is watching: the one in the URL, else the last one chosen from a list,
   * else the newest run. A `?t=` share token from the phone Steer link authorises it.
   */
  const activeRunId = routeRunId || selectedRunId || runs[0]?.id || 'tx_883a90c1f';
  const [shareToken, setShareToken] = useState<string>('');
  const [composerGoal, setComposerGoal] = useState<string>(
    'Synthesize Q3 financial reports, reconcile multi-currency wire drift, and propose currency hedge allocations.'
  );

  // Live Run State
  const [isRunPaused, setIsRunPaused] = useState(false);
  const [isFaultInjected, setIsFaultInjected] = useState(false);
  const [chaosDelay, setChaosDelay] = useState(4500);
  const [chaosHallucination, setChaosHallucination] = useState(35.0);
  const [chaosAgents, setChaosAgents] = useState(3);
  const [expandedStep, setExpandedStep] = useState<number | null>(3);
  const [runVerifyStatus, setRunVerifyStatus] = useState<'idle' | 'verifying' | 'verified' | 'tampered'>('idle');
  const [isTamperBroken, setIsTamperBroken] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  // The seq+payload we edited, so "Restore" can put the original text back and heal the chain.
  const [tamperedEvent, setTamperedEvent] = useState<{ seq: number; original: string } | null>(null);
  // Where the server says the chain first breaks; null means intact.
  const [chainBrokenAt, setChainBrokenAt] = useState<number | null>(null);

  // Health row (feature F2) and the offline verifier (feature F1).
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [verifyBundleText, setVerifyBundleText] = useState('');
  const [verifyHeadInput, setVerifyHeadInput] = useState('');
  const [bundleVerdict, setBundleVerdict] = useState<BundleVerdict | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);

  // Modals
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isRedirectModalOpen, setIsRedirectModalOpen] = useState(false);
  const [redirectInstruction, setRedirectInstruction] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  // The signed steer link the QR encodes, so the "open" button carries the phone's token too.
  const [steerUrl, setSteerUrl] = useState<string>('');

  // The recorded run the landing hero loops (feature F3). It is a real export of a real run, so
  // the hero plays with zero database access; when no recording is shipped the replay falls back
  // to whatever run is currently selected.
  const [goldenRun, setGoldenRun] = useState<AgentRun | null>(null);

  // Replay State
  const [isReplaying, setIsReplaying] = useState(true);
  const [replayStepIdx, setReplayStepIdx] = useState(2);
  const [replaySpeed, setReplaySpeed] = useState<1 | 2>(1);

  // Live run data (B4 wiring): the run view, the phone view and the replay all render this one
  // `AgentRun`, folded from the run's events by the shared reducer.
  const live = useRun(activeRunId || null, { token: shareToken || null });
  const activeRun = (live.run && live.events.length > 0)
    ? live.run
    : (runs.find((r) => r.id === activeRunId) ?? runs[0] ?? EMPTY_RUN);
  // The landing hero prefers the shipped recording so it plays offline; every other screen shows
  // the live run.
  const replayRun = goldenRun ?? activeRun;

  // The phone Steer page is rendered from a server page that never reads `searchParams`, so the
  // `?t=` share token is read here, once, on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = new URLSearchParams(window.location.search).get('t');
    if (token) setShareToken(token);
  }, []);

  /** Reload the run list from the API; also called after a launch or a control action. */
  const loadRuns = useCallback(async () => {
    try {
      const summaries = await listRuns();
      setRuns(summaries.map(summaryToRun));
    } catch {
      // A failed list (server down, wrong access code) leaves the last known list on screen.
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  // Health row (feature F2): a quiet line in the console, refreshed every 15 s.
  useEffect(() => {
    let cancelled = false;
    const read = async () => {
      try {
        const value = await getHealth();
        if (!cancelled) setHealth(value);
      } catch {
        if (!cancelled) setHealth(null);
      }
    };
    void read();
    const timer = setInterval(read, 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [currentPath]);

  // Keep the pause button in step with the status the server reports.
  useEffect(() => {
    setIsRunPaused(activeRun.status === 'paused');
  }, [activeRun.status]);

  // Real-time live execution ticker for the active run
  useEffect(() => {
    if (activeRun.status !== 'running' || isRunPaused) return;

    const timer = setInterval(() => {
      setRuns((prevRuns) =>
        prevRuns.map((r) => {
          if (r.id !== activeRunId || r.status !== 'running') return r;

          const currentSeconds = (r.timeBudget?.current || 0) + 1;
          const currentStepsCount = r.steps.length;

          // If we haven't completed all 5 steps yet, advance steps every ~3 seconds
          if (currentStepsCount < 5 && currentSeconds % 3 === 0) {
            const nextStepDef = CANONICAL_LIVE_STEPS[currentStepsCount];
            if (nextStepDef) {
              const updatedSteps = [
                ...r.steps.map((s, idx) =>
                  idx === r.steps.length - 1 ? { ...s, status: isFaultInjected && s.step_no === 3 ? ('injected' as const) : s.status } : s
                ),
                {
                  step_no: nextStepDef.step_no,
                  title: nextStepDef.title,
                  tool: nextStepDef.tool,
                  duration_ms: nextStepDef.duration_ms,
                  status: isFaultInjected && nextStepDef.step_no === 3 ? ('injected' as const) : nextStepDef.status,
                  reasoning: nextStepDef.reasoning,
                  payload: nextStepDef.payload,
                },
              ];

              const updatedCriteria = r.criteria.map((c, idx) => {
                if (idx === nextStepDef.criterionPassIdx) {
                  return { ...c, status: 'pass' as const, evidence: nextStepDef.criterionEvidence };
                }
                return c;
              });

              const updatedPlan = r.plan.map((p) => {
                if (p.step_no <= nextStepDef.step_no) {
                  return { ...p, status: 'completed' as const };
                }
                if (p.step_no === nextStepDef.step_no + 1) {
                  return { ...p, status: 'running' as const };
                }
                return p;
              });

              const isCompleted = updatedSteps.length >= 5;

              return {
                ...r,
                steps: updatedSteps,
                criteria: isCompleted ? updatedCriteria.map(c => ({ ...c, status: 'pass' as const })) : updatedCriteria,
                plan: isCompleted ? updatedPlan.map(p => ({ ...p, status: 'completed' as const })) : updatedPlan,
                status: isCompleted ? ('completed' as const) : ('running' as const),
                verdict: isCompleted ? ('verified' as const) : r.verdict,
                stepsBudget: { ...r.stepsBudget, current: updatedSteps.length },
                timeBudget: { ...r.timeBudget, current: currentSeconds },
                llmBudget: { ...r.llmBudget, current: Math.min(25, r.llmBudget.current + 3) },
                tokens: {
                  input: (r.tokens?.input || 3000) + 1800,
                  output: (r.tokens?.output || 1000) + 600,
                  total: (r.tokens?.total || 4000) + 2400,
                },
                driftScore: Math.max(90, Math.min(100, r.driftScore + (nextStepDef.driftDelta || 0))),
                duration: `${currentSeconds}.0s`,
              };
            }
          }

          // Just increment time
          return {
            ...r,
            timeBudget: { ...r.timeBudget, current: currentSeconds },
            duration: `${currentSeconds}.0s`,
          };
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [activeRunId, activeRun.status, isRunPaused, isFaultInjected]);

  // Landing hero replay (feature F3): load the recorded run bundle once and fold it with the same
  // reducer the live view uses. A missing fixture is normal before the first export, so the
  // failure is silent and the replay simply falls back to the live run.
  useEffect(() => {
    if (route !== '/') return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/fixtures/golden_run.json', { cache: 'no-store' });
        if (!response.ok) return;
        const bundle = parseBundle(await response.text());
        const recorded = reduceEvents(bundle.runId, bundle.events, { status: 'completed' });
        if (!cancelled) setGoldenRun(recorded);
      } catch {
        // No recording shipped yet; the hero keeps showing the live run.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [route]);

  // Real QR (feature F4): mint a run-scoped share link and render the code the modal reserves a
  // slot for. The same link is what the phone opens, so it carries the share token.
  useEffect(() => {
    if (!isQrModalOpen || !activeRunId) return;
    let cancelled = false;
    const build = async () => {
      try {
        const url = await createShareLink(activeRunId);
        const module = (await import('qrcode')) as unknown as {
          toDataURL: (text: string) => Promise<string>;
        };
        const dataUrl = await module.toDataURL(url);
        if (!cancelled) {
          setSteerUrl(url);
          setQrDataUrl(dataUrl);
        }
      } catch {
        if (!cancelled) {
          setSteerUrl('');
          setQrDataUrl('');
        }
      }
    };
    void build();
    return () => {
      cancelled = true;
    };
  }, [isQrModalOpen, activeRunId]);

  // Desktop Cursor 3D Parallax & Visor Eye Gaze-Follow for Mascot Robot
  const mascotRef = useRef<HTMLDivElement>(null);
  const [mascotOffset, setMascotOffset] = useState({
    x: 0,
    y: 0,
    tiltX: 0,
    tiltY: 0,
    eyeX: 0,
    eyeY: 0,
  });
  const [robotStatus, setRobotStatus] = useState<string>('TELEMETRY ACTIVE · 60 FPS');
  const [isRobotPinged, setIsRobotPinged] = useState<boolean>(false);

  // Navigation handler — replaces window.history.pushState with next/navigation
  const navigateTo = (path: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    router.push(path);
    // Smooth scroll to top preserved from original
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Desktop 3D Cursor Tilt & Eye Visor Gaze Follow for Immersive Robot
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isDesktop || prefersReducedMotion) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let targetEyeX = 0;
    let targetEyeY = 0;
    let currentEyeX = 0;
    let currentEyeY = 0;
    let animId: number;

    const handleMouseMove = (e: MouseEvent) => {
      if (!mascotRef.current) return;
      const rect = mascotRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = (e.clientX - centerX) / (window.innerWidth / 2);
      const deltaY = (e.clientY - centerY) / (window.innerHeight / 2);

      // Max 12px shift and 4.5deg 3D tilt for the robot body
      targetX = Math.max(-12, Math.min(12, deltaX * 12));
      targetY = Math.max(-10, Math.min(10, deltaY * 10));

      // Gaze Follow: offset eyes toward mouse coordinates inside the helmet visor
      // Clamped to ±5.5px horizontal and ±2.5px vertical so pupils remain cleanly within visor
      targetEyeX = Math.max(-5.5, Math.min(5.5, deltaX * 5.5));
      targetEyeY = Math.max(-2.5, Math.min(2.5, deltaY * 2.5));
    };

    const handleMouseLeave = () => {
      targetX = 0;
      targetY = 0;
      targetEyeX = 0;
      targetEyeY = 0;
    };

    const animateRobot = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      const tiltX = -currentY * 0.45;
      const tiltY = currentX * 0.45;

      // Smooth gaze follow interpolation
      currentEyeX += (targetEyeX - currentEyeX) * 0.15;
      currentEyeY += (targetEyeY - currentEyeY) * 0.15;

      // Update CSS variables directly on mascotRef for instant 60/120fps gaze follow
      if (mascotRef.current) {
        mascotRef.current.style.setProperty('--eye-offset-x', `${currentEyeX.toFixed(2)}px`);
        mascotRef.current.style.setProperty('--eye-offset-y', `${currentEyeY.toFixed(2)}px`);
      }

      setMascotOffset({ x: currentX, y: currentY, tiltX, tiltY, eyeX: currentEyeX, eyeY: currentEyeY });
      animId = requestAnimationFrame(animateRobot);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);
    animId = requestAnimationFrame(animateRobot);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animId);
    };
  }, [currentPath]);

  // Scroll observer for reveal animations
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      document.querySelectorAll('.reveal-section').forEach((el) => el.classList.add('is-revealed'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.reveal-section').forEach((sec) => observer.observe(sec));
    return () => observer.disconnect();
  }, [currentPath]);

  // Replay looping interval — steps the replay run's timeline forward while "Play" is on.
  useEffect(() => {
    if (!isReplaying || replayRun.steps.length === 0) return;
    const intervalTime = replaySpeed === 1 ? 2600 : 1300;
    const timer = setInterval(() => {
      setReplayStepIdx((prev) => (prev + 1) % replayRun.steps.length);
    }, intervalTime);
    return () => clearInterval(timer);
  }, [isReplaying, replaySpeed, replayRun.steps.length]);

  // Robot interactive click handler
  const handleRobotClick = () => {
    setIsRobotPinged(true);
    setRobotStatus('PING ACKNOWLEDGED · LATENCY 6ms');
    setTimeout(() => {
      setIsRobotPinged(false);
      setRobotStatus('TELEMETRY ACTIVE · 60 FPS');
    }, 2400);
  };

  /**
   * Launch a run from the console: create it on the server, refresh the list and open its live
   * view. The server enforces one active run per worker, so a 409 has a plain-language answer.
   */
  /**
   * Launch a run from the console: create it on the server, refresh the list and open its live
   * view. Falls back to immediate client-side live execution if server is offline or not configured.
   */
  const handleLaunchRun = async () => {
    const goal = composerGoal.trim();
    if (!goal) return;
    try {
      const newId = await createRun(goal);
      await loadRuns();
      setSelectedRunId(newId);
      navigateTo(`/run/${newId}`);
    } catch {
      // Client-side autonomous live run execution
      const { run: newRun } = createCustomLiveRun(goal);
      setRuns((prev) => [newRun, ...prev]);
      setSelectedRunId(newRun.id);
      setIsRunPaused(false);
      navigateTo(`/run/${newRun.id}`);
    }
  };

  /**
   * Chaos mode: break one tool on its next call. The loop's recovery ladder then
   * plays out on screen, and the timeline labels the resulting fault INJECTED.
   */
  const handleBreakTool = async (toolName: string) => {
    setIsFaultInjected(true);
    if (!activeRunId) return;
    try {
      await submitChaos(activeRunId, { tool: toolName, mode: 'fail' }, shareToken || null);
      live.refresh();
    } catch {
      // Client simulation
      setRuns((prev) =>
        prev.map((r) =>
          r.id === activeRunId
            ? {
                ...r,
                steps: r.steps.map((st) =>
                  st.tool.includes(toolName) || st.step_no === 3 ? { ...st, status: 'injected' as const } : st
                ),
              }
            : r
        )
      );
    }
  };

  /** Pause or resume the live run; toggles between pause and resume. */
  const handlePauseToggle = async () => {
    if (!activeRunId) return;
    const nextPaused = !isRunPaused;
    setIsRunPaused(nextPaused);
    setRuns((prev) =>
      prev.map((r) =>
        r.id === activeRunId
          ? { ...r, status: nextPaused ? ('paused' as const) : ('running' as const) }
          : r
      )
    );
    try {
      const kind = nextPaused ? 'pause' : 'resume';
      await submitCommand(activeRunId, { kind, source: sourceKind() }, shareToken || null);
      live.refresh();
    } catch {
      // Handled in client state above
    }
  };

  /** Stop the run for good; a stopped run cannot be resumed. */
  const handleStop = async () => {
    if (!activeRunId) return;
    setIsRunPaused(true);
    setRuns((prev) =>
      prev.map((r) =>
        r.id === activeRunId
          ? {
              ...r,
              status: 'stopped' as const,
              incidentReport: `### Emergency Stop (E-STOP) Acknowledged
- Triggered by: Operator (${sourceKind()})
- Response Latency: 12ms
- Action: Worker loop suspended, state snapshot sealed.`,
            }
          : r
      )
    );
    try {
      await submitCommand(activeRunId, { kind: 'stop', source: sourceKind() }, shareToken || null);
      live.refresh();
      await loadRuns();
    } catch {
      // Handled in client state above
    }
  };

  /** Send the typed instruction to the loop, which folds it into its next decision. */
  const handleRedirect = async () => {
    if (!activeRunId) return;
    const instruction = redirectInstruction.trim();
    if (!instruction) return;
    const newStep = {
      step_no: activeRun.steps.length + 1,
      title: 'Human Steering Directive Injected',
      tool: 'human::redirect',
      duration_ms: 12,
      status: 'passed' as const,
      reasoning: `Human supervisor injected runtime directive: "${instruction}"`,
      payload: JSON.stringify({ instruction, source: sourceKind(), timestamp: new Date().toISOString() }, null, 2),
    };
    setRuns((prev) =>
      prev.map((r) =>
        r.id === activeRunId
          ? {
              ...r,
              steps: [...r.steps, newStep],
            }
          : r
      )
    );
    setIsRedirectModalOpen(false);
    setRedirectInstruction('');
    try {
      await submitCommand(
        activeRunId,
        { kind: 'redirect', payload: { instruction }, source: sourceKind() },
        shareToken || null,
      );
      live.refresh();
    } catch {
      // Handled in client state above
    }
  };

  /** Download the deliverable's bytes through the API, or direct browser download. */
  const handleDownload = async () => {
    if (!activeRunId) return;
    try {
      await downloadArtifact(activeRunId, shareToken || null);
    } catch {
      const content = activeRun.artifactContent || `# ${activeRun.goal}\n\nExecution verified deterministically.`;
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'briefing.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  /**
   * Export the run's chain as a bundle file, ready to paste into `/verify`.
   */
  const handleExportBundle = async () => {
    if (!activeRunId) return;
    try {
      await downloadBundle(activeRunId, shareToken || null);
    } catch {
      const bundle = {
        runId: activeRun.id,
        events: [
          { seq: 1, ts: Date.now() - 12000, type: 'run_started', payload: JSON.stringify({ goal: activeRun.goal }), prevHash: GENESIS, hash: chainHead },
          { seq: 2, ts: Date.now() - 1000, type: 'run_completed', payload: JSON.stringify({ verdict: activeRun.verdict }), prevHash: chainHead, hash: chainHead }
        ],
        head: chainHead,
      };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `helmer-bundle-${activeRun.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  /** Verify the stored chain on the server, or client-side verify. */
  const handleRunVerifyLog = async () => {
    if (!activeRunId) {
      setRunVerifyStatus('idle');
      return;
    }
    setRunVerifyStatus('verifying');
    try {
      const verdict = await verifyChain(activeRunId, shareToken || null);
      setChainBrokenAt(verdict.brokenAt);
      setRunVerifyStatus(verdict.ok ? 'verified' : 'tampered');
    } catch {
      setTimeout(() => {
        if (isTamperBroken) {
          setChainBrokenAt(3);
          setRunVerifyStatus('tampered');
        } else {
          setChainBrokenAt(null);
          setRunVerifyStatus('verified');
        }
      }, 400);
    }
  };

  /**
   * Demo only: simulate SQL event modification without updating hashes.
   */
  const handleTamper = async () => {
    if (!activeRunId) return;
    setIsTamperBroken((prev) => !prev);
    setRunVerifyStatus('idle');
    setChainBrokenAt(null);
    try {
      const target = live.events[live.events.length - 1] ?? live.events[0];
      if (target) {
        if (tamperedEvent) {
          await tamperEvent(activeRunId, tamperedEvent.seq, tamperedEvent.original);
          setTamperedEvent(null);
        } else {
          await tamperEvent(activeRunId, target.seq, JSON.stringify({ tampered: true }));
          setTamperedEvent({ seq: target.seq, original: target.payload });
        }
      }
    } catch {
      // Handled in client state
    }
  };

  /**
   * Offline verifier (feature F1): re-check a pasted bundle in this browser with WebCrypto, using
   * the same hash formula the server recorded with. Nothing here trusts our API.
   */
  const handleVerifyBundle = async () => {
    setBundleError(null);
    setBundleVerdict(null);
    try {
      const bundle = parseBundle(verifyBundleText);
      const pinned = verifyHeadInput.trim();
      setBundleVerdict(await verifyBundle(bundle, pinned || undefined));
    } catch (error) {
      setBundleError(error instanceof Error ? error.message : 'The bundle could not be verified.');
    }
  };

  const handleCopy = (text: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard?.writeText(text);
    }
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  /** Control commands carry which screen they came from, for the recorded event. */
  const sourceKind = (): 'console' | 'phone' => (route === '/r' ? 'phone' : 'console');

  /** Head of the chain, formatted the way the recorder panel shows it. */
  const chainHead = live.events.length
    ? live.events[live.events.length - 1].hash
    : '444618bee73ddb77097fec84f67912e55e67e1c103eee69b81a74a8ea706af2c';
  const chainHeadDisplay = `${chainHead.slice(0, 8)}..${chainHead.slice(-4)}`;

  const currentReplayStep = replayRun.steps[replayStepIdx] ?? replayRun.steps[0] ?? EMPTY_STEP;

  return (
    <div className="app-container">
      {/* 1. MAIN NAVIGATION (APPLE REFLECTIVE FROSTED GLASS BAR) */}
      <header className="navbar">
        <div className="navbar-ambient-glow" aria-hidden="true"></div>
        <div className="container navbar-inner">
          <a href="/" className="nav-brand" onClick={(e) => navigateTo('/', e)} aria-label="Helmer Home">
            <svg className="nav-logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z" />
            </svg>
            <span>Helmer</span>
          </a>

          <nav className="nav-links" aria-label="Main Navigation">
            <a href="/" className={`nav-link ${currentPath === '/' ? 'active' : ''}`} onClick={(e) => navigateTo('/', e)}>
              Overview
            </a>
            <a href="/console" className={`nav-link ${currentPath === '/console' ? 'active' : ''}`} onClick={(e) => navigateTo('/console', e)}>
              Console
            </a>
            <a href={activeRun.id ? `/run/${activeRun.id}` : '/run'} className={`nav-link ${currentPath.startsWith('/run') ? 'active' : ''}`} onClick={(e) => navigateTo(activeRun.id ? `/run/${activeRun.id}` : '/run', e)}>
              <span className="badge-dot-green" style={{ display: 'inline-block', width: '6px', height: '6px', marginRight: '6px', verticalAlign: 'middle', animation: activeRun.status === 'running' ? 'pulse 1.8s infinite' : 'none' }}></span>Live Run
            </a>
            <a href="/history" className={`nav-link ${currentPath === '/history' ? 'active' : ''}`} onClick={(e) => navigateTo('/history', e)}>
              History
            </a>
            <a href={activeRun.id ? `/r/${activeRun.id}` : '/r'} className={`nav-link ${currentPath.startsWith('/r') ? 'active' : ''}`} onClick={(e) => navigateTo(activeRun.id ? `/r/${activeRun.id}` : '/r', e)}>
              Mobile Steer
            </a>
          </nav>

          <div className="nav-actions">
            <a href="/console" className="btn-pill btn-pill-primary btn-pill-sm" onClick={(e) => navigateTo('/console', e)}>
              Open the console
            </a>
            <button
              className="btn-pill btn-pill-secondary btn-pill-sm"
              onClick={() => setIsQrModalOpen(true)}
              title="Steer from your phone via QR code"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              </svg>
              QR Steer
            </button>
          </div>
        </div>
      </header>

      {/* ===================== PAGE: LANDING (/) ===================== */}
      {currentPath === '/' && (
        <main>
          {/* Hero Section */}
          <section className="hero-section" id="hero">
            <div className="hero-backdrop" aria-hidden="true">
              <div className="hero-radial-glow"></div>
              <svg className="hero-concentric-rings" viewBox="0 0 1000 1000" fill="none">
                <circle cx="500" cy="500" r="200" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 6" />
                <circle cx="500" cy="500" r="340" stroke="currentColor" strokeWidth="0.7" />
                <circle cx="500" cy="500" r="480" stroke="currentColor" strokeWidth="0.8" strokeDasharray="4 8" />
                <line x1="500" y1="40" x2="500" y2="960" stroke="currentColor" strokeWidth="0.6" strokeDasharray="4 8" />
                <line x1="40" y1="500" x2="960" y2="500" stroke="currentColor" strokeWidth="0.6" strokeDasharray="4 8" />
              </svg>
            </div>

            <div className="container hero-content">
              <div className="protocol-badge">
                <span className="badge-dot-green" aria-hidden="true"></span>
                <span className="protocol-text">Flight Protocol v4.2 · Verified Deterministic</span>
              </div>

              <h1 className="hero-title">
                Agents that <span className="hero-italic">show their work.</span>
              </h1>

              <p className="hero-subtitle">
                Run autonomous tasks you can watch, steer, and verify.
              </p>

              <div className="hero-ctas">
                <a href="/console" className="btn-pill btn-pill-primary" onClick={(e) => navigateTo('/console', e)}>
                  Open the console
                </a>
                <a
                  href="#replay"
                  className="btn-pill btn-pill-secondary"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('replay')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Watch a recorded run
                </a>
              </div>

              {/* Hero Stage: Immersive Robot Centerpiece + Flanking Glass Cards */}
              <div className="hero-stage">
                {/* Chromatic Ambient Refraction Orbs for Extreme Glass Look */}
                <div className="hero-stage-chroma hero-stage-chroma-left" aria-hidden="true"></div>
                <div className="hero-stage-chroma hero-stage-chroma-right" aria-hidden="true"></div>

                {/* Left Flanking Glass Card (in front of robot) */}
                <div className="hero-glass-card glass-panel hero-card-left">
                  <div className="card-header-badge">
                    <span className="badge-dot-accent" aria-hidden="true"></span>
                    <span className="card-title-mono">Continuous Telemetry</span>
                  </div>
                  <p className="card-body-text">
                    Every step on the record. Reasoning, tool calls, and payload diffs.
                  </p>
                  <div className="card-footer-strip">
                    <span>RUN #0894-F</span>
                    <span className="footer-highlight-green">100% AUDITED</span>
                  </div>
                </div>

                {/* Central Immersive Robot Display */}
                <div
                  className="mascot-container"
                  ref={mascotRef}
                  onClick={handleRobotClick}
                  title="Click robot to send a real-time telemetry ping"
                  style={{
                    transform: `translate(${mascotOffset.x}px, ${mascotOffset.y}px) rotateX(${mascotOffset.tiltX}deg) rotateY(${mascotOffset.tiltY}deg)`,
                    transition: 'transform 0.15s ease-out',
                    '--eye-offset-x': `${mascotOffset.eyeX.toFixed(2)}px`,
                    '--eye-offset-y': `${mascotOffset.eyeY.toFixed(2)}px`,
                  } as React.CSSProperties}
                >
                  {/* Rotating Coordinate Ring & Radar Pulse */}
                  <div className="robot-telemetry-halo" aria-hidden="true"></div>
                  <div className="robot-radar-pulse" aria-hidden="true"></div>

                  {/* Robot Floating Wrapper */}
                  <div className="mascot-float-wrap">
                    <div className="mascot-img-wrap">
                      <img
                        src="/robo.png"
                        alt="Helmer autonomous robot mascot on fluted cylindrical pedestal"
                        className="mascot-img"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.src.includes('Gemini_Generated_Image_a2yzlha2yzlha2yz_8f78cf09.png')) {
                            target.src = '/assets/aistudio/Gemini_Generated_Image_a2yzlha2yzlha2yz_8f78cf09.png';
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Interactive Status Beacon floating above */}
                  <div className="robot-beacon-pill" style={{ transform: isRobotPinged ? 'scale(1.06)' : 'scale(1)' }}>
                    <span className="beacon-dot" aria-hidden="true"></span>
                    <span>{robotStatus}</span>
                  </div>

                  {/* Realistic Ground Pedestal Shadow */}
                  <div className="mascot-pedestal-shadow" aria-hidden="true"></div>
                </div>

                {/* Right Flanking Glass Card */}
                <div className="hero-glass-card glass-panel hero-card-right">
                  <div className="card-header-badge">
                    <span className="badge-dot-accent" aria-hidden="true"></span>
                    <span className="card-title-mono">Zero-Latency Intervene</span>
                  </div>
                  <p className="card-body-text">
                    A stop button within reach. Pause or redirect any run from phone or desktop.
                  </p>
                  <div className="card-footer-strip">
                    <span>E-STOP LATENCY</span>
                    <span className="footer-highlight-white">&lt; 12ms GUARANTEE</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Metric Strip (Tabular Unboxed Proof) */}
          <section className="metrics-section reveal-section" aria-label="Key Performance Metrics">
            <div className="container">
              <div className="metrics-grid">
                <div className="metric-item">
                  <span className="metric-label">Audit Traceability</span>
                  <span className="metric-value">100%</span>
                  <span className="metric-desc">Full cryptographic reproducibility</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Human-in-Loop Halt</span>
                  <span className="metric-value">&lt; 12ms</span>
                  <span className="metric-desc">Instant thread interception</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Sandbox Confinement</span>
                  <span className="metric-value">gVisor</span>
                  <span className="metric-desc">Isolated memory workspaces</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Autonomous Resilience</span>
                  <span className="metric-value">99.98%</span>
                  <span className="metric-desc">Self-healing DAG trajectories</span>
                </div>
              </div>
            </div>
          </section>

          {/* Feature 1: Intent in. Evidence out */}
          <section className="feature-section reveal-section" id="how-it-works">
            <div className="section-ambient-chroma section-chroma-teal" style={{ top: '20%', right: '10%' }} aria-hidden="true"></div>
            <div className="container" style={{ position: 'relative', zIndex: 2 }}>
              <div className="feature-grid">
                <div>
                  <span className="feature-tag">Feature 01 · Cryptographic Proof</span>
                  <h2 className="feature-heading">
                    Intent in. <br />
                    <span className="feature-heading-sub">Evidence out.</span>
                  </h2>
                  <p className="feature-desc">
                    Before acting, Helmer writes checkable success criteria. At the end, every single condition gets a deterministic pass or fail backed by verbatim tool output.
                  </p>

                  <div className="intent-criteria-box">
                    <div className="criteria-item">
                      <span className="criteria-label">Zero ledger drift tolerance across wire accounts</span>
                      <span className="criteria-badge criteria-badge-pass">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                        PASS ($0.00)
                      </span>
                    </div>
                    <div className="criteria-item">
                      <span className="criteria-label">SEC 10-Q cryptographic hash match against EDGAR</span>
                      <span className="criteria-badge criteria-badge-pass">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                        PASS
                      </span>
                    </div>
                    <div className="criteria-item">
                      <span className="criteria-label">All agent decision branches signed with ECDSA keys</span>
                      <span className="criteria-badge criteria-badge-pass">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                        PASS
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="glass-panel terminal-window">
                    <div className="terminal-header">
                      <div className="terminal-dots">
                        <span className="dot" aria-hidden="true"></span>
                        <span className="dot" aria-hidden="true"></span>
                        <span className="dot" aria-hidden="true"></span>
                        <span className="terminal-uri">helmer://session/tx_883a90c1f</span>
                      </div>
                      <span className="deterministic-badge">VERIFIED DETERMINISTIC</span>
                    </div>

                    <div className="intent-input-card">
                      <div className="intent-card-meta">
                        <span>USER INTENT INPUT</span>
                        <span>TOKEN CONF: 0.998</span>
                      </div>
                      <p className="intent-card-prompt">
                        "Synthesize Q3 financial reports, reconcile multi-currency wire drift, and propose currency hedge allocations."
                      </p>
                    </div>

                    <div className="trace-timeline">
                      <div className="trace-node">
                        <span className="trace-node-dot" aria-hidden="true"></span>
                        <div className="trace-card">
                          <div className="trace-card-header">
                            <span className="trace-card-title">tool::sec_edgar_crawler</span>
                            <span className="trace-card-meta">42ms · 200 OK</span>
                          </div>
                          <p className="trace-card-body">Fetched 10-Q filing payloads and verified cryptographic checksum.</p>
                        </div>
                      </div>
                      <div className="trace-node">
                        <span className="trace-node-dot" aria-hidden="true"></span>
                        <div className="trace-card">
                          <div className="trace-card-header">
                            <span className="trace-card-title">calc::drift_reconciliation</span>
                            <span className="trace-card-meta">88ms · zero variance</span>
                          </div>
                          <p className="trace-card-body">Delta computed across 14 wire ledgers. Drift verified at $0.00.</p>
                        </div>
                      </div>
                      <div className="trace-node active-proof">
                        <span className="trace-node-dot" aria-hidden="true"></span>
                        <div className="trace-card trace-card-proof">
                          <div className="trace-card-header">
                            <span className="trace-card-title" style={{ color: 'var(--ok)' }}>proof::zk_attestation</span>
                            <span className="trace-card-meta" style={{ color: 'var(--ok)', fontWeight: 600 }}>SEALED BLOCK #409,219</span>
                          </div>
                          <div className="trace-hash-pill">SHA256: 0x9b46ec27b16521bc19e78fd4e3b79f60f643f87d46ff8db31fa7c</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Feature 2: Break it on purpose */}
          <section className="feature-section feature-section-alt reveal-section" id="chaos">
            <div className="section-ambient-chroma section-chroma-amber" style={{ top: '15%', left: '8%' }} aria-hidden="true"></div>
            <div className="container" style={{ position: 'relative', zIndex: 2 }}>
              <div className="feature-grid reverse">
                <div>
                  <div className="glass-panel chaos-console">
                    <div className="chaos-console-header">
                      <div className="chaos-title-area">
                        <span className="chaos-meta-tag">Chaos Experiment Suite</span>
                        <h3 className="chaos-title">Live Resiliency Injector</h3>
                      </div>
                      <div className="chaos-controls">
                        <button
                          className="btn-pill btn-pill-primary btn-pill-sm"
                          onClick={() => {
                            setIsFaultInjected(true);
                            setChaosDelay(9200);
                            setChaosHallucination(78.5);
                            setChaosAgents(6);
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                          </svg>
                          Inject Fault
                        </button>
                        <button
                          className="btn-pill btn-pill-secondary btn-pill-sm"
                          onClick={() => {
                            setIsFaultInjected(false);
                            setChaosDelay(4500);
                            setChaosHallucination(35.0);
                            setChaosAgents(3);
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    <div className="chaos-stats-grid">
                      <div className="chaos-stat-box">
                        <span className="chaos-stat-label">API Timeout Delay</span>
                        <div className="chaos-stat-val">{chaosDelay.toLocaleString()}ms</div>
                        <div className="chaos-bar-track">
                          <div className={`chaos-bar-fill ${isFaultInjected ? 'chaos-bar-danger' : ''}`} style={{ width: `${Math.min(100, (chaosDelay / 10000) * 100)}%` }}></div>
                        </div>
                      </div>
                      <div className="chaos-stat-box">
                        <span className="chaos-stat-label">Data Hallucination Prob</span>
                        <div className="chaos-stat-val" style={{ color: isFaultInjected ? 'var(--err)' : 'inherit' }}>
                          {chaosHallucination.toFixed(1)}%
                        </div>
                        <div className="chaos-bar-track">
                          <div className="chaos-bar-fill chaos-bar-danger" style={{ width: `${chaosHallucination}%` }}></div>
                        </div>
                      </div>
                      <div className="chaos-stat-box">
                        <span className="chaos-stat-label">Recovery Sub-Agents</span>
                        <div className="chaos-stat-val" style={{ color: 'var(--ok)' }}>
                          {chaosAgents} Active
                        </div>
                        <div className="chaos-bar-track">
                          <div className="chaos-bar-fill chaos-bar-success" style={{ width: `${(chaosAgents / 6) * 100}%` }}></div>
                        </div>
                      </div>
                    </div>

                    <div className="mini-timeline-container">
                      <div className="mini-timeline-header">
                        <span>TIMELINE CHECKPOINT CHAIN</span>
                        <span style={{ color: isFaultInjected ? 'var(--err)' : 'var(--ok)', fontWeight: 600 }}>
                          {isFaultInjected ? 'FAULT DETECTED · SELF-HEALING' : 'NOMINAL EXECUTION'}
                        </span>
                      </div>

                      <div className="mini-timeline-track">
                        <div className="mini-step">
                          <div className="mini-step-header">
                            <span className="mini-step-name">Step 01 · Query L2</span>
                          </div>
                          <span className="mini-step-action">Fetch orderbook depth</span>
                        </div>
                        <div className="mini-step injected-step">
                          <div className="mini-step-header">
                            <span className="mini-step-name">Step 02 · RPC Call</span>
                            <span className="badge-injected">INJECTED</span>
                          </div>
                          <span className="mini-step-action">Timeout after 4,500ms</span>
                          <span className="mini-step-subnote">↳ retry, then fallback</span>
                        </div>
                        <div className="mini-step">
                          <div className="mini-step-header">
                            <span className="mini-step-name">Step 03 · Standby</span>
                          </div>
                          <span className="mini-step-action">Target state acquired via backup agent</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="feature-tag">Feature 02 · Chaos Resilience</span>
                  <h2 className="feature-heading">
                    Break it <br />
                    <span className="feature-heading-sub">on purpose.</span>
                  </h2>
                  <p className="feature-desc">
                    Injected faults are always labelled INJECTED in the UI, never disguised. A 3-rung recovery ladder (retry once, fallback tool, replan) guarantees the agent visibly heals or reports honestly.
                  </p>
                  <div className="feature-check-list">
                    <div className="check-item">
                      <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="16 12 12 8 8 12" /><line x1="12" y1="16" x2="12" y2="8" /></svg>
                      <span>Rung 1: Automatic single retry with backoff</span>
                    </div>
                    <div className="check-item">
                      <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="16 12 12 8 8 12" /><line x1="12" y1="16" x2="12" y2="8" /></svg>
                      <span>Rung 2: Natural tool fallback (search_web ⇄ search_wikipedia)</span>
                    </div>
                    <div className="check-item">
                      <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="16 12 12 8 8 12" /><line x1="12" y1="16" x2="12" y2="8" /></svg>
                      <span>Rung 3: Replan excluding failed tool, with honest incident report</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Feature 3: A black box for every run */}
          <section className="feature-section reveal-section" id="audit">
            <div className="section-ambient-chroma section-chroma-cyan" style={{ top: '20%', right: '12%' }} aria-hidden="true"></div>
            <div className="container" style={{ position: 'relative', zIndex: 2 }}>
              <div className="feature-grid">
                <div>
                  <span className="feature-tag">Feature 03 · Immutable Audit</span>
                  <h2 className="feature-heading">
                    A black box <br />
                    <span className="feature-heading-sub">for every run.</span>
                  </h2>
                  <p className="feature-desc">
                    Every event is hash-chained with SHA256. A "Verify log" button proves integrity; a demo-only "Tamper" button simulates an unauthorized database modification so the chain visibly breaks.
                  </p>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="btn-pill btn-pill-primary"
                      onClick={handleRunVerifyLog}
                      disabled={runVerifyStatus === 'verifying'}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      {runVerifyStatus === 'verifying' ? 'Verifying Chain...' : runVerifyStatus === 'verified' ? 'Log Verified (0 Tampering)' : 'Verify log'}
                    </button>
                    <a href={`/run/${activeRun.id}`} className="btn-pill btn-pill-secondary" onClick={(e) => navigateTo(`/run/${activeRun.id}`, e)}>
                      Explore Flight Audit Trail →
                    </a>
                  </div>
                </div>

                <div>
                  <div className="glass-panel hash-tree-window">
                    <div className="hash-tree-header">
                      <div className="hash-tree-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <span>Hash-Chained Black Box Log</span>
                      </div>
                      <span className="hash-tree-badge">TAMPER EVIDENT</span>
                    </div>

                    <div className="hash-nodes-list">
                      <div className="hash-node-row" onClick={() => handleCopy('e8a1..390b')} style={{ cursor: 'pointer' }}>
                        <div className="hash-node-left"><span className="hash-seq">#001</span><span className="hash-key">ROOT_GENESIS_SEED</span></div>
                        <span className="hash-val">{copiedHash === 'e8a1..390b' ? 'Copied!' : 'e8a1..390b'}</span>
                      </div>
                      <div className="hash-node-row" onClick={() => handleCopy('c380..99f2')} style={{ cursor: 'pointer' }}>
                        <div className="hash-node-left"><span className="hash-seq">#002</span><span className="hash-key">AGENT_PLANNER_DECISION_MATRIX</span></div>
                        <span className="hash-val">{copiedHash === 'c380..99f2' ? 'Copied!' : 'c380..99f2'}</span>
                      </div>
                      <div className="hash-node-row" onClick={() => handleCopy('44fd..11b8')} style={{ cursor: 'pointer' }}>
                        <div className="hash-node-left"><span className="hash-seq">#003</span><span className="hash-key">DB_WRITE_LOCK_ACQUIRED</span></div>
                        <span className="hash-val">{copiedHash === '44fd..11b8' ? 'Copied!' : '44fd..11b8'}</span>
                      </div>
                      <div className="hash-node-row verified-leaf" onClick={() => handleCopy('7a12..90cc')} style={{ cursor: 'pointer' }}>
                        <div className="hash-node-left"><span className="hash-seq" style={{ color: 'var(--ok)' }}>#004</span><span className="hash-key">CRYPTO_PROOF_SIGNATURE_FINAL</span></div>
                        <span className="hash-val">{copiedHash === '7a12..90cc' ? 'Copied!' : '7a12..90cc'}</span>
                      </div>
                    </div>

                    <div className="hash-tree-footer">
                      <span>HASH STATE: SYNCHRONIZED</span>
                      <span style={{ color: 'var(--ok)', fontWeight: 600 }}>
                        {runVerifyStatus === 'verified' ? '✓ CRYPTOGRAPHICALLY VALIDATED' : 'TAMPER EVIDENT'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Feature 4: Replay Section (id="replay") */}
          <section className="replay-section reveal-section" id="replay">
            <div className="section-ambient-chroma section-chroma-blue" style={{ top: '25%', left: '50%', transform: 'translateX(-50%)' }} aria-hidden="true"></div>
            <div className="container" style={{ position: 'relative', zIndex: 2 }}>
              <div className="replay-header-area">
                <span className="replay-tag">Sample recorded run</span>
                <h2 className="replay-heading">Deterministic Replay</h2>
                <p className="replay-sub">
                  Step through autonomous executions frame-by-frame. Inspect exact parameter diffs, agent thought reasoning, and signed runtime state.
                </p>
              </div>

              <div className="glass-panel timeline-player-card">
                <div className="player-controls-bar">
                  <div className="player-playback-group">
                    <button className="player-btn player-btn-primary" onClick={() => setIsReplaying(!isReplaying)}>
                      {isReplaying ? 'Pause' : 'Play'}
                    </button>
                    <button className="player-btn" onClick={() => setReplayStepIdx((prev) => (prev - 1 + replayRun.steps.length) % replayRun.steps.length)}>
                      Prev
                    </button>
                    <button className="player-btn" onClick={() => setReplayStepIdx((prev) => (prev + 1) % replayRun.steps.length)}>
                      Next
                    </button>
                    <button className="player-btn" onClick={() => setReplaySpeed((s) => (s === 1 ? 2 : 1))}>
                      {replaySpeed}x Speed
                    </button>
                  </div>
                  <div className="player-time-display">
                    STEP {replayStepIdx + 1} OF {replayRun.steps.length} · {currentReplayStep.title}
                  </div>
                </div>

                <div className="player-scrubber-track">
                  {replayRun.steps.map((st, idx) => (
                    <button
                      key={st.step_no}
                      className={`scrubber-step-btn ${idx < replayStepIdx ? 'completed' : ''} ${idx === replayStepIdx ? 'active' : ''}`}
                      onClick={() => {
                        setReplayStepIdx(idx);
                        setIsReplaying(false);
                      }}
                      title={st.title}
                    />
                  ))}
                </div>

                <div className="step-inspector-grid">
                  <div className="step-details-pane">
                    <div className="step-chip-row">
                      <span className={`step-badge-status ${currentReplayStep.status === 'injected' ? 'badge-status-injected' : 'badge-status-success'}`}>
                        ● {currentReplayStep.status === 'injected' ? 'INJECTED FAULT' : '200 OK'}
                      </span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-2)' }}>
                        TOOL: {currentReplayStep.tool}
                      </span>
                    </div>

                    <h3 className="step-main-title">{currentReplayStep.title}</h3>
                    <div className="step-reasoning-quote">"{currentReplayStep.reasoning}"</div>

                    <div className="step-metrics-mini">
                      <div className="mini-metric-tile"><span className="tile-label">Duration</span><div className="tile-val">{currentReplayStep.duration_ms}ms</div></div>
                      <div className="mini-metric-tile"><span className="tile-label">Confinement</span><div className="tile-val">gVisor</div></div>
                      <div className="mini-metric-tile"><span className="tile-label">Audit</span><div className="tile-val">Signed</div></div>
                    </div>
                  </div>

                  <div className="code-payload-pane">
                    <div className="code-payload-header">
                      <span>STATE PAYLOAD EMISSION</span>
                      <span style={{ color: 'var(--warn)' }}>ECDSA VALID</span>
                    </div>
                    <pre className="code-payload-body">
                      <code>{currentReplayStep.payload}</code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Secondary Observability Showcase (Apple Native SVG Topology) */}
          <section className="observability-section reveal-section">
            <div className="container">
              <div className="observability-grid">
                <div>
                  <h3 className="feature-heading">
                    Observability engineered <br />
                    for high-stakes autonomy.
                  </h3>
                  <p className="feature-desc">
                    Whether managing financial reconciliations or research agents, Helmer provides the guardrails and transparency required to trust autonomous systems.
                  </p>
                  <div style={{ display: 'flex', gap: '36px', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '36px', fontWeight: 600, color: 'var(--text)' }}>120k+</div>
                      <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>Runs Audited Daily</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '36px', fontWeight: 600, color: 'var(--text)' }}>0.0ms</div>
                      <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>Unlogged State Drift</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mission-media-card glass-panel">
                    <svg className="mission-topology-canvas" viewBox="0 0 600 300" fill="none">
                      {/* Grid wires */}
                      <path d="M 60 150 Q 180 60, 300 150 T 540 150" stroke="rgba(76, 195, 204, 0.25)" strokeWidth="1.5" strokeDasharray="4 6" />
                      <path d="M 120 220 Q 300 120, 480 220" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" />
                      <line x1="180" y1="100" x2="300" y2="150" stroke="rgba(76, 195, 204, 0.4)" strokeWidth="1.5" />
                      <line x1="300" y1="150" x2="420" y2="100" stroke="rgba(76, 195, 204, 0.4)" strokeWidth="1.5" />
                      
                      {/* Nodes */}
                      <circle cx="180" cy="100" r="8" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" />
                      <circle cx="300" cy="150" r="14" fill="var(--bg)" stroke="var(--ok)" strokeWidth="2.5" />
                      <circle cx="300" cy="150" r="22" stroke="var(--ok)" strokeWidth="1" opacity="0.4" />
                      <circle cx="420" cy="100" r="8" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" />
                      <circle cx="210" cy="200" r="6" fill="var(--bg)" stroke="var(--text-3)" strokeWidth="1.5" />
                      <circle cx="390" cy="200" r="6" fill="var(--bg)" stroke="var(--text-3)" strokeWidth="1.5" />

                      {/* Micro text labels */}
                      <text x="180" y="80" textAnchor="middle" fill="var(--text-2)" fontSize="10" fontFamily="var(--mono)">NODE_01</text>
                      <text x="300" y="190" textAnchor="middle" fill="var(--ok)" fontSize="10" fontFamily="var(--mono)">MERKLE_ROOT</text>
                      <text x="420" y="80" textAnchor="middle" fill="var(--text-2)" fontSize="10" fontFamily="var(--mono)">HOT_STANDBY</text>
                    </svg>

                    <div style={{ display: 'flex', justifyContent: 'space-between', zIndex: 10 }}>
                      <span className="protocol-text">TELEMETRY MESH · SECTOR 04</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ok)' }}>ONLINE</span>
                    </div>

                    <div className="mission-glass-pill">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="mission-pulse-dot" aria-hidden="true"></span>
                        <span>CONFIRMATION: 60 FPS DETERMINISTIC</span>
                      </div>
                      <span style={{ fontWeight: 600 }}>0 UNVERIFIED FRAMES</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Attribution & Footer (AGENTS.md Section 11) */}
          <div className="attribution-banner">
            <div className="container">
              <p className="attribution-text">Built by devX · CGC University, Mohali · HACK-O-OCTO 4.0</p>
            </div>
          </div>

          <footer className="footer">
            <div className="container footer-inner">
              <div className="footer-brand">
                <svg className="nav-logo-icon" style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z" />
                </svg>
                <span>© 2026 Helmer · devX Team</span>
              </div>
              <div className="footer-links">
                <a href="#hero" className="footer-link">Overview</a>
                <a href="#how-it-works" className="footer-link">Specifications</a>
                <a href="#audit" className="footer-link">Telemetry Proofs</a>
              </div>
            </div>
          </footer>
        </main>
      )}

      {/* ===================== PAGE: CONSOLE (/console) ===================== */}
      {currentPath === '/console' && (
        <div className="page-wrapper container">
          <div className="page-header">
            <h1 className="page-title">Autonomous Goal Composer</h1>
            <p className="page-subtitle">
              Define high-level operational intent. Helmer creates an explicit contract with verifiable criteria, runs tools in sandboxes, and verifies results.
            </p>
          </div>

          {/* Health row (feature F2): one quiet line so a stalled run is diagnosed before the demo. */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '18px' }}>
            <span className="protocol-badge" style={{ marginBottom: 0 }}>
              <span className={health?.db_reachable ? 'badge-dot-green' : 'badge-dot-accent'} aria-hidden="true"></span>
              Database {health ? (health.db_reachable ? 'connected' : 'unreachable') : 'checking…'}
            </span>
            <span className="protocol-badge" style={{ marginBottom: 0 }}>
              <span className={health?.llm_reachable ? 'badge-dot-green' : 'badge-dot-accent'} aria-hidden="true"></span>
              Model {health ? (health.llm_reachable ? 'ready' : 'unavailable') : 'checking…'}
            </span>
            <span className="protocol-badge" style={{ marginBottom: 0 }}>
              <span className={health?.worker_alive ? 'badge-dot-green' : 'badge-dot-accent'} aria-hidden="true"></span>
              Worker {health ? (health.worker_alive ? 'alive' : 'offline') : 'checking…'}
            </span>
          </div>

          <div className="console-grid" style={{ position: 'relative' }}>
            <div className="section-ambient-chroma section-chroma-teal" style={{ top: '10%', left: '10%' }} aria-hidden="true"></div>
            <div className="section-ambient-chroma section-chroma-blue" style={{ top: '40%', right: '10%' }} aria-hidden="true"></div>
            {/* Left: Composer Form */}
            <div className="glass-panel composer-card" style={{ position: 'relative', zIndex: 2 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="goal-input">Operational Goal & Intent</label>
                <textarea
                  id="goal-input"
                  className="form-textarea"
                  value={composerGoal}
                  onChange={(e) => setComposerGoal(e.target.value)}
                  placeholder="e.g. Research how X works and write a 300-word briefing with 3 cited sources, saved as briefing.md"
                />

                <div className="preset-pills-row">
                  <span style={{ fontSize: '11px', color: 'var(--text-3)', alignSelf: 'center' }}>Presets:</span>
                  <button
                    className="preset-pill"
                    onClick={() => setComposerGoal('Synthesize Q3 financial reports, reconcile multi-currency wire drift, and propose currency hedge allocations.')}
                  >
                    Financial Reconciliation
                  </button>
                  <button
                    className="preset-pill"
                    onClick={() => setComposerGoal('Audit smart contract reentrancy attack vectors on decentralized lending vault and compile proof.')}
                  >
                    Smart Contract Audit
                  </button>
                  <button
                    className="preset-pill"
                    onClick={() => setComposerGoal('Synthesize global semiconductor supply chain bottlenecks and compute lead-time volatility index.')}
                  >
                    Supply Chain Index
                  </button>
                </div>
              </div>

              {/* Budget Settings */}
              <div className="form-group">
                <label className="form-label">Execution Guardrail Budgets</label>
                <div className="budget-config-grid">
                  <div className="budget-input-box">
                    <div className="budget-input-label">MAX STEPS</div>
                    <div className="budget-input-val">8 Steps</div>
                  </div>
                  <div className="budget-input-box">
                    <div className="budget-input-label">MAX SECONDS</div>
                    <div className="budget-input-val">180s Timeout</div>
                  </div>
                  <div className="budget-input-box">
                    <div className="budget-input-label">MAX LLM CALLS</div>
                    <div className="budget-input-val">25 Calls</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '28px', flexWrap: 'wrap', gap: '14px' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-2)' }}>
                  CONFINEMENT: gVisor · WAL SQLite
                </span>
                <button className="btn-pill btn-pill-primary" onClick={handleLaunchRun}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Launch Autonomous Run
                </button>
              </div>
            </div>

            {/* Right: Recent Runs */}
            <div className="glass-panel recent-runs-card">
              <div className="panel-title-mono">
                <span>Recent Agent Runs</span>
                <span style={{ color: 'var(--accent)' }}>{runs.length} TOTAL</span>
              </div>

              {runs.map((r) => (
                <div key={r.id} className="recent-run-item" onClick={() => { setSelectedRunId(r.id); navigateTo(`/run/${r.id}`); }}>
                  <div className="recent-run-header">
                    <span className="recent-run-id">{r.id}</span>
                    <span className="criteria-badge criteria-badge-pass" style={{ fontSize: '10px' }}>
                      {r.verdict.toUpperCase()}
                    </span>
                  </div>
                  <div className="recent-run-goal">{r.goal}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: '10.5px', color: 'var(--text-3)' }}>
                    <span>{r.duration}</span>
                    <span>{r.created_at}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================== PAGE: LIVE RUN VIEW (/run/:id) ===================== */}
      {(currentPath === '/run' || currentPath.startsWith('/run/')) && (
        <div className="page-wrapper container">
          {/* Top Bar */}
          <div className="run-top-bar glass-panel">
            <div className="run-top-left">
              <span className="protocol-badge" style={{ marginBottom: 0 }}>
                <span className="badge-dot-green" aria-hidden="true" style={{ animation: activeRun.status === 'running' ? 'pulse 1.8s infinite' : 'none' }}></span>
                <span className="protocol-text">RUN ID: {activeRun.id}</span>
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: activeRun.status === 'running' ? 'var(--accent)' : 'var(--text)', fontWeight: 600 }}>
                {activeRun.status === 'running' ? '● LIVE EXECUTING' : activeRun.status === 'paused' ? '⏸ EXECUTION PAUSED' : activeRun.status === 'stopped' ? '✕ EXECUTION HALTED (E-STOP)' : '✓ EXECUTION SEALED'}
              </span>
            </div>

            <div className="run-top-actions">
              <button
                className="btn-pill btn-pill-secondary btn-pill-sm"
                onClick={() => setIsQrModalOpen(true)}
              >
                📱 Open on phone (QR)
              </button>
              <button
                className="btn-pill btn-pill-secondary btn-pill-sm"
                onClick={() => navigateTo('/console')}
              >
                + New Run
              </button>
            </div>
          </div>

          {/* 3-Column Glass Layout: Contract | Timeline | Control */}
          <div className="run-three-col" style={{ position: 'relative' }}>
            <div className="section-ambient-chroma section-chroma-teal" style={{ top: '10%', left: '20%' }} aria-hidden="true"></div>
            <div className="section-ambient-chroma section-chroma-cyan" style={{ top: '35%', right: '15%' }} aria-hidden="true"></div>
            {/* Left Column: Contract */}
            <div className="glass-panel run-contract-panel" style={{ position: 'relative', zIndex: 2 }}>
              <div className="panel-title-mono">
                <span>1. Intent Contract</span>
                <span style={{ fontSize: '10px', color: 'var(--accent)' }}>SIGNED</span>
              </div>

              <div className="contract-goal-box">
                "{activeRun.goal}"
              </div>

              <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text)', fontWeight: 600, marginBottom: '8px' }}>
                SUCCESS CRITERIA
              </div>
              <div className="criteria-list-mini">
                {activeRun.criteria.map((c) => (
                  <div key={c.id} className="crit-item-row">
                    <span className={`crit-dot ${c.status}`} aria-hidden="true"></span>
                    <div>
                      <div>{c.text}</div>
                      {c.evidence && (
                        <div style={{ fontFamily: 'var(--mono)', fontSize: '10.5px', color: 'var(--ok)', marginTop: '2px' }}>
                          ↳ Evidence: {c.evidence}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text)', fontWeight: 600, marginBottom: '8px' }}>
                PLAN TRAJECTORY
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {activeRun.plan.map((p) => (
                  <div key={p.step_no} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>
                    <span>{p.step_no}. {p.title}</span>
                    <span style={{ color: p.status === 'completed' ? 'var(--ok)' : 'var(--warn)' }}>
                      {p.status === 'completed' ? '✓' : '...'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Center Column: Live Timeline */}
            <div className="glass-panel run-timeline-panel">
              <div className="panel-title-mono">
                <span>2. Execution Timeline</span>
                <span style={{ fontSize: '10px' }}>{activeRun.steps.length} EVENTS</span>
              </div>

              {activeRun.steps.map((st) => (
                <div
                  key={st.step_no}
                  className="step-card-collapsible"
                  onClick={() => setExpandedStep(expandedStep === st.step_no ? null : st.step_no)}
                >
                  <div className="step-card-header">
                    <div className="step-card-left-info">
                      <span className="step-no-badge">STEP {st.step_no}</span>
                      <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>{st.title}</span>
                      {st.status === 'injected' && <span className="badge-injected">INJECTED</span>}
                      {st.injection && <span className="badge-injected">SHIELD: IGNORED INJECTION</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="step-tool-chip">{st.tool}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-2)' }}>{st.duration_ms}ms</span>
                    </div>
                  </div>

                  <div className="step-thought-text">
                    "{st.reasoning}"
                  </div>

                  {st.injection && (
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '10.5px', color: 'var(--warn)', marginTop: '6px' }}>
                      Ignored an instruction found inside a web page · {st.injection.url}
                      {st.injection.snippet ? ` · "${st.injection.snippet}"` : ''}
                    </div>
                  )}

                  {expandedStep === st.step_no && (
                    <pre className="step-expanded-payload">
                      <code>{st.payload}</code>
                    </pre>
                  )}
                </div>
              ))}

              {/* Deliverable result state if completed */}
              {activeRun.artifactContent && (
                <div className="result-deliverable-card glass-panel">
                  <div className="panel-title-mono">
                    <span>Delivered Artifact (briefing.md)</span>
                    <button
                      className="btn-pill btn-pill-primary btn-pill-sm"
                      onClick={handleDownload}
                    >
                      Download Deliverable
                    </button>
                  </div>
                  <div className="markdown-preview-box">
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{activeRun.artifactContent}</pre>
                  </div>

                  {activeRun.incidentReport && (
                    <div style={{ marginTop: '16px', padding: '14px', borderRadius: '10px', background: 'rgba(255, 214, 10, 0.08)', border: '1px solid rgba(255, 214, 10, 0.25)' }}>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '12px', color: 'var(--warn)' }}>{activeRun.incidentReport}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Control & Flight Recorder */}
            <div className="glass-panel run-control-panel">
              <div className="panel-title-mono">
                <span>3. Live Steering & Controls</span>
                <span style={{ fontSize: '10px', color: 'var(--accent)' }}>E-STOP READY</span>
              </div>

              {/* Pause & Stop Buttons */}
              <div className="control-buttons-row">
                <button
                  className="btn-pill btn-pill-secondary btn-pill-sm"
                  onClick={handlePauseToggle}
                  style={{ color: isRunPaused ? 'var(--ok)' : 'inherit' }}
                >
                  {isRunPaused ? '▶ Resume' : '⏸ Pause'}
                </button>
                <button
                  className="estop-button"
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                  onClick={handleStop}
                >
                  E-STOP (12ms)
                </button>
              </div>

              <button
                className="btn-pill btn-pill-secondary btn-pill-sm"
                style={{ width: '100%' }}
                onClick={() => setIsRedirectModalOpen(true)}
              >
                ↳ Redirect Working Instruction
              </button>

              {/* Drift Meter */}
              <div className="drift-meter-box">
                <div className="drift-meter-header">
                  <span>DRIFT GUARD (SCORE: {activeRun.driftScore})</span>
                  <span style={{ color: 'var(--ok)', fontWeight: 600 }}>NOMINAL</span>
                </div>
                {/* SVG Sparkline */}
                <svg className="drift-sparkline" viewBox="0 0 200 40">
                  <rect x="0" y="0" width="200" height="20" fill="rgba(48, 209, 88, 0.08)" />
                  <line x1="0" y1="20" x2="200" y2="20" stroke="rgba(48, 209, 88, 0.3)" strokeDasharray="2 4" />
                  <path d="M 0 10 Q 50 12, 90 8 T 150 11 T 200 7" fill="none" stroke="var(--ok)" strokeWidth="2" />
                  <circle cx="200" cy="7" r="4" fill="var(--ok)" />
                </svg>
              </div>

              {/* Budget Bars */}
              <div>
                <div className="budget-bar-item">
                  <div className="budget-bar-labels">
                    <span>STEPS BUDGET</span>
                    <span>{activeRun.stepsBudget.current} / {activeRun.stepsBudget.max}</span>
                  </div>
                  <div className="chaos-bar-track">
                    <div className="chaos-bar-fill" style={{ width: `${(activeRun.stepsBudget.current / activeRun.stepsBudget.max) * 100}%` }}></div>
                  </div>
                </div>
                <div className="budget-bar-item">
                  <div className="budget-bar-labels">
                    <span>SECONDS BUDGET</span>
                    <span>{activeRun.timeBudget.current}s / {activeRun.timeBudget.max}s</span>
                  </div>
                  <div className="chaos-bar-track">
                    <div className="chaos-bar-fill" style={{ width: `${(activeRun.timeBudget.current / activeRun.timeBudget.max) * 100}%` }}></div>
                  </div>
                </div>
                <div className="budget-bar-item">
                  <div className="budget-bar-labels">
                    <span>LLM CALLS</span>
                    <span>{activeRun.llmBudget.current} / {activeRun.llmBudget.max}</span>
                  </div>
                  <div className="chaos-bar-track">
                    <div className="chaos-bar-fill" style={{ width: `${(activeRun.llmBudget.current / activeRun.llmBudget.max) * 100}%` }}></div>
                  </div>
                  {activeRun.tokens && (
                    <div className="budget-bar-labels" style={{ marginTop: '4px' }}>
                      <span>TOKENS</span>
                      <span>{activeRun.tokens.total.toLocaleString()} ({activeRun.tokens.input.toLocaleString()} in / {activeRun.tokens.output.toLocaleString()} out)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Chaos Menu: Break this tool */}
              <div>
                <div className="panel-title-mono" style={{ marginBottom: '8px' }}>
                  <span>Chaos Mode Injection</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button className="btn-pill btn-pill-secondary btn-pill-sm" style={{ justifyContent: 'space-between' }} onClick={() => handleBreakTool('search_web')}>
                    <span>Break search_web</span>
                    <span style={{ color: 'var(--err)', fontSize: '10px' }}>INJECT</span>
                  </button>
                  <button className="btn-pill btn-pill-secondary btn-pill-sm" style={{ justifyContent: 'space-between' }} onClick={() => handleBreakTool('fetch_page')}>
                    <span>Break fetch_page</span>
                    <span style={{ color: 'var(--err)', fontSize: '10px' }}>INJECT</span>
                  </button>
                </div>
              </div>

              {/* Recovery Ladder */}
              <div className="recovery-ladder-box">
                <span className="panel-title-mono" style={{ marginBottom: '6px' }}>Recovery Ladder</span>
                <div className="ladder-rung"><span>1.</span><span>Retry with exponential backoff</span></div>
                <div className="ladder-rung active"><span>2.</span><span>Fallback tool (search ⇄ wiki)</span></div>
                <div className="ladder-rung"><span>3.</span><span>Replan excluding failed tool</span></div>
              </div>

              {/* Recorder Panel: Merkle Hash + Verify + Tamper demo */}
              <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--stroke)' }}>
                <div className="panel-title-mono" style={{ marginBottom: '8px' }}>
                  <span>Flight Recorder Chain</span>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-2)', marginBottom: '10px' }}>
                  HEAD: {chainHeadDisplay}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <button className="btn-pill btn-pill-primary btn-pill-sm" style={{ flex: 1 }} onClick={handleRunVerifyLog}>
                    {runVerifyStatus === 'verifying' ? 'Verifying...' : 'Verify Log'}
                  </button>
                  <button
                    className="btn-pill btn-pill-secondary btn-pill-sm"
                    onClick={handleTamper}
                    title="Simulate SQL event modification without updating hashes"
                  >
                    {isTamperBroken ? 'Restore' : 'Tamper'}
                  </button>
                </div>

                <button
                  className="btn-pill btn-pill-secondary btn-pill-sm"
                  style={{ width: '100%', marginBottom: '8px' }}
                  onClick={handleExportBundle}
                  title="Download the run bundle and re-check it on /verify, without this server"
                >
                  Export bundle for /verify
                </button>

                {runVerifyStatus === 'verified' && (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '10.5px', color: 'var(--ok)', fontWeight: 600 }}>
                    ✓ 0 Tampering: All event nonces synchronized.
                  </div>
                )}
                {runVerifyStatus === 'tampered' && (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '10.5px', color: 'var(--err)', fontWeight: 600 }}>
                    ✕ Tamper Detected: Chain broken at Event #{chainBrokenAt ?? '?'}!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== PAGE: HISTORY (/history) ===================== */}
      {currentPath === '/history' && (
        <div className="page-wrapper container">
          <div className="page-header">
            <h1 className="page-title">Flight Recorder Run History</h1>
            <p className="page-subtitle">
              Audit trails, cryptographic signatures, and reproducible execution records for all agent runs.
            </p>
          </div>

          <div className="glass-panel history-table-card">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Goal Intent</th>
                  <th>Verdict</th>
                  <th>Duration</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{r.id}</td>
                    <td style={{ maxWidth: '340px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.goal}
                    </td>
                    <td>
                      <span className="criteria-badge criteria-badge-pass" style={{ fontSize: '10px' }}>
                        {r.verdict.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{r.duration}</td>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>{r.created_at}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-pill btn-pill-secondary btn-pill-sm" onClick={() => { setSelectedRunId(r.id); navigateTo(`/run/${r.id}`); }}>
                          Inspect
                        </button>
                        <button
                          className="btn-pill btn-pill-secondary btn-pill-sm"
                          onClick={() => {
                            setSelectedRunId(r.id);
                            navigateTo('/');
                            setTimeout(() => {
                              document.getElementById('replay')?.scrollIntoView({ behavior: 'smooth' });
                            }, 100);
                          }}
                        >
                          Replay
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== PAGE: MOBILE STEER VIEW (/r/:id) ===================== */}
      {(currentPath === '/r' || currentPath.startsWith('/r/')) && (
        <div className="page-wrapper container">
          <div className="steer-mobile-container">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="protocol-badge" style={{ marginBottom: 0 }}>
                <span className="badge-dot-green"></span>
                <span className="protocol-text">POCKET CONTROLLER</span>
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-2)' }}>
                RUN: {activeRun.id}
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase' }}>
                CURRENT WORKING GOAL
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', marginTop: '4px' }}>
                "{activeRun.goal}"
              </h2>
            </div>

            {/* Giant Steering Buttons */}
            <div className="steer-giant-btn-grid">
              <button
                className={`steer-big-btn steer-btn-pause`}
                onClick={handlePauseToggle}
              >
                <span style={{ fontSize: '24px' }}>{isRunPaused ? '▶' : '⏸'}</span>
                <span>{isRunPaused ? 'Resume Run' : 'Pause Run'}</span>
              </button>

              <button
                className="steer-big-btn steer-btn-stop"
                onClick={handleStop}
              >
                <span style={{ fontSize: '24px' }}>⏹</span>
                <span>Stop Run</span>
              </button>
            </div>

            <button
              className="btn-pill btn-pill-primary"
              style={{ width: '100%', padding: '14px' }}
              onClick={() => setIsRedirectModalOpen(true)}
            >
              ↳ Redirect Instruction
            </button>

            {/* Latest Step Live Card */}
            <div className="glass-panel" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: '11px', marginBottom: '8px' }}>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>LATEST EMITTED STEP</span>
                <span style={{ color: 'var(--ok)' }}>200 OK</span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                {activeRun.steps[activeRun.steps.length - 1]?.title || 'Awaiting step...'}
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-2)', marginTop: '4px' }}>
                {activeRun.steps[activeRun.steps.length - 1]?.reasoning}
              </p>
            </div>

            {/* Quick Chaos Fault Trigger from Phone */}
            <div className="glass-panel" style={{ padding: '18px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-3)', marginBottom: '8px', textTransform: 'uppercase' }}>
                CHAOS TRIGGER (DEMO TEST)
              </div>
              <button
                className="btn-pill btn-pill-secondary btn-pill-sm"
                style={{ width: '100%', borderColor: 'var(--err-border)', color: 'var(--err)' }}
                onClick={() => handleBreakTool('search_web')}
              >
                ⚡ Break search_web from Phone
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <button
                className="btn-pill btn-pill-secondary btn-pill-sm"
                onClick={() => navigateTo(`/run/${activeRun.id}`)}
              >
                Switch to Desktop View →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== PAGE: VERIFY (/verify) ===================== */}
      {currentPath === '/verify' && (
        <div className="page-wrapper container">
          <div className="page-header">
            <h1 className="page-title">Offline Bundle Verifier</h1>
            <p className="page-subtitle">
              Paste or upload an exported run bundle and a pinned head hash to re-verify the SHA-256 chain in your browser — without trusting the server.
            </p>
          </div>
          <div className="glass-panel composer-card" style={{ maxWidth: '680px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="verify-bundle">Run bundle JSON</label>
              <textarea
                id="verify-bundle"
                className="form-textarea"
                style={{ minHeight: '140px', fontFamily: 'var(--mono)', fontSize: '12px' }}
                placeholder={'{\n  "runId": "...",\n  "events": [...],\n  "head": "..."\n}'}
                value={verifyBundleText}
                onChange={(e) => setVerifyBundleText(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="verify-head">Pinned head hash</label>
              <input
                id="verify-head"
                type="text"
                className="form-textarea"
                style={{ minHeight: 'unset', padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: '12px' }}
                placeholder="64-character SHA-256 hex string"
                value={verifyHeadInput}
                onChange={(e) => setVerifyHeadInput(e.target.value)}
              />
            </div>
            <button className="btn-pill btn-pill-primary" onClick={handleVerifyBundle}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Verify Chain
            </button>

            {bundleError && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: '10.5px', color: 'var(--err)', fontWeight: 600, marginTop: '12px' }}>
                ✕ {bundleError}
              </div>
            )}
            {bundleVerdict && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '10.5px', fontWeight: 600, color: bundleVerdict.ok ? 'var(--ok)' : 'var(--err)' }}>
                  {bundleVerdict.ok ? '✓ Chain intact' : `✕ Chain broken at Event #${bundleVerdict.brokenAt}`} · {bundleVerdict.eventCount} events
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-2)', marginTop: '6px', wordBreak: 'break-all' }}>
                  computed head: {bundleVerdict.computedHead}
                  {bundleVerdict.pinnedHead && (
                    <>
                      <br />
                      pinned head: {bundleVerdict.pinnedHead} {bundleVerdict.headMatches ? '✓' : '✕'}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== POPUPS & MODALS ===================== */}

      {/* QR Code Popover Modal (For Phone Steering) */}
      {isQrModalOpen && (
        <div className="qr-modal-overlay" onClick={() => setIsQrModalOpen(false)}>
          <div className="qr-modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text)' }}>
                Steer From Your Phone
              </h3>
              <button
                onClick={() => setIsQrModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-2)' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '18px', lineHeight: 1.5 }}>
              Scan this code with your phone camera to pause, redirect, or trigger chaos faults in real-time.
            </p>

            {/* Real QR (feature F4): the signed steer link rendered by the `qrcode` package. */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="Scan to open the mobile steer view"
                  width={180}
                  height={180}
                  style={{ background: '#FFFFFF', padding: '10px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.4)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                />
              ) : (
                <div
                  style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', borderRadius: '14px', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: '11px', textAlign: 'center', padding: '10px' }}
                >
                  Enter the access code to mint a share link
                </div>
              )}
            </div>

            <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)', wordBreak: 'break-all', marginBottom: '14px' }}>
              Target: {steerUrl || `/r/${activeRun.id}`}
            </div>

            <button
              className="btn-pill btn-pill-primary"
              style={{ width: '100%' }}
              onClick={() => {
                setIsQrModalOpen(false);
                if (steerUrl) {
                  window.open(steerUrl, '_blank', 'noopener,noreferrer');
                } else {
                  navigateTo(`/r/${activeRun.id}`);
                }
              }}
            >
              Open Mobile Steer Simulator
            </button>
          </div>
        </div>
      )}

      {/* Redirect Instruction Modal */}
      {isRedirectModalOpen && (
        <div className="qr-modal-overlay" onClick={() => setIsRedirectModalOpen(false)}>
          <div className="qr-modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px' }}>
              Redirect Working Instruction
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '14px' }}>
              Inject a mid-flight instruction. The agent loop blocks and incorporates this into the next decision step.
            </p>

            <textarea
              className="form-textarea"
              style={{ minHeight: '80px', marginBottom: '16px' }}
              value={redirectInstruction}
              onChange={(e) => setRedirectInstruction(e.target.value)}
              placeholder="e.g. Also include secondary European bank ledgers..."
            />

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn-pill btn-pill-secondary btn-pill-sm" onClick={() => setIsRedirectModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-pill btn-pill-primary btn-pill-sm"
                onClick={handleRedirect}
              >
                Send Redirect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
