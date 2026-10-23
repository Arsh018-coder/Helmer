/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RunEvent, Run, DeliverableArtifact } from '../types';

/**
 * Compute SHA-256 hash using native Web Crypto API
 */
export async function sha256Hex(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback simple 64-char hash for non-secure contexts
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < message.length; i++) {
    const ch = message.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const raw = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return (raw.toString(16) + '0000000000000000000000000000000000000000000000000000000000000000').slice(0, 64);
}

/**
 * Deterministic JSON stringify with sorted keys
 */
export function canonicalizeJson(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalizeJson(obj[k])).join(',') + '}';
}

/**
 * Compute the SHA-256 hash of a single event in the chain
 */
export async function computeEventHash(
  prevHash: string,
  seq: number,
  ts: number,
  type: string,
  payload: Record<string, any>
): Promise<string> {
  const canonicalPayload = canonicalizeJson(payload);
  const message = `${prevHash}|${seq}|${ts}|${type}|${canonicalPayload}`;
  return await sha256Hex(message);
}

export interface ChainVerificationResult {
  intact: boolean;
  totalEvents: number;
  calculatedHead: string;
  expectedHead: string;
  brokenAtSeq?: number;
  brokenReason?: string;
  auditTrail: {
    seq: number;
    type: string;
    hash: string;
    valid: boolean;
  }[];
}

/**
 * Verify a full SHA-256 hash-chained event ledger
 */
export async function verifyChain(
  events: RunEvent[],
  pinnedHead?: string
): Promise<ChainVerificationResult> {
  if (!events || events.length === 0) {
    return {
      intact: false,
      totalEvents: 0,
      calculatedHead: '',
      expectedHead: pinnedHead || '',
      brokenReason: 'Empty event ledger',
      auditTrail: []
    };
  }

  // Sort events by sequence ascending
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  const auditTrail: ChainVerificationResult['auditTrail'] = [];

  const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
  let prevExpectedHash = GENESIS_PREV_HASH;

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];

    // Sequence continuity check
    if (ev.seq !== i + 1) {
      return {
        intact: false,
        totalEvents: sorted.length,
        calculatedHead: prevExpectedHash,
        expectedHead: pinnedHead || sorted[sorted.length - 1].hash,
        brokenAtSeq: ev.seq,
        brokenReason: `Sequence break: expected seq ${i + 1}, received seq ${ev.seq}`,
        auditTrail
      };
    }

    // Previous hash link check
    if (ev.prevHash !== prevExpectedHash) {
      auditTrail.push({
        seq: ev.seq,
        type: ev.type,
        hash: ev.hash,
        valid: false
      });
      return {
        intact: false,
        totalEvents: sorted.length,
        calculatedHead: prevExpectedHash,
        expectedHead: pinnedHead || sorted[sorted.length - 1].hash,
        brokenAtSeq: ev.seq,
        brokenReason: `PrevHash mismatch at seq ${ev.seq}. Expected ${prevExpectedHash.slice(0, 12)}..., found ${ev.prevHash.slice(0, 12)}...`,
        auditTrail
      };
    }

    // Recompute payload hash
    const recomputed = await computeEventHash(ev.prevHash, ev.seq, ev.ts, ev.type, ev.payload);
    if (recomputed !== ev.hash) {
      auditTrail.push({
        seq: ev.seq,
        type: ev.type,
        hash: ev.hash,
        valid: false
      });
      return {
        intact: false,
        totalEvents: sorted.length,
        calculatedHead: recomputed,
        expectedHead: pinnedHead || sorted[sorted.length - 1].hash,
        brokenAtSeq: ev.seq,
        brokenReason: `Cryptographic payload tampering at seq ${ev.seq}. Expected hash ${recomputed.slice(0, 12)}..., stored hash ${ev.hash.slice(0, 12)}...`,
        auditTrail
      };
    }

    auditTrail.push({
      seq: ev.seq,
      type: ev.type,
      hash: ev.hash,
      valid: true
    });
    prevExpectedHash = ev.hash;
  }

  const finalHead = sorted[sorted.length - 1].hash;
  if (pinnedHead && pinnedHead.trim() !== '' && pinnedHead.trim().toLowerCase() !== finalHead.toLowerCase()) {
    return {
      intact: false,
      totalEvents: sorted.length,
      calculatedHead: finalHead,
      expectedHead: pinnedHead,
      brokenAtSeq: sorted[sorted.length - 1].seq,
      brokenReason: `Pinned head hash mismatch. Pinned head: ${pinnedHead.slice(0, 16)}..., calculated: ${finalHead.slice(0, 16)}...`,
      auditTrail
    };
  }

  return {
    intact: true,
    totalEvents: sorted.length,
    calculatedHead: finalHead,
    expectedHead: pinnedHead || finalHead,
    auditTrail
  };
}

/**
 * Generate cryptographic bundle JSON object
 */
export function generateBundle(run: Run, events: RunEvent[], artifact?: DeliverableArtifact) {
  return {
    version: '1.0.0',
    spec: 'HELMER_FLIGHT_RECORD_BUNDLE',
    exportedAt: Date.now(),
    run: {
      id: run.id,
      goal: run.goal,
      status: run.status,
      provider: run.provider,
      model: run.model,
      contract: run.contract,
      budget: run.budget,
      driftScore: run.driftScore,
      workerTag: run.workerTag,
      createdAt: run.createdAt,
      finishedAt: run.finishedAt
    },
    headHash: events[events.length - 1]?.hash || '',
    eventCount: events.length,
    events,
    artifact: artifact || null
  };
}
