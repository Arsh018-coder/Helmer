/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useHelmer } from '../../lib/useHelmer';
import { 
  ShieldCheck, 
  ShieldAlert, 
  UploadCloud, 
  Download, 
  FileCheck, 
  RefreshCw, 
  AlertTriangle,
  FileCode,
  Check,
  Hash
} from 'lucide-react';
import { verifyChain, generateBundle, ChainVerificationResult } from '../../lib/chain';
import { hapticLight, hapticSuccess, hapticError, hapticMedium } from '../../lib/haptics';

export const VerifyScreen: React.FC = () => {
  const { activeRun, tamperRunEvent, restoreRunChain } = useHelmer();

  const [pinnedHead, setPinnedHead] = useState<string>('');
  const [verificationResult, setVerificationResult] = useState<ChainVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [bundleLoadedName, setBundleLoadedName] = useState<string>('Live Session (Run ' + (activeRun?.id || '') + ')');

  const handleVerify = async () => {
    if (!activeRun) return;
    hapticMedium();
    setIsVerifying(true);
    setVerificationResult(null);

    setTimeout(async () => {
      const res = await verifyChain(activeRun.events, pinnedHead);
      setVerificationResult(res);
      setIsVerifying(false);
      if (res.intact) {
        hapticSuccess();
      } else {
        hapticError();
      }
    }, 450);
  };

  const handleExportBundle = () => {
    if (!activeRun) return;
    hapticSuccess();
    const bundle = generateBundle(activeRun, activeRun.events, activeRun.artifact);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `helmer-bundle-${activeRun.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSimulateTamper = async () => {
    if (!activeRun) return;
    await tamperRunEvent(activeRun.id, 2);
    // Auto-verify after tamper to show immediate detection
    setTimeout(handleVerify, 100);
  };

  const handleRestore = async () => {
    if (!activeRun) return;
    await restoreRunChain(activeRun.id);
    setTimeout(handleVerify, 100);
  };

  const latestHead = activeRun?.events[activeRun.events.length - 1]?.hash || '';

  return (
    <div className="flex flex-col gap-3.5 px-3.5 pt-2 pb-24 text-left animate-in fade-in duration-300">
      
      {/* 1. Header */}
      <div className="glass-card rounded-[22px] p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0E7C86]/15 flex items-center justify-center text-[#0E7C86]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[13px] font-bold text-[#0B1F3A] block">
                OFFLINE FLIGHT VERIFIER
              </span>
              <span className="text-[10px] text-[#5B6B7A] font-mono">
                Zero-Trust Cryptographic Engine
              </span>
            </div>
          </div>

          <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            Client-Side SHA-256
          </span>
        </div>

        <p className="text-[11px] text-[#5B6B7A] leading-relaxed">
          Verify mathematical integrity of the SHA-256 ordered ledger completely offline. Guarantees zero post-execution tampering.
        </p>
      </div>

      {/* 2. Bundle Source & Pinned Head */}
      <div className="glass-card rounded-[22px] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#0B1F3A]">
            Current Flight Bundle
          </span>
          <span className="text-[10px] font-mono text-[#0E7C86] font-medium">
            {activeRun?.events.length || 0} Events Chained
          </span>
        </div>

        <div className="p-3 rounded-xl bg-white/60 border border-black/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-[#0E7C86]" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-[#0B1F3A] truncate max-w-[200px]">
                {bundleLoadedName}
              </span>
              <span className="text-[10px] text-[#8A99A8] font-mono truncate max-w-[200px]">
                Head: {latestHead ? `${latestHead.slice(0, 16)}...` : 'None'}
              </span>
            </div>
          </div>

          <button
            onClick={handleExportBundle}
            className="px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 text-xs font-medium text-[#0B1F3A] flex items-center gap-1 transition-colors cursor-pointer"
            title="Download JSON Bundle"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>

        {/* Pinned Head Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-semibold text-[#0B1F3A] flex items-center gap-1">
              <Hash className="w-3 h-3 text-[#0E7C86]" />
              <span>Pinned Head Hash (Optional Attestation)</span>
            </label>
            <button
              onClick={() => {
                hapticLight();
                setPinnedHead(latestHead);
              }}
              className="text-[10px] text-[#0E7C86] font-mono hover:underline cursor-pointer"
            >
              Paste Current Head
            </button>
          </div>

          <input
            type="text"
            value={pinnedHead}
            onChange={e => setPinnedHead(e.target.value)}
            placeholder="64-char hex SHA-256 head hash..."
            className="w-full text-[11px] font-mono text-[#0B1F3A] bg-white/60 focus:bg-white border border-black/10 focus:border-[#0E7C86] rounded-xl px-2.5 py-2 outline-none transition-all placeholder:text-[#8A99A8]"
          />
        </div>

        {/* Action Button: Verify */}
        <button
          onClick={handleVerify}
          disabled={isVerifying}
          className="w-full h-11 rounded-full steer-btn-teal text-white flex items-center justify-center gap-1.5 font-bold text-xs tracking-tight transition-all active:scale-[0.98] specular-shine cursor-pointer shadow-md disabled:opacity-50"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{isVerifying ? 'Computing SHA-256 Merkle Links...' : 'Verify Cryptographic Chain'}</span>
        </button>
      </div>

      {/* 3. Verification Verdict Card */}
      {verificationResult && (
        <div
          className={`glass-card rounded-[22px] p-4 border animate-in zoom-in-95 duration-200 ${
            verificationResult.intact
              ? 'border-emerald-500/40 bg-emerald-500/[0.04]'
              : 'border-red-500/40 bg-red-500/[0.04]'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {verificationResult.intact ? (
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-700 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
            )}

            <div>
              <span
                className={`text-sm font-bold block ${
                  verificationResult.intact ? 'text-emerald-950' : 'text-red-950'
                }`}
              >
                {verificationResult.intact ? '✓ Chain Intact & Intact Ledger' : '✕ Chain Broken / Tampered'}
              </span>
              <span className="text-[11px] text-[#5B6B7A] font-mono">
                {verificationResult.totalEvents} sequential nodes validated
              </span>
            </div>
          </div>

          {verificationResult.intact ? (
            <div className="flex flex-col gap-1.5 text-xs text-emerald-900 mt-2 pt-2 border-t border-emerald-500/10">
              <div className="flex justify-between font-mono text-[11px]">
                <span>Validated Head:</span>
                <span className="font-bold">{verificationResult.calculatedHead.slice(0, 16)}...</span>
              </div>
              <p className="text-[11px] leading-relaxed text-emerald-900/80">
                Every transition, reasoning step, and tool result matches its parent SHA-256 hash. Zero data modifications occurred.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 text-xs text-red-900 mt-2 pt-2 border-t border-red-500/10">
              <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-red-700">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Broken at Seq #{verificationResult.brokenAtSeq}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-red-950/80 font-mono bg-red-500/10 p-2 rounded-lg">
                {verificationResult.brokenReason}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 4. Chaos Tampering Demonstration */}
      <div className="glass-subtle rounded-[20px] p-3.5 border border-white/80 flex flex-col gap-2">
        <span className="text-xs font-semibold text-[#0B1F3A]">
          Zero-Trust Tamper Demonstration
        </span>
        <p className="text-[11px] text-[#5B6B7A] leading-relaxed">
          Test mathematical proof of immutability. Mutate one byte in sequence #2 and watch the verifier instantly pinpoint the breach.
        </p>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            onClick={handleSimulateTamper}
            className="py-2 px-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 active:scale-95 text-red-950 font-medium text-[11px] font-mono flex items-center justify-center gap-1 transition-all cursor-pointer border border-red-500/20"
          >
            <span>🧪 Tamper Seq #2</span>
          </button>

          <button
            onClick={handleRestore}
            className="py-2 px-3 rounded-xl bg-[#0E7C86]/15 hover:bg-[#0E7C86]/25 active:scale-95 text-[#0E7C86] font-medium text-[11px] font-mono flex items-center justify-center gap-1 transition-all cursor-pointer border border-[#0E7C86]/20"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Restore Authentic</span>
          </button>
        </div>
      </div>
    </div>
  );
};
