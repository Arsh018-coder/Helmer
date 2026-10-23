/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Helmer - Autonomous Agent Observability Platform
 * Built for devX · CGC University, Mohali · HACK-O-OCTO 4.0 (PS01)
 * Apple Product Page Aesthetics & True Glassmorphism (AGENTS.md Section 10-11)
 */

import React, { useState, useEffect, useRef } from 'react';

// Interfaces for Runs and Events (from AGENTS.md Section 6-7)
interface Criterion {
  id: string;
  text: string;
  check: 'min_urls' | 'word_range' | 'file_exists' | 'llm';
  arg?: any;
  status: 'pending' | 'pass' | 'fail';
  evidence?: string;
}

interface PlanStep {
  step_no: number;
  title: string;
  tool: string;
  status: 'completed' | 'running' | 'pending' | 'injected';
}

interface RunStep {
  step_no: number;
  title: string;
  tool: string;
  duration_ms: number;
  status: 'passed' | 'injected' | 'verified';
  reasoning: string;
  payload: string;
}

interface AgentRun {
  id: string;
  goal: string;
  status: 'running' | 'paused' | 'completed' | 'stopped';
  verdict: 'verified' | 'partially_verified' | 'unverified';
  driftScore: number;
  stepsBudget: { current: number; max: number };
  timeBudget: { current: number; max: number };
  llmBudget: { current: number; max: number };
  criteria: Criterion[];
  plan: PlanStep[];
  steps: RunStep[];
  created_at: string;
  duration: string;
  artifactContent?: string;
  incidentReport?: string;
}

