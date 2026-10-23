/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RunStatus = 'queued' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed';

export type ToolName = 
  | 'search_web' 
  | 'search_sec_edgar' 
  | 'fetch_regulatory_filing' 
  | 'synthesize_citation' 
  | 'write_deliverable'
  | 'audit_ledger';

export interface ContractCriterion {
  id: string;
  description: string;
  type: 'deterministic' | 'qualitative';
  status: 'pending' | 'pass' | 'fail';
  evidence?: string;
  verifiedAt?: number;
}

export interface IntentContract {
  id: string;
  deterministicCriteria: ContractCriterion[];
  qualitativeCriteria: ContractCriterion[];
  sealedAt: number;
  hash: string;
}

export interface ResourceBudget {
  maxSteps: number;
  maxSeconds: number;
  maxLlmCalls: number;
  usedSteps: number;
  usedSeconds: number;
  usedLlmCalls: number;
}

export interface RunEvent {
  runId: string;
  seq: number;
  ts: number;
  type: 
    | 'runStarted'
    | 'contractDrafted'
    | 'stepStarted'
    | 'modelReasoning'
    | 'toolCall'
    | 'toolResult'
    | 'driftAssessment'
    | 'faultInjected'
    | 'recoveryAttempt'
    | 'paused'
    | 'resumed'
    | 'stopped'
    | 'contractVerified'
    | 'runFinished';
  payload: Record<string, any>;
  prevHash: string;
  hash: string;
}

export interface RunStep {
  seq: number;
  title: string;
  tool: ToolName;
  durationMs: number;
  status: 'ok' | 'error' | 'in_progress';
  reasoningSnippet: string;
  inputPayload: Record<string, any>;
  outputPayload: Record<string, any>;
  timestamp: number;
}

export interface DeliverableArtifact {
  runId: string;
  name: string;
  content: string;
  bytes: number;
  wordCount: number;
  charCount: number;
  createdAt: number;
  verified: boolean;
  sha256: string;
}

export interface RunCommand {
  id: string;
  runId: string;
  kind: 'pause' | 'resume' | 'stop' | 'redirect';
  payload?: {
    instruction?: string;
  };
  source: 'phone' | 'desktop';
  createdAt: number;
  consumedAt?: number;
}

export interface Run {
  id: string;
  goal: string;
  status: RunStatus;
  provider: 'Groq' | 'Gemini' | 'OpenAI';
  model: string;
  contract: IntentContract;
  budget: ResourceBudget;
  events: RunEvent[];
  steps: RunStep[];
  driftScore: number; // 0 to 100, nominal >= 90
  driftHistory: { ts: number; score: number }[];
  artifact?: DeliverableArtifact;
  verdict?: 'VERIFIED' | 'TAMPERED' | 'E_STOPPED' | 'TIMEOUT';
  workerTag: string;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  totalPausedMs: number;
  lastPausedAt?: number;
  pinnedHeadHash?: string;
}

export interface SystemHealth {
  workerTag: string;
  workerSeenAt: number;
  status: 'healthy' | 'degraded' | 'offline';
  latencyMs: number;
  gVisorIsolation: boolean;
  databaseConnected: boolean;
  activeRunsCount: number;
}
