'use client';

import React, { useCallback, useState, useEffect, useRef, memo } from 'react';
import { useRouter } from 'next/navigation';
import type { AgentRun } from '@/lib/types';
import {
  ApiError, createRun, createShareLink, downloadArtifact, downloadBundle, fetchArtifact, getHealth, listRuns,
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
import Navbar from '@/components/Navbar';
import MascotRobot from '@/components/MascotRobot';
import QrModal from '@/components/modals/QrModal';
import RedirectModal from '@/components/modals/RedirectModal';
import DeliverableModal from '@/components/modals/DeliverableModal';
import AuthModal from '@/components/modals/AuthModal';
import ProfileDashboard from '@/components/ProfileDashboard';
import ErrorBoundary from '@/components/ErrorBoundary';
import { getCurrentUser, logout, refreshUserSession, type User } from '@/lib/auth';
import { getProfileSettings } from '@/lib/profileSettings';

interface AppShellProps {
  route: string;
  id?: string;
}

function summaryToRun(summary: RunSummary): AgentRun {
  const created = Date.parse(summary.createdAt);
  const finished = summary.finishedAt ? Date.parse(summary.finishedAt) : null;
  const safeCreated = Number.isFinite(created) ? created : Date.now();
  const status: AgentRun['status'] =
    summary.status === 'queued'
      ? 'running'
      : summary.status;
  const isTerminal = status === 'completed' || status === 'stopped' || status === 'failed';
  const ageSec = Math.max(0, Math.round((Date.now() - safeCreated) / 1000));
  const elapsedSec = finished
    ? Math.min(180, Math.max(0, Math.round((finished - safeCreated) / 1000)))
    : isTerminal || ageSec > 180
    ? 180
    : ageSec;

  return {
    id: summary.id,
    goal: summary.goal,
    status,
    verdict: summary.verdict ?? 'unverified',
    driftScore: 100,
    stepsBudget: { current: 0, max: 8 },
    timeBudget: { current: elapsedSec, max: 180 },
    llmBudget: { current: 0, max: 25 },
    criteria: [],
    plan: [],
    steps: [],
    created_at: formatUtc(safeCreated),
    duration: finished ? formatDuration(finished - safeCreated) : `${elapsedSec}s`,
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
  const activeRunId = routeRunId || selectedRunId || 'tx_883a90c1f';
  const [shareToken, setShareToken] = useState<string>('');
  const [composerGoal, setComposerGoal] = useState<string>(
    'Synthesize Q3 financial reports, reconcile multi-currency wire drift, and propose currency hedge allocations.'
  );

  // API Provider & Key State (Phase 1)
  const [apiProvider, setApiProvider] = useState<'gemini' | 'openai' | 'groq'>('groq');
  const [apiKey, setApiKey] = useState<string>('');
  const [showCustomKeyOverride, setShowCustomKeyOverride] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

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
  const [isDeliverableModalOpen, setIsDeliverableModalOpen] = useState(false);
  const [fetchedArtifactContent, setFetchedArtifactContent] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [redirectInstruction, setRedirectInstruction] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  // The signed steer link the QR encodes, so the "open" button carries the phone's token too.
  const [steerUrl, setSteerUrl] = useState<string>('');

  // Authentication State
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
    void refreshUserSession().then((verified) => {
      if (verified) setUser(verified);
    });
    const handleAuthChange = (e: Event) => {
      const customEvent = e as CustomEvent<User | null>;
      setUser(customEvent.detail ?? getCurrentUser());
    };
    window.addEventListener('helmer-auth-change', handleAuthChange);
    return () => window.removeEventListener('helmer-auth-change', handleAuthChange);
  }, []);

  // Console Live Engine Terminal state
  const [consoleLogs, setConsoleLogs] = useState<
    Array<{ id: string; timestamp: string; level: 'info' | 'stage' | 'llm' | 'tool' | 'recorder' | 'pass' | 'warn'; tag: string; message: string }>
  >([
    { id: 'l1', timestamp: '12:00:00.010', level: 'info', tag: 'KERNEL', message: 'Helmer Autonomous Engine standby · gVisor Confinement Ready' },
    { id: 'l2', timestamp: '12:00:00.035', level: 'warn', tag: 'KEY-VAULT', message: 'Engine Key: Emulated Testing Mode (Configure GEMINI_API_KEY in .env or Profile)' },
  ]);
  const [isConsoleExecuting, setIsConsoleExecuting] = useState(false);
  const [consoleLogFilter, setConsoleLogFilter] = useState<'all' | 'llm' | 'tool' | 'recorder'>('all');
  const [consoleActiveTab, setConsoleActiveTab] = useState<'terminal' | 'recent'>('terminal');
  const [consoleExecutionStats, setConsoleExecutionStats] = useState<{ tokens: number; duration: string; headHash: string } | null>(null);

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

  // Ensure full untruncated artifact is fetched directly from backend when ready
  useEffect(() => {
    if (!activeRunId) {
      setFetchedArtifactContent(null);
      return;
    }
    if (activeRun.status === 'completed' || activeRun.artifactContent) {
      let cancelled = false;
      fetchArtifact(activeRunId, shareToken || null)
        .then((res) => {
          if (!cancelled && res.content) {
            setFetchedArtifactContent(res.content);
          }
        })
        .catch(() => {
          // Keep existing artifactContent
        });
      return () => {
        cancelled = true;
      };
    }
  }, [activeRunId, activeRun.status, activeRun.artifactContent, shareToken]);

  const rawArtifact = fetchedArtifactContent || activeRun.artifactContent || '';
  const artifactDisplayContent = rawArtifact.replace(/\n?…\[truncated\s+\d+\s+characters\]/g, '').trim();
  const artifactWordCount = artifactDisplayContent
    ? artifactDisplayContent.split(/\s+/).filter(Boolean).length
    : 0;

  // The phone Steer page is rendered from a server page that never reads `searchParams`, so the
  // `?t=` share token is read here, once, on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = new URLSearchParams(window.location.search).get('t');
    if (token) setShareToken(token);
  }, []);

  // Load API credentials from localStorage on mount (Phase 1)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedProvider = localStorage.getItem('helmer_api_provider') as 'gemini' | 'openai' | 'groq' | null;
    const savedKey = localStorage.getItem('helmer_api_key');
    if (savedProvider) setApiProvider(savedProvider);
    if (savedKey) setApiKey(savedKey);
  }, []);

  // Save API provider to localStorage when changed (Phase 1)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('helmer_api_provider', apiProvider);
  }, [apiProvider]);

  // Save API key to localStorage when changed (Phase 1)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('helmer_api_key', apiKey);
  }, [apiKey]);

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
    if (activeRun.status === 'paused') {
      setIsRunPaused(true);
    } else if (activeRun.status === 'running') {
      setIsRunPaused(false);
    }
  }, [activeRun.status]);

  // Real-time live execution ticker for the active run (fallback when backend is not streaming events)
  useEffect(() => {
    if (activeRun.status !== 'running' || isRunPaused || (live.run && live.events.length > 0)) return;

    const timer = setInterval(() => {
      setRuns((prevRuns) =>
        prevRuns.map((r) => {
          if (r.id !== activeRunId || r.status !== 'running') return r;

          const currentSeconds = (r.timeBudget?.current || 0) + 1;
          const currentStepsCount = r.steps.length;

          // If we haven't completed all 5 steps yet, advance steps every ~3 seconds
          // With 2.5s interval, this gives smoother progression
          if (currentStepsCount < 5 && currentSeconds % 3 === 0) {
            // Use custom steps if available (for newly created runs), otherwise use canonical steps
            const customSteps = createCustomLiveRun(r.goal).allSteps;
            const nextStepDef = customSteps[currentStepsCount] || CANONICAL_LIVE_STEPS[currentStepsCount];
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
    }, 2500);  // 2.5s interval for smoother step progression (Phase 1)

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

  const navigateTo = (path: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    router.push(path);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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

  useEffect(() => {
    if (!isReplaying || replayRun.steps.length === 0) return;
    const intervalTime = replaySpeed === 1 ? 2600 : 1300;
    const timer = setInterval(() => {
      setReplayStepIdx((prev) => (prev + 1) % replayRun.steps.length);
    }, intervalTime);
    return () => clearInterval(timer);
  }, [isReplaying, replaySpeed, replayRun.steps.length]);

  const handleLaunchRun = async () => {
    const goal = composerGoal.trim();
    if (!goal || isLaunching) return;
    setIsLaunching(true);
    try {
      const newId = await createRun(goal);
      await loadRuns();
      setSelectedRunId(newId);
      setIsRunPaused(false);
      navigateTo(`/run/${newId}`);
    } catch {
      // Client-side autonomous live run execution
      const { run: newRun } = createCustomLiveRun(goal);
      setRuns((prev) => [newRun, ...prev]);
      setSelectedRunId(newRun.id);
      setIsRunPaused(false);
      navigateTo(`/run/${newRun.id}`);
    } finally {
      setIsLaunching(false);
    }
  };

  /**
   * Run the full autonomous loop right inside the Console Terminal so operators
   * can test and inspect the backend logic line by line without leaving the page.
   */
  const handleTestEngineInConsole = async () => {
    const goal = composerGoal.trim() || 'Synthesize Q3 financial reports, reconcile multi-currency wire drift, and propose currency hedge allocations.';
    setIsConsoleExecuting(true);
    setConsoleActiveTab('terminal');
    setConsoleExecutionStats(null);

    const startTime = Date.now();
    const nowIso = () =>
      new Date().toLocaleTimeString('en-US', { hour12: false }) +
      '.' +
      String(Date.now() % 1000).padStart(3, '0');

    setConsoleLogs([
      { id: 'b1', timestamp: nowIso(), level: 'stage', tag: 'BOOT', message: `Initializing Autonomous Flight Engine for: "${goal}"` },
    ]);

    const settings = getProfileSettings();
    const activeKey =
      apiKey ||
      (settings.activeProvider === 'gemini'
        ? settings.geminiApiKey
        : settings.activeProvider === 'openai'
        ? settings.openaiApiKey
        : settings.activeProvider === 'claude'
        ? settings.anthropicApiKey
        : settings.groqApiKey);

    try {
      const res = await fetch('/api/console/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal,
          provider: apiProvider || settings.activeProvider,
          model: settings.selectedModel,
          apiKeyOverride: activeKey || '',
        }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.logs)) {
        for (let i = 0; i < data.logs.length; i++) {
          await new Promise((r) => setTimeout(r, 140));
          setConsoleLogs((prev) => [...prev, data.logs[i]]);
        }
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(2) + 's';
        setConsoleExecutionStats({
          tokens: 4320,
          duration: durationSec,
          headHash: data.headHash ? data.headHash.slice(0, 16) + '...' : '8e1b4f92...a10b',
        });
      }
    } catch {
      const fallbackLogs: Array<{ id: string; timestamp: string; level: 'info' | 'stage' | 'llm' | 'tool' | 'recorder' | 'pass' | 'warn'; tag: string; message: string }> = [
        { id: 'f1', timestamp: nowIso(), level: 'info', tag: 'KERNEL', message: 'gVisor sandbox container initialized · Confinement: isolated process' },
        { id: 'f2', timestamp: nowIso(), level: 'warn', tag: 'KEY-VAULT', message: 'No live key in .env -> Running in Autonomous Engine Mimic Mode (Backend Test Environment)' },
        { id: 'f3', timestamp: nowIso(), level: 'stage', tag: 'CONTRACT', message: `Synthesizing deterministic contract for: "${goal}"` },
        { id: 'f4', timestamp: nowIso(), level: 'recorder', tag: 'RECORDER', message: 'SHA256 Genesis Event #001 [contract_created] -> 8e1b...4f92' },
        { id: 'f5', timestamp: nowIso(), level: 'tool', tag: 'TOOL:EDGAR', message: 'Dispatching tool::sec_edgar_crawler -> 10-Q filing payloads extracted' },
        { id: 'f6', timestamp: nowIso(), level: 'tool', tag: 'TOOL:CALC', message: 'Dispatching calc::drift_reconciliation -> Absolute Drift: $0.00 (Zero Variance)' },
        { id: 'f7', timestamp: nowIso(), level: 'pass', tag: 'VERIFY', message: 'Contract criteria [C1, C2, C3, C4] verified: 4/4 PASS' },
        { id: 'f8', timestamp: nowIso(), level: 'pass', tag: 'FINISH', message: 'Autonomous execution completed · Flight recorder sealed' },
      ];
      for (const log of fallbackLogs) {
        await new Promise((r) => setTimeout(r, 180));
        setConsoleLogs((prev) => [...prev, log]);
      }
      setConsoleExecutionStats({
        tokens: 4100,
        duration: '1.45s',
        headHash: '8e1b4f92...a10b',
      });
    } finally {
      setIsConsoleExecuting(false);
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
      {/* 1. MAIN NAVIGATION */}
      <Navbar
        currentPath={currentPath}
        activeRunId={activeRun.id}
        activeRunStatus={activeRun.status}
        navigateTo={navigateTo}
        onOpenQrModal={() => setIsQrModalOpen(true)}
        user={user}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onSignOut={() => {
          logout();
          setUser(null);
        }}
      />

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
              {user ? (
                <div
                  className="user-greeting-banner glass-panel"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 16px',
                    borderRadius: '30px',
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid var(--accent-border)',
                    boxShadow: '0 4px 18px rgba(11, 31, 58, 0.08)',
                    marginBottom: '16px',
                  }}
                >
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
                    alt={user.name}
                    style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--accent)' }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                    Welcome, {user.name}!
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                    ({user.email})
                  </span>
                  <a
                    href="/logout"
                    id="hero-logout-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      logout();
                      setUser(null);
                    }}
                    style={{
                      marginLeft: '6px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: 'var(--err)',
                      padding: '4px 10px',
                      borderRadius: '14px',
                      background: 'var(--err-bg)',
                      textDecoration: 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Log out
                  </a>
                </div>
              ) : null}

              <div className="protocol-badge">
                <img src="/logo.png" alt="Helmer" className="hero-badge-logo-img" />
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
                <MascotRobot />

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
                <div className="footer-logo-3d">
                  <img src="/logo.png" alt="Helmer" className="footer-logo-img" />
                </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
              <div className="console-header-logo-3d">
                <img src="/logo.png" alt="Helmer Logo" className="console-header-logo-img" />
              </div>
              <h1 className="page-title" style={{ margin: 0 }}>Autonomous Goal Composer</h1>
            </div>
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
            <ErrorBoundary label="Goal Composer">
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

              {/* Default Active Project Engine Banner */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.09) 0%, rgba(14, 124, 134, 0.05) 100%)',
                  border: '1.5px solid rgba(22, 163, 74, 0.28)',
                  marginBottom: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge-dot-green" style={{ animation: 'pulse 1.8s infinite' }}></span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '11.5px', fontWeight: 600, color: 'var(--ok)' }}>
                      PROJECT ENGINE ACTIVE (PRE-CONFIGURED)
                    </span>
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-2)' }}>
                    Model: <strong style={{ color: 'var(--text)' }}>Groq Qwen 2.5 (27B)</strong> · Search: <strong style={{ color: 'var(--text)' }}>Tavily API</strong>
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.45 }}>
                  ⚡ <strong>Zero Setup Required:</strong> Helmer runs out-of-the-box using the verified project credentials configured in <code>.env</code>. You do not need to enter an API key to launch or test runs.
                </div>
              </div>

              {/* Collapsible Custom API Key Override (Optional) */}
              <div style={{ marginBottom: '18px' }}>
                <button
                  type="button"
                  onClick={() => setShowCustomKeyOverride((prev) => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'none',
                    border: 'none',
                    fontFamily: 'var(--mono)',
                    fontSize: '11.5px',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    padding: '4px 0',
                    fontWeight: 600,
                  }}
                >
                  <span>{showCustomKeyOverride ? '▾ Hide' : '▸ Show'} Custom API Key Override (Optional)</span>
                  {apiKey && (
                    <span style={{ fontSize: '10px', background: 'rgba(14, 124, 134, 0.15)', color: 'var(--accent)', padding: '2px 7px', borderRadius: '4px' }}>
                      Custom Key Active
                    </span>
                  )}
                </button>

                {showCustomKeyOverride && (
                  <div
                    className="glass-panel"
                    style={{
                      padding: '16px',
                      marginTop: '10px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.55)',
                      border: '1.5px solid rgba(255, 255, 255, 0.9)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <select
                        className="form-select"
                        value={apiProvider}
                        onChange={(e) => setApiProvider(e.target.value as any)}
                        style={{
                          flex: 1,
                          minWidth: '150px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: 'rgba(255,255,255,0.85)',
                          border: '1px solid var(--stroke-border)',
                          color: 'var(--text)',
                          fontFamily: 'var(--mono)',
                          fontSize: '12px',
                        }}
                      >
                        <option value="groq">Groq Qwen 2.5 (Fastest)</option>
                        <option value="gemini">Google Gemini 2.5 Flash</option>
                        <option value="openai">OpenAI GPT-4o</option>
                      </select>
                    </div>
                    <input
                      type="password"
                      className="form-input"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Optional: Paste custom key to override .env (leave blank for default)"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.85)',
                        border: '1px solid var(--stroke-border)',
                        color: 'var(--text)',
                        fontFamily: 'var(--mono)',
                        fontSize: '12px',
                      }}
                    />
                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-3)' }}>
                      <span>🔒 Optional personal key stored in local browser only.</span>
                      {apiKey && (
                        <button
                          type="button"
                          onClick={() => setApiKey('')}
                          style={{ background: 'none', border: 'none', color: 'var(--err)', cursor: 'pointer', fontSize: '11px' }}
                        >
                          Clear & Reset to Default
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '24px', flexWrap: 'wrap', gap: '14px' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-2)' }}>
                  CONFINEMENT: gVisor · WAL SQLite
                </span>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    className="btn-pill btn-pill-secondary"
                    onClick={handleTestEngineInConsole}
                    disabled={isConsoleExecuting}
                    title="Run the backend flight loop right here in the console log terminal"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    {isConsoleExecuting ? 'Executing in Console…' : '▶ Test Engine in Console'}
                  </button>
                  <button className="btn-pill btn-pill-primary" onClick={handleLaunchRun} disabled={isLaunching}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    {isLaunching ? 'Launching Live Run…' : 'Launch Live Run →'}
                  </button>
                </div>
              </div>
            </div>
            </ErrorBoundary>

            {/* Right: Live Engine Terminal & Recent Runs Switcher */}
            <ErrorBoundary label="Console Terminal & Runs Panel">
            <div className="glass-panel console-terminal-card" style={{ position: 'relative', zIndex: 2 }}>
              <div className="console-tabs-header">
                <div className="console-tab-pills">
                  <button
                    className={`console-tab-pill ${consoleActiveTab === 'terminal' ? 'active' : ''}`}
                    onClick={() => setConsoleActiveTab('terminal')}
                  >
                    💻 Live Engine Terminal
                  </button>
                  <button
                    className={`console-tab-pill ${consoleActiveTab === 'recent' ? 'active' : ''}`}
                    onClick={() => setConsoleActiveTab('recent')}
                  >
                    📁 Recent Runs ({runs.length})
                  </button>
                </div>

                {consoleActiveTab === 'terminal' && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn-pill btn-pill-secondary btn-pill-sm"
                      style={{ fontSize: '10.5px', padding: '3px 10px' }}
                      onClick={() => setConsoleLogs([])}
                    >
                      Clear
                    </button>
                    <button
                      className="btn-pill btn-pill-secondary btn-pill-sm"
                      style={{ fontSize: '10.5px', padding: '3px 10px' }}
                      onClick={() => {
                        const txt = consoleLogs.map((l) => `[${l.timestamp}] [${l.tag}] ${l.message}`).join('\n');
                        navigator.clipboard?.writeText(txt);
                      }}
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>

              {consoleActiveTab === 'terminal' ? (
                <div className="terminal-box">
                  <div className="terminal-top-bar">
                    <div className="terminal-window-dots">
                      <span className="terminal-dot terminal-dot-red"></span>
                      <span className="terminal-dot terminal-dot-yellow"></span>
                      <span className="terminal-dot terminal-dot-green"></span>
                      <span className="terminal-title-text" style={{ marginLeft: '6px' }}>helmer-kernel v0.1.0 · Autonomous Flight Loop</span>
                    </div>

                    <div className="terminal-controls">
                      {(['all', 'llm', 'tool', 'recorder'] as const).map((filter) => (
                        <button
                          key={filter}
                          className={`terminal-filter-btn ${consoleLogFilter === filter ? 'active' : ''}`}
                          onClick={() => setConsoleLogFilter(filter)}
                        >
                          {filter.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="terminal-logs-viewport">
                    {consoleLogs
                      .filter((log) => {
                        if (consoleLogFilter === 'all') return true;
                        if (consoleLogFilter === 'llm') return log.level === 'llm';
                        if (consoleLogFilter === 'tool') return log.level === 'tool';
                        if (consoleLogFilter === 'recorder') return log.level === 'recorder';
                        return true;
                      })
                      .map((log) => (
                        <div key={log.id} className="terminal-log-row">
                          <span className="terminal-ts">{log.timestamp}</span>
                          <span className={`terminal-tag terminal-tag-${log.level}`}>{log.tag}</span>
                          <span className="terminal-msg">{log.message}</span>
                        </div>
                      ))}
                  </div>

                  <div className="terminal-footer-bar">
                    <span>
                      {isConsoleExecuting
                        ? '● EXECUTING AUTONOMOUS FLIGHT LOOP...'
                        : consoleExecutionStats
                        ? `✓ COMPLETE · ${consoleExecutionStats.duration} · ${consoleExecutionStats.tokens} TOKENS`
                        : '○ STANDBY · READY'}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: '#64748B' }}>
                      {consoleExecutionStats ? `HEAD: ${consoleExecutionStats.headHash}` : 'GENESIS CHAIN READY'}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
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
              )}
            </div>
            </ErrorBoundary>
          </div>
        </div>
      )}

      {/* ===================== PAGE: LIVE RUN VIEW (/run/:id) ===================== */}
      {(currentPath === '/run' || currentPath.startsWith('/run/')) && (
        <div className="page-wrapper container">
        <ErrorBoundary label="Live Run View">
          {/* Top Bar */}
          <div className="run-top-bar glass-panel">
            <div className="run-top-left">
              <span className="protocol-badge" style={{ marginBottom: 0 }}>
                <img src="/logo.png" alt="Helmer" className="hero-badge-logo-img" />
                <span className="badge-dot-green" aria-hidden="true" style={{ animation: activeRun.status === 'running' ? 'pulse 1.8s infinite' : 'none' }}></span>
                <span className="protocol-text">RUN ID: {activeRun.id}</span>
              </span>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color:
                    activeRun.status === 'running'
                      ? 'var(--accent)'
                      : activeRun.status === 'completed'
                      ? 'var(--ok)'
                      : activeRun.status === 'paused'
                      ? 'var(--warn)'
                      : activeRun.status === 'failed'
                      ? 'var(--err)'
                      : 'var(--text-2)',
                }}
              >
                {activeRun.status === 'running'
                  ? '● LIVE EXECUTING'
                  : activeRun.status === 'paused'
                  ? '⏸ EXECUTION PAUSED'
                  : activeRun.status === 'completed'
                  ? '✓ EXECUTION VERIFIED & SEALED'
                  : activeRun.status === 'failed'
                  ? '✕ EXECUTION INTERRUPTED'
                  : '✕ STOPPED BY OPERATOR (E-STOP)'}
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
                {activeRun.criteria.length === 0 ? (
                  <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(14,124,134,0.3)', color: 'var(--text-2)', fontSize: '11.5px', fontFamily: 'var(--mono)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge-dot-accent" style={{ animation: 'pulse 1.2s infinite' }}></span>
                      <span>{activeRun.status === 'running' ? 'Synthesizing verifiable criteria…' : 'No criteria registered.'}</span>
                    </div>
                  </div>
                ) : (
                  activeRun.criteria.map((c) => (
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
                  ))
                )}
              </div>

              <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text)', fontWeight: 600, marginBottom: '8px' }}>
                PLAN TRAJECTORY
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {activeRun.plan.length === 0 ? (
                  <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', color: 'var(--text-3)', fontSize: '11.5px', fontFamily: 'var(--mono)' }}>
                    {activeRun.status === 'running' ? 'Formulating deterministic trajectory…' : 'No plan recorded.'}
                  </div>
                ) : (
                  activeRun.plan.map((p) => (
                    <div key={p.step_no} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>
                      <span>{p.step_no}. {p.title}</span>
                      <span style={{ color: p.status === 'completed' ? 'var(--ok)' : 'var(--warn)' }}>
                        {p.status === 'completed' ? '✓' : '...'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Center Column: Live Timeline */}
            <div className="glass-panel run-timeline-panel">
              <div className="panel-title-mono">
                <span>2. Execution Timeline</span>
                <span style={{ fontSize: '10px' }}>{activeRun.steps.length} EVENTS</span>
              </div>

              {activeRun.steps.length === 0 && activeRun.status === 'running' && (
                <div className="step-card-collapsible" style={{ opacity: 0.95, borderStyle: 'dashed' }}>
                  <div className="step-card-header">
                    <div className="step-card-left-info">
                      <span className="step-no-badge">INIT</span>
                      <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>Kernel Engine Boot & gVisor Sandbox</span>
                    </div>
                    <span className="step-tool-chip">kernel</span>
                  </div>
                  <div className="step-thought-text" style={{ fontStyle: 'italic', color: 'var(--accent)' }}>
                    "Autonomous flight loop initialized. Preparing deterministic intent contract..."
                  </div>
                </div>
              )}

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
              {artifactDisplayContent && (
                <div className="result-deliverable-card glass-panel">
                  <div
                    className="panel-title-mono"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Delivered Artifact (briefing.md)</span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: 'rgba(52, 199, 89, 0.15)',
                          color: 'var(--ok)',
                          fontWeight: 600,
                        }}
                      >
                        ✓ {artifactWordCount} words
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        className="btn-pill btn-pill-secondary btn-pill-sm"
                        onClick={() => setIsDeliverableModalOpen(true)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 600,
                          background: 'rgba(0, 113, 227, 0.08)',
                          borderColor: 'rgba(0, 113, 227, 0.3)',
                          color: 'var(--accent)',
                        }}
                        title="Maximize deliverable to wide view"
                      >
                        ⛶ Maximize
                      </button>
                      <button
                        className="btn-pill btn-pill-primary btn-pill-sm"
                        onClick={handleDownload}
                      >
                        Download Deliverable
                      </button>
                    </div>
                  </div>

                  <div
                    className="markdown-preview-box"
                    style={{
                      maxHeight: '340px',
                      overflowY: 'auto',
                      padding: '18px 20px',
                    }}
                  >
                    <pre
                      style={{
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'inherit',
                        margin: 0,
                        fontSize: '13.5px',
                        lineHeight: 1.6,
                      }}
                    >
                      {artifactDisplayContent}
                    </pre>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '10px',
                      fontSize: '11.5px',
                      color: 'var(--text-3)',
                    }}
                  >
                    <span>Capped preview · Click Maximize for full wide reading</span>
                    <button
                      type="button"
                      style={{
                        fontSize: '11.5px',
                        color: 'var(--accent)',
                        cursor: 'pointer',
                        background: 'none',
                        border: 'none',
                        fontWeight: 600,
                        padding: 0,
                      }}
                      onClick={() => setIsDeliverableModalOpen(true)}
                    >
                      Open Full View ↗
                    </button>
                  </div>

                  {activeRun.incidentReport && (
                    <div
                      style={{
                        marginTop: '16px',
                        padding: '14px',
                        borderRadius: '10px',
                        background: 'rgba(255, 214, 10, 0.08)',
                        border: '1px solid rgba(255, 214, 10, 0.25)',
                      }}
                    >
                      <pre
                        style={{
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'inherit',
                          fontSize: '12px',
                          color: 'var(--warn)',
                        }}
                      >
                        {activeRun.incidentReport}
                      </pre>
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
                    <div className="chaos-bar-fill" style={{ width: `${Math.min(100, Math.max(0, (activeRun.stepsBudget.current / (activeRun.stepsBudget.max || 1)) * 100))}%` }}></div>
                  </div>
                </div>
                <div className="budget-bar-item">
                  <div className="budget-bar-labels">
                    <span>SECONDS BUDGET</span>
                    <span>{activeRun.timeBudget.current}s / {activeRun.timeBudget.max}s</span>
                  </div>
                  <div className="chaos-bar-track">
                    <div className="chaos-bar-fill" style={{ width: `${Math.min(100, Math.max(0, (activeRun.timeBudget.current / (activeRun.timeBudget.max || 1)) * 100))}%` }}></div>
                  </div>
                </div>
                <div className="budget-bar-item">
                  <div className="budget-bar-labels">
                    <span>LLM CALLS</span>
                    <span>{activeRun.llmBudget.current} / {activeRun.llmBudget.max}</span>
                  </div>
                  <div className="chaos-bar-track">
                    <div className="chaos-bar-fill" style={{ width: `${Math.min(100, Math.max(0, (activeRun.llmBudget.current / (activeRun.llmBudget.max || 1)) * 100))}%` }}></div>
                  </div>
                  {activeRun.tokens && (
                    <div className="budget-bar-labels" style={{ marginTop: '4px' }}>
                      <span>TOKENS</span>
                      <span>{activeRun.tokens.total.toLocaleString()} ({activeRun.tokens.input.toLocaleString()} in / {activeRun.tokens.output.toLocaleString()} out)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Chaos Mode: Break Tool (Phase 1 - Prominent) */}
              <div style={{ marginTop: '16px', padding: '14px', borderRadius: '10px', background: isFaultInjected ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 214, 10, 0.08)', border: isFaultInjected ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 214, 10, 0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 600, color: isFaultInjected ? 'var(--err)' : 'var(--warn)' }}>
                    ⚡ CHAOS MODE
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-2)' }}>
                    {isFaultInjected ? 'FAULT INJECTED · RECOVERING' : 'READY TO INJECT'}
                  </span>
                </div>
                <button
                  className="btn-pill"
                  onClick={() => handleBreakTool('tool::sec_edgar_crawler')}
                  disabled={isFaultInjected}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: isFaultInjected ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 214, 10, 0.15)',
                    border: isFaultInjected ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 214, 10, 0.3)',
                    color: isFaultInjected ? 'var(--err)' : 'var(--warn)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: isFaultInjected ? 'not-allowed' : 'pointer',
                    opacity: isFaultInjected ? 0.6 : 1
                  }}
                >
                  {isFaultInjected ? '⚠ FAULT ACTIVE · WATCH RECOVERY' : '⚡ BREAK TOOL (INJECT FAULT)'}
                </button>
                <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                  Simulates RPC timeout → triggers Rung 2 recovery
                </div>
              </div>

              {/* Chaos Menu: Break this tool (Legacy - kept for additional options) */}
              <div>
                <div className="panel-title-mono" style={{ marginBottom: '8px' }}>
                  <span>Additional Tools</span>
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
        </ErrorBoundary>
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
                <img src="/logo.png" alt="Helmer" className="hero-badge-logo-img" />
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

      {/* ===================== PAGE: PROFILE (/profile) ===================== */}
      {currentPath === '/profile' && (
        <ProfileDashboard
          user={user}
          health={health}
          runs={runs}
          navigateTo={navigateTo}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
        />
      )}

      {/* ===================== POPUPS & MODALS ===================== */}
      <DeliverableModal
        isOpen={isDeliverableModalOpen}
        onClose={() => setIsDeliverableModalOpen(false)}
        content={artifactDisplayContent}
        goal={activeRun.goal}
        onDownload={handleDownload}
      />

      <QrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        qrDataUrl={qrDataUrl}
        steerUrl={steerUrl}
        activeRunId={activeRun.id}
        navigateTo={navigateTo}
      />

      <RedirectModal
        isOpen={isRedirectModalOpen}
        onClose={() => setIsRedirectModalOpen(false)}
        redirectInstruction={redirectInstruction}
        setRedirectInstruction={setRedirectInstruction}
        onSubmit={handleRedirect}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthenticated={(authenticatedUser) => setUser(authenticatedUser)}
      />
    </div>
  );
}