// Preset runs data
const INITIAL_RUNS: AgentRun[] = [
  {
    id: 'tx_883a90c1f',
    goal: 'Synthesize Q3 financial reports, reconcile multi-currency wire drift, and propose currency hedge allocations.',
    status: 'completed',
    verdict: 'verified',
    driftScore: 94,
    stepsBudget: { current: 5, max: 8 },
    timeBudget: { current: 48, max: 180 },
    llmBudget: { current: 14, max: 25 },
    created_at: '2026-10-19 19:30 UTC',
    duration: '48.2s',
    criteria: [
      { id: 'c1', text: 'Zero ledger drift tolerance across wire accounts ($0.00 variance)', check: 'file_exists', status: 'pass', evidence: 'Ledger zero variance verified across 14 ledgers.' },
      { id: 'c2', text: 'SEC 10-Q cryptographic hash match against EDGAR archive', check: 'min_urls', arg: 3, status: 'pass', evidence: 'SHA256 checksum matched 10-Q filing payloads.' },
      { id: 'c3', text: 'All agent decision branches signed with ECDSA private keys', check: 'llm', status: 'pass', evidence: 'Leaf #409219 sealed with secp256k1 signature.' },
      { id: 'c4', text: 'Deliverable formatted as briefing.md with hedge recommendations', check: 'word_range', status: 'pass', evidence: 'File saved as briefing.md with 312 words.' },
    ],
    plan: [
      { step_no: 1, title: 'Planner Init & Confinement', tool: 'agent::planner', status: 'completed' },
      { step_no: 2, title: 'Crawl SEC EDGAR 10-Q Payloads', tool: 'tool::sec_edgar_crawler', status: 'completed' },
      { step_no: 3, title: 'Chaos Fault Injection & Recovery', tool: 'fault::simulate_rpc_drop', status: 'completed' },
      { step_no: 4, title: 'Reconcile 14 Wire Ledgers', tool: 'calc::drift_reconciliation', status: 'completed' },
      { step_no: 5, title: 'Seal ZK State Proof in Merkle Tree', tool: 'proof::zk_attestation', status: 'completed' },
    ],
    steps: [
      {
        step_no: 1,
        title: 'Planner Init & gVisor Sandbox',
        tool: 'agent::planner',
        duration_ms: 34,
        status: 'passed',
        reasoning: 'Deconstruct user intent into 4 deterministic sub-tasks. Verify gVisor sandbox confinement bounds.',
        payload: JSON.stringify({ intent: 'Q3 financial reports', confinement: 'gVisor-isolated', nonce: '0x992c10' }, null, 2),
      },
      {
        step_no: 2,
        title: 'Query SEC EDGAR 10-Q Payloads',
        tool: 'tool::sec_edgar_crawler',
        duration_ms: 42,
        status: 'passed',
        reasoning: 'Queried SEC EDGAR database for 10-Q filing payloads. Extracted signed balance sheet nonces.',
        payload: JSON.stringify({ target_doc: '10-Q_2025_Q3.xml', checksum: 'sha256:0x7fa281' }, null, 2),
      },
      {
        step_no: 3,
        title: 'Chaos Latency Simulation & Self-Heal',
        tool: 'fault::simulate_rpc_drop',
        duration_ms: 210,
        status: 'injected',
        reasoning: 'Fault injected: primary endpoint timeout threshold hit (>4,500ms). Invoked hot standby sub-agent.',
        payload: JSON.stringify({ fault_type: 'NETWORK_TIMEOUT_SIMULATION', action: 'retry_then_fallback', recovery_ms: 18 }, null, 2),
      },
      {
        step_no: 4,
        title: 'Multi-Currency Drift Reconciliation',
        tool: 'calc::drift_reconciliation',
        duration_ms: 88,
        status: 'passed',
        reasoning: 'Cross-reconciled ledger transactions across 14 multi-currency ledgers. Absolute delta variance $0.00.',
        payload: JSON.stringify({ wire_ledgers: 14, settlement_variance: '$0.00', status: 'BALANCED' }, null, 2),
      },
      {
        step_no: 5,
        title: 'Seal Zero-Knowledge Cryptographic Attestation',
        tool: 'proof::zk_attestation',
        duration_ms: 14,
        status: 'verified',
        reasoning: 'Constructed zero-knowledge Merkle leaf and published tamper-proof ECDSA attestation to audit chain.',
        payload: JSON.stringify({ block_height: 409219, merkle_root: '0x9b46ec27b16521bc19e78fd4e3b79f60f643f87d46ff8db31fa7c' }, null, 2),
      },
    ],
    artifactContent: `# Q3 Multi-Currency Reconciliation Briefing

## Executive Summary
All wire ledgers across EUR, USD, and JPY liquidity pools have been balanced with **$0.00 drift variance**. Cryptographic validation against SEC EDGAR 10-Q filing nonces completed deterministically.

### Key Ledger Checkpoints
- **Wire Ledgers Audited:** 14 accounts
- **Total Settlement Drift:** $0.00 (Zero Variance)
- **Recovery Invocations:** 1 Injected timeout healed in 18ms via standby agent
- **Merkle Block:** #409,219 (SHA256 verified)

### Asset Rebalancing Allocation
- **EUR/USD Hedge:** +12.4% allocation via spot forward contracts
- **JPY Liquidity Reserve:** Maintained at 18.5% with zero slippage
- **ECDSA Signatures:** Verified by independent auditor nodes`,
    incidentReport: `### Incident Report: Upstream RPC Timeout Healed
- **Failed Component:** tool::sec_edgar_crawler (Primary HTTP endpoint)
- **Root Cause:** Injected 4,500ms latency spike
- **Recovery Ladder Rung:** Rung 2 (Hot standby sub-agent fallback)
- **Recovery Duration:** 18ms
- **Outcome:** Clean recovery, 0 dropped frames, deliverable verified.`
  },
  {
    id: 'tx_4091ab77c',
    goal: 'Audit smart contract reentrancy attack vectors on decentralized lending vault and compile proof.',
    status: 'completed',
    verdict: 'verified',
    driftScore: 98,
    stepsBudget: { current: 4, max: 8 },
    timeBudget: { current: 36, max: 180 },
    llmBudget: { current: 10, max: 25 },
    created_at: '2026-10-19 18:15 UTC',
    duration: '36.8s',
    criteria: [
      { id: 'c1', text: 'Static bytecode decompilation match against verified contracts', check: 'file_exists', status: 'pass', evidence: 'Bytecode hashes aligned 100%.' },
      { id: 'c2', text: 'Fuzzing coverage greater than 95% across critical deposit methods', check: 'min_urls', arg: 3, status: 'pass', evidence: '98.2% branch coverage reached.' },
      { id: 'c3', text: 'Formal proof report saved as security_briefing.md', check: 'word_range', status: 'pass', evidence: 'Delivered as security_briefing.md (280 words).' },
    ],
    plan: [
      { step_no: 1, title: 'Bytecode Extraction', tool: 'evm::decompiler', status: 'completed' },
      { step_no: 2, title: 'Symbolic Execution Fuzzer', tool: 'fuzz::reentrancy_solver', status: 'completed' },
      { step_no: 3, title: 'Compile Attestation Proof', tool: 'proof::signer', status: 'completed' },
    ],
    steps: [
      {
        step_no: 1,
        title: 'Extract EVM Bytecode & CFG',
        tool: 'evm::decompiler',
        duration_ms: 22,
        status: 'passed',
        reasoning: 'Constructed control flow graph and identified all external delegate calls.',
        payload: JSON.stringify({ target: '0xVaultCore7a', methods: 18 }, null, 2),
      },
      {
        step_no: 2,
        title: 'Symbolic State Exploration',
        tool: 'fuzz::reentrancy_solver',
        duration_ms: 145,
        status: 'passed',
        reasoning: 'Simulated 10,000 recursive execution branches with reentrancy guard locks.',
        payload: JSON.stringify({ mutations: 10000, vulnerabilities_found: 0 }, null, 2),
      },
    ],
    artifactContent: `# Security Audit Attestation
Target vault 0xVaultCore7a verified reentrancy safe under symbolic analysis.`
  },
  {
    id: 'tx_1120ff98e',
    goal: 'Synthesize global semiconductor supply chain bottlenecks and compute lead-time volatility index.',
    status: 'completed',
    verdict: 'verified',
    driftScore: 91,
    stepsBudget: { current: 6, max: 8 },
    timeBudget: { current: 54, max: 180 },
    llmBudget: { current: 16, max: 25 },
    created_at: '2026-10-19 16:40 UTC',
    duration: '54.1s',
    criteria: [
      { id: 'c1', text: 'Cites at least 3 distinct wafer fab shipment reports', check: 'min_urls', arg: 3, status: 'pass', evidence: 'Cited TSMC, Samsung Foundry, and ASML quarterly disclosures.' },
      { id: 'c2', text: 'Lead-time volatility computed with standard deviation bands', check: 'file_exists', status: 'pass', evidence: 'Sigma variance matrix generated.' },
    ],
    plan: [
      { step_no: 1, title: 'Crawl Wafer Fab Disclosures', tool: 'tool::sec_edgar_crawler', status: 'completed' },
      { step_no: 2, title: 'Compute Volatility Variance', tool: 'calc::drift_reconciliation', status: 'completed' },
      { step_no: 3, title: 'Publish Supply Chain Index', tool: 'proof::zk_attestation', status: 'completed' },
    ],
    steps: [
      {
        step_no: 1,
        title: 'Crawl Wafer Fab Disclosures',
        tool: 'tool::sec_edgar_crawler',
        duration_ms: 38,
        status: 'passed',
        reasoning: 'Extracted supply chain metrics from foundry filings.',
        payload: JSON.stringify({ sources: 3, lead_time_mean_weeks: 24.5 }, null, 2),
      },
    ],
    artifactContent: `# Global Semiconductor Lead-Time Volatility Report
Average lead times stabilized at 24.5 weeks across advanced lithography nodes.`
  }
];

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');
  const [runs, setRuns] = useState<AgentRun[]>(INITIAL_RUNS);
  const [activeRunId, setActiveRunId] = useState<string>('tx_883a90c1f');
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
  const [verifyState, setVerifyState] = useState<'idle' | 'verifying' | 'verified'>('idle');
  const [runVerifyStatus, setRunVerifyStatus] = useState<'idle' | 'verifying' | 'verified' | 'tampered'>('idle');
  const [isTamperBroken, setIsTamperBroken] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Modals
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isRedirectModalOpen, setIsRedirectModalOpen] = useState(false);
  const [redirectInstruction, setRedirectInstruction] = useState('');

  // Replay State
  const [isReplaying, setIsReplaying] = useState(true);
  const [replayStepIdx, setReplayStepIdx] = useState(2);
  const [replaySpeed, setReplaySpeed] = useState<1 | 2>(1);

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

  // Navigation handler
  const navigateTo = (path: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Desktop 3D Cursor Tilt & Eye Visor Gaze Follow for Immersive Robot
  useEffect(() => {
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

  // Replay looping interval
  useEffect(() => {
    const active = runs.find((r) => r.id === activeRunId) || runs[0];
    if (!isReplaying || active.steps.length === 0) return;
    const intervalTime = replaySpeed === 1 ? 2600 : 1300;
    const timer = setInterval(() => {
      setReplayStepIdx((prev) => (prev + 1) % active.steps.length);
    }, intervalTime);
    return () => clearInterval(timer);
  }, [isReplaying, replaySpeed, runs, activeRunId]);

  // Robot interactive click handler
  const handleRobotClick = () => {
    setIsRobotPinged(true);
    setRobotStatus('PING ACKNOWLEDGED · LATENCY 6ms');
    setTimeout(() => {
      setIsRobotPinged(false);
      setRobotStatus('TELEMETRY ACTIVE · 60 FPS');
    }, 2400);
  };

  // Launch new run from console
  const handleLaunchRun = () => {
    const newId = 'tx_' + Math.random().toString(36).substring(2, 9);
    const newRun: AgentRun = {
      id: newId,
      goal: composerGoal,
      status: 'running',
      verdict: 'verified',
      driftScore: 96,
      stepsBudget: { current: 1, max: 8 },
      timeBudget: { current: 4, max: 180 },
      llmBudget: { current: 3, max: 25 },
      created_at: 'Just now',
      duration: '4.2s',
      criteria: [
        { id: 'c1', text: 'Generate checkable contract criteria', check: 'file_exists', status: 'pass', evidence: 'Contract criteria generated.' },
        { id: 'c2', text: 'Execute sandboxed web retrieval and calculation', check: 'min_urls', arg: 3, status: 'pending' },
        { id: 'c3', text: 'Publish cryptographic execution leaf nonce', check: 'llm', status: 'pending' },
      ],
      plan: [
        { step_no: 1, title: 'Contract Initialization', tool: 'agent::planner', status: 'completed' },
        { step_no: 2, title: 'Execute Tool Workflows', tool: 'search_web', status: 'running' },
        { step_no: 3, title: 'Reconcile Variance & Output', tool: 'calc_engine', status: 'pending' },
      ],
      steps: [
        {
          step_no: 1,
          title: 'Contract Initialization',
          tool: 'agent::planner',
          duration_ms: 28,
          status: 'passed',
          reasoning: 'Synthesized user goal into verifiable contract with 3 checkable success criteria.',
          payload: JSON.stringify({ goal: composerGoal, status: 'INITIALIZED' }, null, 2),
        },
      ],
    };

    setRuns([newRun, ...runs]);
    setActiveRunId(newId);
    navigateTo(`/run/${newId}`);
  };

  // Chaos Break Tool mid-run
  const handleBreakTool = (toolName: string) => {
    const active = runs.find((r) => r.id === activeRunId) || runs[0];
    const updated = { ...active };
    const newStepNo = updated.steps.length + 1;
    updated.steps.push({
      step_no: newStepNo,
      title: `Injected Fault: ${toolName}`,
      tool: toolName,
      duration_ms: 210,
      status: 'injected',
      reasoning: `Chaos mode triggered: simulated upstream network timeout on ${toolName}. Invoking Ladder Rung 2.`,
      payload: JSON.stringify({ fault: 'CHAOS_INJECTED', tool: toolName, fallback: 'retry_then_fallback' }, null, 2),
    });
    setRuns(runs.map((r) => (r.id === active.id ? updated : r)));
  };

  // Run verify log with SHA256 simulation
  const handleRunVerifyLog = () => {
    setRunVerifyStatus('verifying');
    setTimeout(() => {
      if (isTamperBroken) {
        setRunVerifyStatus('tampered');
      } else {
        setRunVerifyStatus('verified');
      }
    }, 600);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const activeRun = runs.find((r) => r.id === activeRunId) || runs[0];
  const currentReplayStep = activeRun.steps[replayStepIdx] || activeRun.steps[0];

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
            <a href={`/run/${activeRun.id}`} className={`nav-link ${currentPath.startsWith('/run') ? 'active' : ''}`} onClick={(e) => navigateTo(`/run/${activeRun.id}`, e)}>
              Live Run
            </a>
            <a href="/history" className={`nav-link ${currentPath === '/history' ? 'active' : ''}`} onClick={(e) => navigateTo('/history', e)}>
              History
            </a>
            <a href={`/r/${activeRun.id}`} className={`nav-link ${currentPath.startsWith('/r/') ? 'active' : ''}`} onClick={(e) => navigateTo(`/r/${activeRun.id}`, e)}>
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

      {/* 2. CONDITIONAL PAGE RENDERING */}

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
                      onClick={() => {
                        setVerifyState('verifying');
                        setTimeout(() => setVerifyState('verified'), 700);
                      }}
                      disabled={verifyState === 'verifying'}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      {verifyState === 'verifying' ? 'Verifying Merkle Root...' : verifyState === 'verified' ? 'Log Verified (0 Tampering)' : 'Verify log'}
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
                        {verifyState === 'verified' ? '✓ CRYPTOGRAPHICALLY VALIDATED' : 'VERIFIED ZERO TAMPERING'}
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
                    <button className="player-btn" onClick={() => setReplayStepIdx((prev) => (prev - 1 + activeRun.steps.length) % activeRun.steps.length)}>
                      Prev
                    </button>
                    <button className="player-btn" onClick={() => setReplayStepIdx((prev) => (prev + 1) % activeRun.steps.length)}>
                      Next
                    </button>
                    <button className="player-btn" onClick={() => setReplaySpeed((s) => (s === 1 ? 2 : 1))}>
                      {replaySpeed}x Speed
                    </button>
                  </div>
                  <div className="player-time-display">
                    STEP {replayStepIdx + 1} OF {activeRun.steps.length} · {currentReplayStep.title}
                  </div>
                </div>

                <div className="player-scrubber-track">
                  {activeRun.steps.map((st, idx) => (
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
                <div key={r.id} className="recent-run-item" onClick={() => { setActiveRunId(r.id); navigateTo(`/run/${r.id}`); }}>
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
      {currentPath.startsWith('/run/') && (
        <div className="page-wrapper container">
          {/* Top Bar */}
          <div className="run-top-bar glass-panel">
            <div className="run-top-left">
              <span className="protocol-badge" style={{ marginBottom: 0 }}>
                <span className="badge-dot-green" aria-hidden="true"></span>
                <span className="protocol-text">RUN ID: {activeRun.id}</span>
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text)', fontWeight: 600 }}>
                {activeRun.status === 'running' ? '● LIVE EXECUTING' : '✓ EXECUTION SEALED'}
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
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="step-tool-chip">{st.tool}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-2)' }}>{st.duration_ms}ms</span>
                    </div>
                  </div>

                  <div className="step-thought-text">
                    "{st.reasoning}"
                  </div>

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
                      onClick={() => alert('Downloaded briefing.md')}
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
                  onClick={() => setIsRunPaused(!isRunPaused)}
                  style={{ color: isRunPaused ? 'var(--ok)' : 'inherit' }}
                >
                  {isRunPaused ? '▶ Resume' : '⏸ Pause'}
                </button>
                <button
                  className="estop-button"
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                  onClick={() => alert('Emergency Halt Activated (< 12ms latency). All threads sealed.')}
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
                  HEAD: 0x9b46ec27b165..7a7c
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <button className="btn-pill btn-pill-primary btn-pill-sm" style={{ flex: 1 }} onClick={handleRunVerifyLog}>
                    {runVerifyStatus === 'verifying' ? 'Verifying...' : 'Verify Log'}
                  </button>
                  <button
                    className="btn-pill btn-pill-secondary btn-pill-sm"
                    onClick={() => {
                      setIsTamperBroken(!isTamperBroken);
                      setRunVerifyStatus('idle');
                    }}
                    title="Simulate SQL event modification without updating hashes"
                  >
                    {isTamperBroken ? 'Restore' : 'Tamper'}
                  </button>
                </div>

                {runVerifyStatus === 'verified' && (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '10.5px', color: 'var(--ok)', fontWeight: 600 }}>
                    ✓ 0 Tampering: All event nonces synchronized.
                  </div>
                )}
                {runVerifyStatus === 'tampered' && (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '10.5px', color: 'var(--err)', fontWeight: 600 }}>
                    ✕ Tamper Detected: Chain broken at Event #3!
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
                        <button className="btn-pill btn-pill-secondary btn-pill-sm" onClick={() => { setActiveRunId(r.id); navigateTo(`/run/${r.id}`); }}>
                          Inspect
                        </button>
                        <button
                          className="btn-pill btn-pill-secondary btn-pill-sm"
                          onClick={() => {
                            setActiveRunId(r.id);
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
      {currentPath.startsWith('/r/') && (
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
                onClick={() => setIsRunPaused(!isRunPaused)}
              >
                <span style={{ fontSize: '24px' }}>{isRunPaused ? '▶' : '⏸'}</span>
                <span>{isRunPaused ? 'Resume Run' : 'Pause Run'}</span>
              </button>

              <button
                className="steer-big-btn steer-btn-stop"
                onClick={() => alert('Emergency Kill Command broadcasted to server (< 12ms latency).')}
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

            {/* Sharp Inline SVG QR Code Representation */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
              <svg width="180" height="180" viewBox="0 0 100 100" style={{ background: '#FFFFFF', padding: '10px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.4)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                <rect x="0" y="0" width="100" height="100" fill="#FFFFFF" />
                {/* QR Finder patterns */}
                <rect x="10" y="10" width="24" height="24" fill="#0A0B0D" /><rect x="14" y="14" width="16" height="16" fill="#FFFFFF" /><rect x="18" y="18" width="8" height="8" fill="#0A0B0D" />
                <rect x="66" y="10" width="24" height="24" fill="#0A0B0D" /><rect x="70" y="14" width="16" height="16" fill="#FFFFFF" /><rect x="74" y="18" width="8" height="8" fill="#0A0B0D" />
                <rect x="10" y="66" width="24" height="24" fill="#0A0B0D" /><rect x="14" y="70" width="16" height="16" fill="#FFFFFF" /><rect x="18" y="74" width="8" height="8" fill="#0A0B0D" />
                {/* Data modules */}
                <rect x="40" y="12" width="4" height="4" fill="#0A0B0D" /><rect x="48" y="12" width="4" height="4" fill="#0A0B0D" /><rect x="56" y="12" width="4" height="4" fill="#0A0B0D" />
                <rect x="38" y="22" width="6" height="6" fill="#0E7C86" /><rect x="48" y="24" width="6" height="6" fill="#0A0B0D" />
                <rect x="12" y="42" width="4" height="4" fill="#0A0B0D" /><rect x="22" y="42" width="4" height="4" fill="#0A0B0D" /><rect x="32" y="42" width="4" height="4" fill="#0A0B0D" />
                <rect x="42" y="40" width="16" height="16" fill="#0E7C86" /><rect x="46" y="44" width="8" height="8" fill="#FFFFFF" />
                <rect x="68" y="44" width="6" height="6" fill="#0A0B0D" /><rect x="78" y="44" width="6" height="6" fill="#0A0B0D" />
                <rect x="40" y="66" width="6" height="6" fill="#0A0B0D" /><rect x="50" y="66" width="6" height="6" fill="#0E7C86" /><rect x="60" y="66" width="6" height="6" fill="#0A0B0D" />
                <rect x="70" y="72" width="8" height="8" fill="#0A0B0D" /><rect x="82" y="72" width="6" height="6" fill="#0A0B0D" />
              </svg>
            </div>

            <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)', wordBreak: 'break-all', marginBottom: '14px' }}>
              Target: /r/{activeRun.id}?t=demo_token
            </div>

            <button
              className="btn-pill btn-pill-primary"
              style={{ width: '100%' }}
              onClick={() => {
                setIsQrModalOpen(false);
                navigateTo(`/r/${activeRun.id}`);
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
                onClick={() => {
                  alert(`Instruction injected: "${redirectInstruction || 'Focus on zero variance'}"`);
                  setIsRedirectModalOpen(false);
                  setRedirectInstruction('');
                }}
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
