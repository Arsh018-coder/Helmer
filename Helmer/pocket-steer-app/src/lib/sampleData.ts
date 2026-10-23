/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Run, RunEvent, RunStep, DeliverableArtifact } from '../types';
import { computeEventHash } from './chain';

export async function createPreseededRuns(): Promise<Run[]> {
  const GENESIS = '0000000000000000000000000000000000000000000000000000000000000000';
  const now = Date.now();

  // Run 1: uhpwpnza (Active flagship run from the blueprint)
  const run1Events: RunEvent[] = [];
  let prevHash = GENESIS;

  async function pushEvent(
    type: RunEvent['type'],
    payload: Record<string, any>,
    offsetMs: number
  ) {
    const seq = run1Events.length + 1;
    const ts = now - 95000 + offsetMs;
    const hash = await computeEventHash(prevHash, seq, ts, type, payload);
    const ev: RunEvent = {
      runId: 'uhpwpnza',
      seq,
      ts,
      type,
      payload,
      prevHash,
      hash
    };
    run1Events.push(ev);
    prevHash = hash;
    return ev;
  }

  await pushEvent('runStarted', { goal: 'Q3 Financial Drift Reconciliation & EDGAR 10-Q Filing Attestation', model: 'gemini-2.0-flash' }, 0);
  await pushEvent('contractDrafted', { criteriaCount: 4, deterministic: 3, qualitative: 1 }, 1200);
  await pushEvent('stepStarted', { seq: 1, tool: 'search_sec_edgar', target: 'NVIDIA Corp Form 10-Q Q3 FY25' }, 2800);
  await pushEvent('toolCall', { tool: 'search_sec_edgar', params: { cik: '0001045810', form: '10-Q', period: '2024-Q3' } }, 3400);
  await pushEvent('toolResult', { tool: 'search_sec_edgar', accession: '0001045810-24-000088', status: '200 OK', bytes: 14280 }, 6200);
  await pushEvent('stepStarted', { seq: 2, tool: 'fetch_regulatory_filing', section: 'Item 1. Consolidated Financial Statements' }, 8100);
  await pushEvent('toolResult', { tool: 'fetch_regulatory_filing', revenue: '$35,082,000,000', margin: '86.2%', status: '200 OK' }, 14500);
  await pushEvent('driftAssessment', { score: 96, driftDetected: false, notes: 'Strict alignment with SEC filing terms' }, 18000);
  await pushEvent('stepStarted', { seq: 3, tool: 'synthesize_citation', citations: ['SEC-10Q-p12', 'SEC-10Q-p24'] }, 22000);
  await pushEvent('toolResult', { tool: 'synthesize_citation', verifiedCitationsCount: 2, status: '200 OK' }, 27000);
  await pushEvent('contractVerified', { criterionId: 'crit-1', status: 'pass', evidence: 'Q3 FY25 Revenue matches $35,082M exactly.' }, 31000);
  await pushEvent('stepStarted', { seq: 4, tool: 'write_deliverable', filename: 'briefing.md' }, 35000);
  await pushEvent('toolResult', { tool: 'write_deliverable', filename: 'briefing.md', words: 240, status: '200 OK' }, 42000);

  const stepsRun1: RunStep[] = [
    {
      seq: 1,
      title: 'SEC EDGAR Filings Query',
      tool: 'search_sec_edgar',
      durationMs: 42,
      status: 'ok',
      reasoningSnippet: 'Targeting official SEC Edgar accession 0001045810-24-000088 to isolate GAAP revenue tables.',
      inputPayload: { cik: '0001045810', form: '10-Q', period: 'Q3-FY25' },
      outputPayload: { accession: '0001045810-24-000088', filingDate: '2024-11-20', verified: true },
      timestamp: now - 90000
    },
    {
      seq: 2,
      title: 'Parse Consolidated Income Statement',
      tool: 'fetch_regulatory_filing',
      durationMs: 118,
      status: 'ok',
      reasoningSnippet: 'Reconciling Data Center segment operating profit against audited operating expense allocations.',
      inputPayload: { section: 'Item 1. Financial Statements', targetMetrics: ['Revenue', 'Gross Margin', 'OpEx'] },
      outputPayload: { revenue: '$35.082B', grossMargin: '74.6% GAAP / 86.2% Segment', passThreshold: true },
      timestamp: now - 78000
    },
    {
      seq: 3,
      title: 'Cross-Citation Verification',
      tool: 'synthesize_citation',
      durationMs: 56,
      status: 'ok',
      reasoningSnippet: 'Validating cryptographic footnote references against SEC Item 2 Management Discussion.',
      inputPayload: { citations: ['SEC-10Q-p12', 'SEC-10Q-p24'], mode: 'strict' },
      outputPayload: { verifiedCount: 2, unverifiedCount: 0, integrityScore: 1.0 },
      timestamp: now - 52000
    },
    {
      seq: 4,
      title: 'Assemble briefing.md Deliverable',
      tool: 'write_deliverable',
      durationMs: 84,
      status: 'ok',
      reasoningSnippet: 'Finalizing deterministic briefing artifact with exact word budget and signed ledger metadata.',
      inputPayload: { file: 'briefing.md', wordTarget: '180-350' },
      outputPayload: { words: 240, characters: 1420, path: '/artifacts/briefing.md' },
      timestamp: now - 25000
    }
  ];

  const artifactRun1: DeliverableArtifact = {
    runId: 'uhpwpnza',
    name: 'briefing.md',
    content: `# Executive Attestation Briefing: Q3 FY25 Financial Reconciliation

### 1. Primary Ledger Verification
In accordance with **SEC Form 10-Q (Accession: 0001045810-24-000088)**, NVIDIA Corporation reported GAAP revenue of **$35,082 million** for the third quarter ended October 27, 2024, representing a **94% increase** year-over-year and a **17% sequential growth** from Q2.

### 2. Segment Performance & Operating Margin
- **Data Center Revenue:** Reached **$30.8 billion**, up 112% from the prior fiscal year.
- **Gross Margin:** GAAP gross margin reached **74.6%** (Non-GAAP **75.1%**). The Data Center hardware margin strictly exceeded the **85% verified threshold** under segment note 12.
- **Operating Cash Flow:** Net cash provided by operating activities totaled **$17,629 million**.

### 3. Invariant Compliance Audit
1. **Revenue Determinism:** Verified against Table 1, Consolidated Statements of Income. Zero drift detected.
2. **Citation Source Quality:** Exclusively grounded in Tier-1 regulatory disclosures with public EDGAR hash verification.
3. **Budget Adherence:** Compiled in 4 execution steps totaling 300ms compute latency.

*Cryptographically sealed under Helmer SHA-256 Flight Ledger protocol.*`,
    bytes: 1420,
    wordCount: 240,
    charCount: 1420,
    createdAt: now - 20000,
    verified: true,
    sha256: run1Events[run1Events.length - 1].hash
  };

  const run1: Run = {
    id: 'uhpwpnza',
    goal: 'Q3 Financial Drift Reconciliation & EDGAR 10-Q Filing Attestation',
    status: 'running',
    provider: 'Gemini',
    model: 'gemini-2.0-flash',
    contract: {
      id: 'contract-uhpwpnza',
      deterministicCriteria: [
        {
          id: 'crit-1',
          description: 'Verify NVDA Q3 revenue of $35.08B against SEC Form 10-Q filing accession number 0001045810-24-000088.',
          type: 'deterministic',
          status: 'pass',
          evidence: 'Item 1. Financial Statements: Q3 FY25 Revenue matches $35,082M exactly.',
          verifiedAt: now - 31000
        },
        {
          id: 'crit-2',
          description: 'Extract Data Center segment operating margin (target: >= 85%).',
          type: 'deterministic',
          status: 'pass',
          evidence: 'Data Center revenue $30.8B, gross margin 86.2% verified in note 12.',
          verifiedAt: now - 28000
        },
        {
          id: 'crit-3',
          description: 'Deliverable word count between 180 and 350 words.',
          type: 'deterministic',
          status: 'pass',
          evidence: 'Current briefing.md stands at 240 words.',
          verifiedAt: now - 20000
        }
      ],
      qualitativeCriteria: [
        {
          id: 'crit-4',
          description: 'Zero unverified rumors; cite only official regulatory disclosures.',
          type: 'qualitative',
          status: 'pass',
          evidence: 'Strict Edgar citations verified without secondary social web hits.',
          verifiedAt: now - 22000
        }
      ],
      sealedAt: now - 93000,
      hash: 'a9f7e8124b810d7a64ce1982bca937102941e765103a89100234bcfda091176b'
    },
    budget: {
      maxSteps: 8,
      maxSeconds: 180,
      maxLlmCalls: 25,
      usedSteps: 4,
      usedSeconds: 42,
      usedLlmCalls: 7
    },
    events: run1Events,
    steps: stepsRun1,
    driftScore: 94,
    driftHistory: [
      { ts: now - 90000, score: 98 },
      { ts: now - 75000, score: 96 },
      { ts: now - 50000, score: 95 },
      { ts: now - 25000, score: 94 }
    ],
    artifact: artifactRun1,
    verdict: 'VERIFIED',
    workerTag: 'acode-mac',
    createdAt: now - 95000,
    updatedAt: now - 2000,
    totalPausedMs: 0,
    pinnedHeadHash: run1Events[run1Events.length - 1].hash
  };

  // Run 2: cr98k21m (Semiconductor Lithography Supply Bottleneck Audit)
  const run2Events: RunEvent[] = [];
  prevHash = GENESIS;
  const ts2 = now - 600000;
  for (let i = 1; i <= 6; i++) {
    const t = ts2 + i * 15000;
    const h = await computeEventHash(prevHash, i, t, 'stepStarted', { seq: i, note: `Audit checkpoint ${i}` });
    run2Events.push({
      runId: 'cr98k21m',
      seq: i,
      ts: t,
      type: i === 6 ? 'contractVerified' : 'stepStarted',
      payload: { seq: i, audited: true },
      prevHash,
      hash: h
    });
    prevHash = h;
  }

  const run2: Run = {
    id: 'cr98k21m',
    goal: 'Semiconductor Lithography Supply Bottleneck Audit (ASML NXE:3800E)',
    status: 'completed',
    provider: 'Groq',
    model: 'qwen/qwen3.8-27b',
    contract: {
      id: 'contract-cr98k21m',
      deterministicCriteria: [
        {
          id: 'c1',
          description: 'Reconcile lead time variance across Carl Zeiss optics and Trumpf laser modules.',
          type: 'deterministic',
          status: 'pass',
          evidence: '14-month supply horizon confirmed in export registry.',
          verifiedAt: ts2 + 60000
        }
      ],
      qualitativeCriteria: [
        {
          id: 'c2',
          description: 'Assess single-source geopolitical risk factor.',
          type: 'qualitative',
          status: 'pass',
          evidence: 'Dual-source mitigation assessed for sub-assemblies.',
          verifiedAt: ts2 + 75000
        }
      ],
      sealedAt: ts2,
      hash: run2Events[0].hash
    },
    budget: {
      maxSteps: 10,
      maxSeconds: 240,
      maxLlmCalls: 30,
      usedSteps: 6,
      usedSeconds: 88,
      usedLlmCalls: 12
    },
    events: run2Events,
    steps: [
      {
        seq: 1,
        title: 'Optics Procurement Inventory Check',
        tool: 'search_web',
        durationMs: 64,
        status: 'ok',
        reasoningSnippet: 'Cross-verifying cleanroom lens availability in Veldhoven hub.',
        inputPayload: { supplier: 'Carl Zeiss SMT' },
        outputPayload: { matchedBatches: 8 },
        timestamp: ts2 + 15000
      }
    ],
    driftScore: 97,
    driftHistory: [{ ts: ts2, score: 97 }],
    verdict: 'VERIFIED',
    workerTag: 'acode-mac',
    createdAt: ts2,
    updatedAt: ts2 + 90000,
    finishedAt: ts2 + 90000,
    totalPausedMs: 0,
    pinnedHeadHash: run2Events[run2Events.length - 1].hash
  };

  return [run1, run2];
}
