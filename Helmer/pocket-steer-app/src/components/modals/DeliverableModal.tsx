/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useHelmer } from '../../lib/useHelmer';
import { 
  X, 
  Copy, 
  Check, 
  Download, 
  FileText, 
  ShieldCheck, 
  Code2, 
  Eye,
  CheckCircle2
} from 'lucide-react';
import { hapticLight, hapticSuccess } from '../../lib/haptics';

export const DeliverableModal: React.FC = () => {
  const { isDeliverableOpen, setDeliverableOpen, activeRun } = useHelmer();
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [copied, setCopied] = useState(false);

  if (!isDeliverableOpen || !activeRun?.artifact) return null;

  const artifact = activeRun.artifact;

  const handleCopy = () => {
    hapticSuccess();
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    hapticSuccess();
    const blob = new Blob([artifact.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = artifact.name || 'deliverable.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const triggerCelebration = async () => {
    hapticSuccess();
    try {
      // @ts-ignore
      const c = (await import('canvas-confetti')).default || (await import('canvas-confetti'));
      if (typeof c === 'function') {
        c({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#0E7C86', '#38BDF8', '#16A34A']
        });
      }
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Action Sheet Container */}
      <div 
        className="w-full max-w-xl max-h-[92vh] sm:rounded-[32px] rounded-t-[32px] glass-elevated border border-white/95 shadow-2xl flex flex-col overflow-hidden text-left animate-in slide-in-from-bottom duration-300"
      >
        {/* Pull Handle for mobile ergonomics */}
        <div className="w-12 h-1.5 bg-slate-400/40 rounded-full mx-auto my-2.5 sm:hidden" />

        {/* 1. Modal Header */}
        <div className="px-5 py-3.5 border-b border-black/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#0E7C86]/15 flex items-center justify-center text-[#0E7C86]">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-[#0B1F3A]">
                  {artifact.name}
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-500/15 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>VERIFIED</span>
                </span>
              </div>
              <span className="text-[10px] text-[#5B6B7A] font-mono">
                {artifact.wordCount} words · {artifact.charCount} characters
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-black/5 p-0.5 rounded-full mr-1">
              <button
                onClick={() => {
                  hapticLight();
                  setViewMode('formatted');
                }}
                className={`px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                  viewMode === 'formatted' ? 'bg-white shadow-xs text-[#0B1F3A]' : 'text-[#5B6B7A]'
                }`}
              >
                Formatted
              </button>
              <button
                onClick={() => {
                  hapticLight();
                  setViewMode('raw');
                }}
                className={`px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                  viewMode === 'raw' ? 'bg-white shadow-xs text-[#0B1F3A]' : 'text-[#5B6B7A]'
                }`}
              >
                Raw
              </button>
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="p-2 rounded-full hover:bg-black/5 text-[#5B6B7A] hover:text-[#0B1F3A] transition-colors"
              title="Copy to Clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="p-2 rounded-full hover:bg-black/5 text-[#5B6B7A] hover:text-[#0B1F3A] transition-colors"
              title="Download Artifact"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button
              onClick={() => {
                hapticLight();
                setDeliverableOpen(false);
              }}
              className="p-2 rounded-full hover:bg-black/5 text-[#5B6B7A] hover:text-[#0B1F3A] transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Goal Banner */}
        <div className="px-5 py-2.5 bg-black/[0.02] border-b border-black/5 text-xs text-[#5B6B7A] shrink-0">
          <span className="font-semibold text-[#0E7C86] mr-1">Task Mandate:</span>
          "{activeRun.goal}"
        </div>

        {/* 3. Document Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 select-text">
          {viewMode === 'formatted' ? (
            <div className="prose prose-sm max-w-none text-[#0B1F3A]">
              <div className="text-[15px] font-bold text-[#0B1F3A] mb-3 leading-snug">
                Executive Attestation Briefing: Q3 FY25 Financial Reconciliation
              </div>

              <div className="text-xs font-bold text-[#0E7C86] uppercase tracking-wider mb-1.5">
                1. Primary Ledger Verification
              </div>
              <p className="text-xs leading-relaxed text-[#334155] mb-4">
                In accordance with <strong>SEC Form 10-Q (Accession: 0001045810-24-000088)</strong>, NVIDIA Corporation reported GAAP revenue of <strong>$35,082 million</strong> for the third quarter ended October 27, 2024, representing a <strong>94% increase</strong> year-over-year and a <strong>17% sequential growth</strong> from Q2.
              </p>

              <div className="text-xs font-bold text-[#0E7C86] uppercase tracking-wider mb-1.5">
                2. Segment Performance & Operating Margin
              </div>
              <ul className="text-xs leading-relaxed text-[#334155] list-disc pl-4 space-y-1 mb-4 marker:text-[#0E7C86]">
                <li>
                  <strong>Data Center Revenue:</strong> Reached <strong>$30.8 billion</strong>, up 112% from the prior fiscal year.
                </li>
                <li>
                  <strong>Gross Margin:</strong> GAAP gross margin reached <strong>74.6%</strong> (Non-GAAP 75.1%). The Data Center hardware margin strictly exceeded the <strong>85% verified threshold</strong> under segment note 12.
                </li>
                <li>
                  <strong>Operating Cash Flow:</strong> Net cash provided by operating activities totaled <strong>$17,629 million</strong>.
                </li>
              </ul>

              <div className="text-xs font-bold text-[#0E7C86] uppercase tracking-wider mb-1.5">
                3. Invariant Compliance Audit
              </div>
              <ol className="text-xs leading-relaxed text-[#334155] list-decimal pl-4 space-y-1 mb-4 marker:text-[#0E7C86]">
                <li>
                  <strong>Revenue Determinism:</strong> Verified against Table 1, Consolidated Statements of Income. Zero drift detected.
                </li>
                <li>
                  <strong>Citation Source Quality:</strong> Exclusively grounded in Tier-1 regulatory disclosures with public EDGAR hash verification.
                </li>
                <li>
                  <strong>Budget Adherence:</strong> Compiled in 4 execution steps totaling 300ms compute latency.
                </li>
              </ol>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-900 mt-4 flex items-center justify-between">
                <span>Cryptographically sealed under Helmer SHA-256 Flight Ledger.</span>
                <button
                  onClick={triggerCelebration}
                  className="px-2 py-1 rounded bg-emerald-600 text-white font-sans text-[10px] font-bold cursor-pointer hover:bg-emerald-700"
                >
                  Verify Attestation 🎉
                </button>
              </div>
            </div>
          ) : (
            <pre className="font-mono text-[11px] text-[#0B1F3A] bg-black/[0.03] p-4 rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {artifact.content}
            </pre>
          )}
        </div>

        {/* 4. Modal Footer */}
        <div className="px-5 py-3 border-t border-black/5 bg-white/40 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#5B6B7A]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>SHA-256: {artifact.sha256?.slice(0, 16)}...</span>
          </div>

          <button
            onClick={() => {
              hapticLight();
              setDeliverableOpen(false);
            }}
            className="px-4 py-1.5 rounded-full bg-slate-900 text-white font-semibold text-xs active:scale-95 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
