/**
 * lib/initialRuns.ts — initial preset runs and live execution templates.
 * Provides fallback data and client-side simulation when the external Postgres database
 * or worker is not connected, so the entire Helmer live run experience runs live in the browser.
 */

import type { AgentRun, Criterion, PlanStep, RunStep } from './types';
import { GENESIS, canonical, computeHash } from './chain';

export const INITIAL_RUNS: AgentRun[] = [
  {
    id: 'tx_883a90c1f',
    goal: 'Synthesize Q3 financial reports, reconcile multi-currency wire drift, and propose currency hedge allocations.',
    status: 'running',
    verdict: 'verified',
    driftScore: 94,
    stepsBudget: { current: 1, max: 8 },
    timeBudget: { current: 4, max: 180 },
    llmBudget: { current: 3, max: 25 },
    created_at: 'Just now',
    duration: '4.2s',
    tokens: { input: 3200, output: 1100, total: 4300 },
    criteria: [
      { id: 'c1', text: 'Zero ledger drift tolerance across wire accounts ($0.00 variance)', check: 'file_exists', status: 'pending', evidence: 'Ledger zero variance verified across 14 ledgers.' },
      { id: 'c2', text: 'SEC 10-Q cryptographic hash match against EDGAR archive', check: 'min_urls', arg: 3, status: 'pending', evidence: 'SHA256 checksum matched 10-Q filing payloads.' },
      { id: 'c3', text: 'All agent decision branches signed with ECDSA private keys', check: 'llm', status: 'pending', evidence: 'Leaf #409219 sealed with secp256k1 signature.' },
      { id: 'c4', text: 'Deliverable formatted as briefing.md with hedge recommendations', check: 'word_range', status: 'pending', evidence: 'File saved as briefing.md with 312 words.' },
    ],
    plan: [
      { step_no: 1, title: 'Planner Init & Confinement', tool: 'agent::planner', status: 'running' },
      { step_no: 2, title: 'Crawl SEC EDGAR 10-Q Payloads', tool: 'tool::sec_edgar_crawler', status: 'pending' },
      { step_no: 3, title: 'Chaos Fault Injection & Recovery', tool: 'fault::simulate_rpc_drop', status: 'pending' },
      { step_no: 4, title: 'Reconcile 14 Wire Ledgers', tool: 'calc::drift_reconciliation', status: 'pending' },
      { step_no: 5, title: 'Seal ZK State Proof in Merkle Tree', tool: 'proof::zk_attestation', status: 'pending' },
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
    tokens: { input: 8900, output: 3400, total: 12300 },
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
    tokens: { input: 12400, output: 4900, total: 17300 },
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

export interface FullRunStepDefinition {
  step_no: number;
  title: string;
  tool: string;
  duration_ms: number;
  status: 'passed' | 'injected' | 'verified';
  reasoning: string;
  payload: string;
  criterionPassIdx?: number;
  criterionEvidence?: string;
  tokensInc?: number;
  driftDelta?: number;
}

export const CANONICAL_LIVE_STEPS: FullRunStepDefinition[] = [
  {
    step_no: 1,
    title: 'Planner Init & gVisor Sandbox',
    tool: 'agent::planner',
    duration_ms: 34,
    status: 'passed',
    reasoning: 'Deconstruct user intent into 4 deterministic sub-tasks. Verify gVisor sandbox confinement bounds.',
    payload: JSON.stringify({ intent: 'Q3 financial reports', confinement: 'gVisor-isolated', nonce: '0x992c10' }, null, 2),
    criterionPassIdx: 0,
    criterionEvidence: 'Sandboxed planner init signed with 4 checkable criteria.',
    tokensInc: 1200,
    driftDelta: 0,
  },
  {
    step_no: 2,
    title: 'Query SEC EDGAR 10-Q Payloads',
    tool: 'tool::sec_edgar_crawler',
    duration_ms: 42,
    status: 'passed',
    reasoning: 'Queried SEC EDGAR database for 10-Q filing payloads. Extracted signed balance sheet nonces.',
    payload: JSON.stringify({ target_doc: '10-Q_2025_Q3.xml', checksum: 'sha256:0x7fa281' }, null, 2),
    criterionPassIdx: 1,
    criterionEvidence: 'SHA256 checksum matched 10-Q filing payloads from EDGAR archive.',
    tokensInc: 2400,
    driftDelta: -2,
  },
  {
    step_no: 3,
    title: 'Chaos Latency Simulation & Self-Heal',
    tool: 'fault::simulate_rpc_drop',
    duration_ms: 210,
    status: 'injected',
    reasoning: 'Fault injected: primary endpoint timeout threshold hit (>4,500ms). Invoked hot standby sub-agent.',
    payload: JSON.stringify({ fault_type: 'NETWORK_TIMEOUT_SIMULATION', action: 'retry_then_fallback', recovery_ms: 18 }, null, 2),
    tokensInc: 3100,
    driftDelta: -2,
  },
  {
    step_no: 4,
    title: 'Multi-Currency Drift Reconciliation',
    tool: 'calc::drift_reconciliation',
    duration_ms: 88,
    status: 'passed',
    reasoning: 'Cross-reconciled ledger transactions across 14 multi-currency ledgers. Absolute delta variance $0.00.',
    payload: JSON.stringify({ wire_ledgers: 14, settlement_variance: '$0.00', status: 'BALANCED' }, null, 2),
    criterionPassIdx: 0,
    criterionEvidence: 'Ledger zero variance verified across 14 ledgers ($0.00 variance).',
    tokensInc: 2900,
    driftDelta: 0,
  },
  {
    step_no: 5,
    title: 'Seal Zero-Knowledge Cryptographic Attestation',
    tool: 'proof::zk_attestation',
    duration_ms: 14,
    status: 'verified',
    reasoning: 'Constructed zero-knowledge Merkle leaf and published tamper-proof ECDSA attestation to audit chain.',
    payload: JSON.stringify({ block_height: 409219, merkle_root: '0x9b46ec27b16521bc19e78fd4e3b79f60f643f87d46ff8db31fa7c' }, null, 2),
    criterionPassIdx: 2,
    criterionEvidence: 'Leaf #409219 sealed with secp256k1 ECDSA signature.',
    tokensInc: 1800,
    driftDelta: 0,
  },
];

/**
 * Creates a brand new run template for any custom goal.
 */
export function createCustomLiveRun(goal: string): { run: AgentRun; allSteps: FullRunStepDefinition[] } {
  const newId = 'tx_' + Math.random().toString(36).substring(2, 9);
  
  const criteria: Criterion[] = [
    { id: 'c1', text: 'Zero variance / boundary constraints satisfied', check: 'file_exists', status: 'pending' },
    { id: 'c2', text: 'Cites at least 3 verified external source documents', check: 'min_urls', arg: 3, status: 'pending' },
    { id: 'c3', text: 'All decision branches signed with ECDSA private keys', check: 'llm', status: 'pending' },
    { id: 'c4', text: 'Deliverable formatted as briefing.md with recommendations', check: 'word_range', status: 'pending' },
  ];

  const plan: PlanStep[] = [
    { step_no: 1, title: 'Planner Init & Intent Deconstruction', tool: 'agent::planner', status: 'running' },
    { step_no: 2, title: 'Live Tool Data Retrieval', tool: 'tool::sec_edgar_crawler', status: 'pending' },
    { step_no: 3, title: 'Chaos Resilience & Fault Recovery', tool: 'fault::simulate_rpc_drop', status: 'pending' },
    { step_no: 4, title: 'Domain Calculation & Drift Guard', tool: 'calc::drift_reconciliation', status: 'pending' },
    { step_no: 5, title: 'Seal Attestation & Emit Deliverable', tool: 'proof::zk_attestation', status: 'pending' },
  ];

  const allSteps: FullRunStepDefinition[] = [
    {
      step_no: 1,
      title: 'Planner Init & Intent Deconstruction',
      tool: 'agent::planner',
      duration_ms: 32,
      status: 'passed',
      reasoning: `Deconstruct user intent into 4 deterministic sub-tasks. Goal: "${goal}". Confinement bounds verified.`,
      payload: JSON.stringify({ goal, confinement: 'gVisor-isolated', subtasks: 4 }, null, 2),
      criterionPassIdx: 0,
      criterionEvidence: 'Deterministic contract initialized with 4 checkable success criteria.',
      tokensInc: 1400,
      driftDelta: 0,
    },
    {
      step_no: 2,
      title: 'Live Tool Data Retrieval',
      tool: 'tool::sec_edgar_crawler',
      duration_ms: 45,
      status: 'passed',
      reasoning: 'Extracted source payloads and verified cryptographic nonces for target domain.',
      payload: JSON.stringify({ target: goal.slice(0, 30), sources: 3, checksum: 'sha256:0x8cb11a' }, null, 2),
      criterionPassIdx: 1,
      criterionEvidence: 'Retrieved and verified 3 independent document payloads.',
      tokensInc: 2200,
      driftDelta: -1,
    },
    {
      step_no: 3,
      title: 'Chaos Resilience & Fault Recovery',
      tool: 'fault::simulate_rpc_drop',
      duration_ms: 195,
      status: 'injected',
      reasoning: 'Fault injected: primary endpoint timeout threshold hit (>4,500ms). Invoked hot standby sub-agent.',
      payload: JSON.stringify({ fault_type: 'NETWORK_TIMEOUT_SIMULATION', action: 'retry_then_fallback', recovery_ms: 18 }, null, 2),
      tokensInc: 2800,
      driftDelta: -2,
    },
    {
      step_no: 4,
      title: 'Domain Calculation & Drift Guard',
      tool: 'calc::drift_reconciliation',
      duration_ms: 76,
      status: 'passed',
      reasoning: 'Executed analytical verification matrix. Reconciled variance to $0.00 zero-drift bounds.',
      payload: JSON.stringify({ variance: '$0.00', status: 'BALANCED', drift: 0 }, null, 2),
      criterionPassIdx: 0,
      criterionEvidence: 'Zero variance verified across audited boundary constraints ($0.00 delta).',
      tokensInc: 2600,
      driftDelta: 0,
    },
    {
      step_no: 5,
      title: 'Seal Attestation & Emit Deliverable',
      tool: 'proof::zk_attestation',
      duration_ms: 16,
      status: 'verified',
      reasoning: 'Constructed cryptographic leaf and sealed deliverable briefing.md with ECDSA signature.',
      payload: JSON.stringify({ block: 409220, signature: '0x992bf1..ecdsa', deliverable: 'briefing.md' }, null, 2),
      criterionPassIdx: 2,
      criterionEvidence: 'ECDSA leaf sealed on audit chain.',
      tokensInc: 1900,
      driftDelta: 0,
    },
  ];

  const run: AgentRun = {
    id: newId,
    goal,
    status: 'running',
    verdict: 'verified',
    driftScore: 98,
    stepsBudget: { current: 1, max: 8 },
    timeBudget: { current: 1, max: 180 },
    llmBudget: { current: 2, max: 25 },
    created_at: 'Just now',
    duration: '1.0s',
    tokens: { input: 1400, output: 400, total: 1800 },
    criteria,
    plan,
    steps: [
      {
        step_no: 1,
        title: allSteps[0].title,
        tool: allSteps[0].tool,
        duration_ms: allSteps[0].duration_ms,
        status: allSteps[0].status,
        reasoning: allSteps[0].reasoning,
        payload: allSteps[0].payload,
      },
    ],
    artifactContent: `# Autonomous Agent Execution Briefing

## Executive Summary
Execution completed deterministically for goal:
> **${goal}**

### Telemetry Checkpoints
- **Audit Nonces:** Verified and sealed
- **Recovery Invocations:** 1 Injected latency spike self-healed in 18ms
- **Drift Tolerance:** 0.00 variance
- **Status:** Sealed on Flight Recorder with SHA256 chain`,
    incidentReport: `### Incident Report: Upstream RPC Timeout Healed
- **Failed Component:** tool::sec_edgar_crawler (Primary HTTP endpoint)
- **Root Cause:** Injected 4,500ms latency spike
- **Recovery Ladder Rung:** Rung 2 (Hot standby sub-agent fallback)
- **Recovery Duration:** 18ms
- **Outcome:** Clean recovery, 0 dropped frames, deliverable verified.`
  };

  return { run, allSteps };
}

/**
 * Builds an authentic cryptographic event record chain for a run.
 */
export async function buildCryptographicEvents(
  runId: string,
  goal: string,
  steps: RunStep[],
  options?: { isTampered?: boolean; tamperedSeq?: number }
) {
  const events = [];
  let prevHash = GENESIS;
  const baseTs = Date.now() - 60000;

  // 1. run_started
  const p1 = canonical({ goal, budget: { maxSteps: 8, maxSeconds: 180, maxLlmCalls: 25 } });
  const h1 = await computeHash(prevHash, runId, 1, baseTs, 'run_started', p1);
  events.push({ seq: 1, ts: baseTs, type: 'run_started', payload: p1, prevHash, hash: h1 });
  prevHash = h1;

  // 2. contract_created
  const p2 = canonical({
    criteria: [
      { id: 'c1', text: 'Zero ledger drift tolerance across wire accounts ($0.00 variance)', check: 'file_exists' },
      { id: 'c2', text: 'SEC 10-Q cryptographic hash match against EDGAR archive', check: 'min_urls' },
      { id: 'c3', text: 'All agent decision branches signed with ECDSA private keys', check: 'llm' },
      { id: 'c4', text: 'Deliverable formatted as briefing.md with hedge recommendations', check: 'word_range' },
    ],
  });
  const h2 = await computeHash(prevHash, runId, 2, baseTs + 400, 'contract_created', p2);
  events.push({ seq: 2, ts: baseTs + 400, type: 'contract_created', payload: p2, prevHash, hash: h2 });
  prevHash = h2;

  // 3. plan_created
  const p3 = canonical({
    steps: steps.map((s) => ({ step_no: s.step_no, title: s.title, tool: s.tool })),
  });
  const h3 = await computeHash(prevHash, runId, 3, baseTs + 800, 'plan_created', p3);
  events.push({ seq: 3, ts: baseTs + 800, type: 'plan_created', payload: p3, prevHash, hash: h3 });
  prevHash = h3;

  // Step events
  let seq = 4;
  for (const st of steps) {
    const pStep = canonical({ step_no: st.step_no, title: st.title, tool: st.tool });
    const hStep = await computeHash(prevHash, runId, seq, baseTs + seq * 600, 'step_started', pStep);
    events.push({ seq, ts: baseTs + seq * 600, type: 'step_started', payload: pStep, prevHash, hash: hStep });
    prevHash = hStep;
    seq++;

    const pReas = canonical({ step_no: st.step_no, thought: st.reasoning });
    const hReas = await computeHash(prevHash, runId, seq, baseTs + seq * 600, 'reasoning', pReas);
    events.push({ seq, ts: baseTs + seq * 600, type: 'reasoning', payload: pReas, prevHash, hash: hReas });
    prevHash = hReas;
    seq++;

    let pTool = canonical({ step_no: st.step_no, tool: st.tool, duration_ms: st.duration_ms, output: st.payload });
    if (options?.isTampered && seq === (options.tamperedSeq ?? 6)) {
      pTool = JSON.stringify({ tampered: true, original: pTool });
    }
    const hTool = await computeHash(prevHash, runId, seq, baseTs + seq * 600, 'tool_result', pTool);
    events.push({ seq, ts: baseTs + seq * 600, type: 'tool_result', payload: pTool, prevHash, hash: hTool });
    prevHash = hTool;
    seq++;
  }

  return { events, head: prevHash };
}
