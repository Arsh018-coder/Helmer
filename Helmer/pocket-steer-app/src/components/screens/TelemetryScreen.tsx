/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useHelmer } from '../../lib/useHelmer';
import { 
  ShieldCheck, 
  Activity, 
  Clock, 
  FileText, 
  Maximize2, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { hapticLight, hapticSuccess } from '../../lib/haptics';

export const TelemetryScreen: React.FC = () => {
  const { activeRun, setDeliverableOpen } = useHelmer();
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  if (!activeRun) {
    return (
      <div className="p-8 text-center text-[#5B6B7A]">
        No run telemetry loaded.
      </div>
    );
  }

  const toggleStep = (seq: number) => {
    hapticLight();
    setExpandedStep(prev => (prev === seq ? null : seq));
  };

  const handleDownload = () => {
    if (!activeRun.artifact) return;
    hapticSuccess();
    const blob = new Blob([activeRun.artifact.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeRun.artifact.name || 'deliverable.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3.5 px-3.5 pt-2 pb-24 text-left animate-in fade-in duration-300">
      
      {/* 1. Header & Drift Meter */}
      <div className="glass-card rounded-[22px] p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-[#0E7C86]" />
            <span className="text-[13px] font-bold text-[#0B1F3A]">
              RUNTIME TELEMETRY
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-800 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <span>NOMINAL · {activeRun.driftScore}/100</span>
          </div>
        </div>

        {/* Drift Alignment Sparkline */}
        <div className="mt-2 pt-2 border-t border-black/5">
          <div className="flex items-center justify-between text-[11px] text-[#5B6B7A] mb-1">
            <span>Task Drift Alignment Sparkline</span>
            <span className="font-mono text-[#0E7C86]">Zero Deviation</span>
          </div>
          
          <div className="h-10 w-full flex items-end gap-1.5 pt-2">
            {[98, 96, 97, 95, 96, 94, 96, 95, 97, 96].map((val, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-[#0E7C86]/60 rounded-xs transition-all duration-300 hover:bg-[#0E7C86]"
                  style={{ height: `${(val - 80) * 4}px` }}
                  title={`Step ${idx + 1}: ${val}%`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Intent Contract Card (Deterministic vs Qualitative Criteria) */}
      <div className="glass-card rounded-[22px] p-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B1F3A]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Binding Intent Contract</span>
          </div>
          <span className="text-[10px] font-mono text-[#8A99A8]">
            SHA-256 Invariant Sealed
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {activeRun.contract.deterministicCriteria.map(crit => (
            <div
              key={crit.id}
              className="p-2.5 rounded-xl bg-white/50 border border-black/5 flex flex-col gap-1"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[12px] font-medium text-[#0B1F3A] leading-tight">
                  {crit.description}
                </span>
                <span className="shrink-0 flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-500/15 px-1.5 py-0.5 rounded-md">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>PASS</span>
                </span>
              </div>
              {crit.evidence && (
                <div className="text-[11px] text-[#5B6B7A] font-mono bg-black/[0.02] p-1.5 rounded-lg border border-black/5 mt-0.5">
                  <span className="text-[#0E7C86] font-semibold">evidence:</span> "{crit.evidence}"
                </div>
              )}
            </div>
          ))}

          {activeRun.contract.qualitativeCriteria.map(crit => (
            <div
              key={crit.id}
              className="p-2.5 rounded-xl bg-white/50 border border-black/5 flex flex-col gap-1"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[12px] font-medium text-[#0B1F3A] leading-tight">
                  {crit.description}
                </span>
                <span className="shrink-0 flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-500/15 px-1.5 py-0.5 rounded-md">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>PASS</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Resource Budget Bars */}
      <div className="glass-card rounded-[22px] p-4 flex flex-col gap-3">
        <span className="text-xs font-semibold text-[#0B1F3A]">
          Resource Budget Meter
        </span>

        {/* Steps Budget */}
        <div>
          <div className="flex justify-between text-[11px] mb-1 font-mono">
            <span className="text-[#5B6B7A]">Steps Executed</span>
            <span className="text-[#0B1F3A] font-semibold">
              {activeRun.budget.usedSteps} / {activeRun.budget.maxSteps}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-black/5 overflow-hidden">
            <div
              className="h-full bg-[#0E7C86] rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (activeRun.budget.usedSteps / activeRun.budget.maxSteps) * 100)}%` }}
            />
          </div>
        </div>

        {/* Seconds Budget (Frozen during pause) */}
        <div>
          <div className="flex justify-between text-[11px] mb-1 font-mono">
            <span className="text-[#5B6B7A]">
              Net Active Seconds {activeRun.status === 'paused' ? '(PAUSED)' : ''}
            </span>
            <span className="text-[#0B1F3A] font-semibold">
              {activeRun.budget.usedSeconds}s / {activeRun.budget.maxSeconds}s
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-black/5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                activeRun.status === 'paused' ? 'bg-amber-500' : 'bg-[#0E7C86]'
              }`}
              style={{ width: `${Math.min(100, (activeRun.budget.usedSeconds / activeRun.budget.maxSeconds) * 100)}%` }}
            />
          </div>
        </div>

        {/* LLM Calls */}
        <div>
          <div className="flex justify-between text-[11px] mb-1 font-mono">
            <span className="text-[#5B6B7A]">LLM Invocations</span>
            <span className="text-[#0B1F3A] font-semibold">
              {activeRun.budget.usedLlmCalls} / {activeRun.budget.maxLlmCalls}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-black/5 overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (activeRun.budget.usedLlmCalls / activeRun.budget.maxLlmCalls) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4. Step Timeline (Accordion with JSON Inspector) */}
      <div className="glass-card rounded-[22px] p-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-semibold text-[#0B1F3A]">
            Cryptographic Step Timeline ({activeRun.steps.length})
          </span>
          <span className="text-[10px] font-mono text-[#8A99A8]">Tap to inspect payload</span>
        </div>

        <div className="flex flex-col gap-2">
          {activeRun.steps.map(step => {
            const isExpanded = expandedStep === step.seq;
            return (
              <div
                key={step.seq}
                className="rounded-xl border border-black/5 bg-white/40 overflow-hidden transition-all duration-200"
              >
                <div
                  onClick={() => toggleStep(step.seq)}
                  className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-white/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-[#0E7C86]/10 text-[#0E7C86] font-mono text-[10px] font-bold flex items-center justify-center">
                      {step.seq}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[12px] font-semibold text-[#0B1F3A] leading-tight">
                        {step.title}
                      </span>
                      <span className="text-[10px] text-[#5B6B7A] font-mono">
                        {step.tool} · {step.durationMs}ms
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      200 OK
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-[#5B6B7A]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-[#5B6B7A]" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-2.5 pt-0 border-t border-black/5 text-[11px] font-mono flex flex-col gap-2 bg-white/80 animate-in fade-in">
                    <div className="text-[#5B6B7A] italic mt-2">
                      "{step.reasoningSnippet}"
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8A99A8] block mb-0.5">
                        Input Payload
                      </span>
                      <pre className="p-2 rounded bg-black/[0.04] text-[10px] text-[#0B1F3A] overflow-x-auto">
                        {JSON.stringify(step.inputPayload, null, 2)}
                      </pre>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8A99A8] block mb-0.5">
                        Output Payload
                      </span>
                      <pre className="p-2 rounded bg-black/[0.04] text-[10px] text-[#0B1F3A] overflow-x-auto">
                        {JSON.stringify(step.outputPayload, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Deliverable Preview Card (briefing.md) */}
      {activeRun.artifact && (
        <div className="glass-card rounded-[22px] p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#0E7C86]" />
              <span className="text-xs font-semibold text-[#0B1F3A]">
                {activeRun.artifact.name}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDownload}
                className="p-1.5 rounded-lg bg-white/50 hover:bg-white text-[#5B6B7A] hover:text-[#0B1F3A] transition-all cursor-pointer"
                title="Download Deliverable"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  hapticLight();
                  setDeliverableOpen(true);
                }}
                className="p-1.5 rounded-lg bg-white/50 hover:bg-white text-[#5B6B7A] hover:text-[#0B1F3A] transition-all cursor-pointer"
                title="Maximize Deliverable"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-[#5B6B7A] font-mono">
            <span className="text-emerald-700 font-bold">✓ VERIFIED DELIVERABLE</span>
            <span>·</span>
            <span>{activeRun.artifact.wordCount} words</span>
            <span>·</span>
            <span>{activeRun.artifact.charCount} characters</span>
          </div>

          {/* Capped Preview Box (maxHeight: 220px) */}
          <div className="max-h-[220px] overflow-hidden rounded-xl bg-white/60 p-3 border border-black/5 text-xs text-[#0B1F3A] leading-relaxed relative">
            <div className="font-semibold text-xs mb-1">
              Executive Attestation Briefing: Q3 FY25 Financial Reconciliation
            </div>
            <p className="text-[11px] text-[#5B6B7A] line-clamp-4">
              {activeRun.artifact.content.slice(0, 320)}...
            </p>
            {/* Fade out bottom overlay */}
            <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white/95 to-transparent flex items-end justify-center pb-2">
              <button
                onClick={() => {
                  hapticLight();
                  setDeliverableOpen(true);
                }}
                className="text-[11px] font-semibold text-[#0E7C86] flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span>Open Full View ↗</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
