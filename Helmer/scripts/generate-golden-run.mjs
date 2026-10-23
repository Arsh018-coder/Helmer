import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';

const GENESIS = '0'.repeat(64);

function canonical(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(canonical).join(',') + ']';
  }
  if (value !== null && typeof value === 'object') {
    const record = value;
    return (
      '{' +
      Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + canonical(record[key]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value) ?? 'null';
}

function computeHash(prevHash, runId, seq, ts, type, payloadText) {
  const input = `${prevHash}|${runId}|${seq}|${ts}|${type}|${payloadText}`;
  return createHash('sha256').update(input).digest('hex');
}

const runId = 'tx_883a90c1f';
const baseTs = 1760902200000;

const rawEvents = [
  {
    type: 'run_started',
    ts: baseTs,
    payload: {
      goal: 'Synthesize Q3 financial reports, reconcile multi-currency wire drift, and propose currency hedge allocations.',
      budget: { maxSteps: 8, maxSeconds: 180, maxLlmCalls: 25 },
    },
  },
  {
    type: 'contract_created',
    ts: baseTs + 500,
    payload: {
      criteria: [
        { id: 'c1', text: 'Zero ledger drift tolerance across wire accounts ($0.00 variance)', check: 'file_exists' },
        { id: 'c2', text: 'SEC 10-Q cryptographic hash match against EDGAR archive', check: 'min_urls', arg: 3 },
        { id: 'c3', text: 'All agent decision branches signed with ECDSA private keys', check: 'llm' },
        { id: 'c4', text: 'Deliverable formatted as briefing.md with hedge recommendations', check: 'word_range' },
      ],
    },
  },
  {
    type: 'plan_created',
    ts: baseTs + 1200,
    payload: {
      steps: [
        { step_no: 1, title: 'Planner Init & Confinement', tool: 'agent::planner' },
        { step_no: 2, title: 'Crawl SEC EDGAR 10-Q Payloads', tool: 'tool::sec_edgar_crawler' },
        { step_no: 3, title: 'Chaos Fault Injection & Recovery', tool: 'fault::simulate_rpc_drop' },
        { step_no: 4, title: 'Reconcile 14 Wire Ledgers', tool: 'calc::drift_reconciliation' },
        { step_no: 5, title: 'Seal ZK State Proof in Merkle Tree', tool: 'proof::zk_attestation' },
      ],
    },
  },
  {
    type: 'step_started',
    ts: baseTs + 1500,
    payload: { step_no: 1, title: 'Planner Init & gVisor Sandbox', tool: 'agent::planner' },
  },
  {
    type: 'reasoning',
    ts: baseTs + 1800,
    payload: {
      step_no: 1,
      thought: 'Deconstruct user intent into 4 deterministic sub-tasks. Verify gVisor sandbox confinement bounds.',
    },
  },
  {
    type: 'tool_result',
    ts: baseTs + 2200,
    payload: {
      step_no: 1,
      tool: 'agent::planner',
      duration_ms: 34,
      summary: 'Sandbox boundary verified; 4 sub-tasks registered.',
      output: JSON.stringify({ intent: 'Q3 financial reports', confinement: 'gVisor-isolated', nonce: '0x992c10' }, null, 2),
    },
  },
  {
    type: 'drift_check',
    ts: baseTs + 2400,
    payload: { step_no: 1, score: 98, autoPause: false },
  },
  {
    type: 'step_started',
    ts: baseTs + 3000,
    payload: { step_no: 2, title: 'Query SEC EDGAR 10-Q Payloads', tool: 'tool::sec_edgar_crawler' },
  },
  {
    type: 'reasoning',
    ts: baseTs + 3300,
    payload: {
      step_no: 2,
      thought: 'Queried SEC EDGAR database for 10-Q filing payloads. Extracted signed balance sheet nonces.',
    },
  },
  {
    type: 'tool_result',
    ts: baseTs + 5200,
    payload: {
      step_no: 2,
      tool: 'tool::sec_edgar_crawler',
      duration_ms: 42,
      summary: 'Extracted 10-Q filing payloads from EDGAR.',
      output: JSON.stringify({ target_doc: '10-Q_2025_Q3.xml', checksum: 'sha256:0x7fa281' }, null, 2),
      urls: [{ url: 'https://sec.gov/edgar/data/10-Q_2025_Q3.xml' }],
    },
  },
  {
    type: 'drift_check',
    ts: baseTs + 5500,
    payload: { step_no: 2, score: 96, autoPause: false },
  },
  {
    type: 'step_started',
    ts: baseTs + 6000,
    payload: { step_no: 3, title: 'Chaos Latency Simulation & Self-Heal', tool: 'fault::simulate_rpc_drop' },
  },
  {
    type: 'reasoning',
    ts: baseTs + 6300,
    payload: {
      step_no: 3,
      thought: 'Fault injected: primary endpoint timeout threshold hit (>4,500ms). Invoked hot standby sub-agent.',
    },
  },
  {
    type: 'recovery',
    ts: baseTs + 7500,
    payload: {
      step_no: 3,
      rung: 2,
      from_tool: 'tool::sec_edgar_crawler',
      to_tool: 'fault::simulate_rpc_drop',
      recovery_ms: 18,
    },
  },
  {
    type: 'tool_result',
    ts: baseTs + 7800,
    payload: {
      step_no: 3,
      tool: 'fault::simulate_rpc_drop',
      duration_ms: 210,
      summary: 'Healed upstream RPC timeout via hot standby agent.',
      output: JSON.stringify({ fault_type: 'NETWORK_TIMEOUT_SIMULATION', action: 'retry_then_fallback', recovery_ms: 18 }, null, 2),
    },
  },
  {
    type: 'step_started',
    ts: baseTs + 8500,
    payload: { step_no: 4, title: 'Multi-Currency Drift Reconciliation', tool: 'calc::drift_reconciliation' },
  },
  {
    type: 'reasoning',
    ts: baseTs + 8800,
    payload: {
      step_no: 4,
      thought: 'Cross-reconciled ledger transactions across 14 multi-currency ledgers. Absolute delta variance $0.00.',
    },
  },
  {
    type: 'tool_result',
    ts: baseTs + 10200,
    payload: {
      step_no: 4,
      tool: 'calc::drift_reconciliation',
      duration_ms: 88,
      summary: 'Balanced 14 wire ledgers with zero variance.',
      output: JSON.stringify({ wire_ledgers: 14, settlement_variance: '$0.00', status: 'BALANCED' }, null, 2),
    },
  },
  {
    type: 'drift_check',
    ts: baseTs + 10500,
    payload: { step_no: 4, score: 94, autoPause: false },
  },
  {
    type: 'step_started',
    ts: baseTs + 11000,
    payload: { step_no: 5, title: 'Seal Zero-Knowledge Cryptographic Attestation', tool: 'proof::zk_attestation' },
  },
  {
    type: 'reasoning',
    ts: baseTs + 11300,
    payload: {
      step_no: 5,
      thought: 'Constructed zero-knowledge Merkle leaf and published tamper-proof ECDSA attestation to audit chain.',
    },
  },
  {
    type: 'tool_result',
    ts: baseTs + 12400,
    payload: {
      step_no: 5,
      tool: 'proof::zk_attestation',
      duration_ms: 14,
      summary: 'Merkle leaf signed and sealed.',
      output: JSON.stringify({ block_height: 409219, merkle_root: '0x9b46ec27b16521bc19e78fd4e3b79f60f643f87d46ff8db31fa7c' }, null, 2),
    },
  },
  {
    type: 'artifact_written',
    ts: baseTs + 13000,
    payload: {
      step_no: 5,
      name: 'briefing.md',
      content: `# Q3 Multi-Currency Reconciliation Briefing

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
    },
  },
  {
    type: 'incident_report',
    ts: baseTs + 13200,
    payload: {
      report: `### Incident Report: Upstream RPC Timeout Healed
- **Failed Component:** tool::sec_edgar_crawler (Primary HTTP endpoint)
- **Root Cause:** Injected 4,500ms latency spike
- **Recovery Ladder Rung:** Rung 2 (Hot standby sub-agent fallback)
- **Recovery Duration:** 18ms
- **Outcome:** Clean recovery, 0 dropped frames, deliverable verified.`,
    },
  },
  {
    type: 'run_completed',
    ts: baseTs + 14000,
    payload: {
      verdict: 'verified',
      artifact: 'briefing.md',
      criteria_passed: 4,
      criteria_total: 4,
    },
  },
];

let prevHash = GENESIS;
const events = [];

for (let i = 0; i < rawEvents.length; i++) {
  const seq = i + 1;
  const ev = rawEvents[i];
  const payloadText = canonical(ev.payload);
  const hash = computeHash(prevHash, runId, seq, ev.ts, ev.type, payloadText);
  events.push({
    seq,
    ts: ev.ts,
    type: ev.type,
    payload: payloadText,
    prevHash,
    hash,
  });
  prevHash = hash;
}

const bundle = {
  runId,
  events,
  head: prevHash,
};

mkdirSync('public/fixtures', { recursive: true });
writeFileSync('public/fixtures/golden_run.json', JSON.stringify(bundle, null, 2) + '\n');
console.log(`Successfully generated public/fixtures/golden_run.json with ${events.length} events, head: ${prevHash}`);
