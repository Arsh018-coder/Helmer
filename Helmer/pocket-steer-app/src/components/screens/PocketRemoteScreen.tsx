/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useHelmer } from '../../lib/useHelmer';
import { 
  Pause, 
  Play, 
  AlertOctagon, 
  CornerDownRight, 
  Zap, 
  ChevronRight, 
  ShieldCheck, 
  Clock, 
  Radio, 
  Terminal,
  Activity,
  Layers,
  ChevronDown
} from 'lucide-react';
import { hapticLight, hapticMedium, hapticError } from '../../lib/haptics';

export const PocketRemoteScreen: React.FC = () => {
  const {
    activeRun,
    runs,
    setActiveRunId,
    togglePauseResume,
    setEstopConfirmOpen,
    setRedirectOpen,
    triggerChaos,
    setActiveTab,
    setDeliverableOpen
  } = useHelmer();

  const [chaosMode, setChaosMode] = useState<'fail' | 'slow' | 'corrupt'>('fail');
  const [isChaosLoading, setIsChaosLoading] = useState(false);
  const [showRunDropdown, setShowRunDropdown] = useState(false);

  if (!activeRun) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
        <Radio className="w-8 h-8 text-[#0E7C86] animate-pulse mb-3" />
        <p className="text-sm font-medium text-[#5B6B7A]">Awaiting active execution session...</p>
      </div>
    );
  }

  const isPaused = activeRun.status === 'paused';
  const isRunning = activeRun.status === 'running';
  const isStopped = activeRun.status === 'stopped';
  const isCompleted = activeRun.status === 'completed';

  const latestStep = activeRun.steps[activeRun.steps.length - 1];

  const handleChaosTrigger = async () => {
    setIsChaosLoading(true);
    await triggerChaos('search_web', chaosMode, activeRun.id);
    setTimeout(() => setIsChaosLoading(false), 1400);
  };

  return (
    <div className="flex flex-col gap-3.5 px-3.5 pt-2 pb-24 text-left animate-in fade-in duration-300">
      
      {/* 1. Protocol Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Logo badge with specular sheen */}
          <div className="w-8 h-8 rounded-xl glass-elevated flex items-center justify-center border border-white/90 shadow-xs">
            <Radio className="w-4 h-4 text-[#0E7C86]" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold tracking-tight text-[#0B1F3A]">
                POCKET STEER
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <span className="text-[10px] text-[#5B6B7A] font-mono tracking-tight">
              12ms Human Intercept Ready
            </span>
          </div>
        </div>

        {/* Run Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              hapticLight();
              setShowRunDropdown(prev => !prev);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-subtle border border-white/80 active:scale-95 transition-transform"
          >
            <span className="text-[11px] font-mono font-semibold text-[#0E7C86]">
              RUN: {activeRun.id}
            </span>
            <ChevronDown className="w-3 h-3 text-[#5B6B7A]" />
          </button>

          {showRunDropdown && (
            <div className="absolute right-0 top-8 w-56 rounded-2xl glass-elevated border border-white/90 shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95">
              <span className="block px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[#8A99A8]">
                Select Active Run
              </span>
              {runs.map(r => (
                <button
                  key={r.id}
                  onClick={() => {
                    hapticLight();
                    setActiveRunId(r.id);
                    setShowRunDropdown(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-mono flex items-center justify-between transition-colors ${
                    r.id === activeRun.id ? 'bg-[#0E7C86]/15 text-[#0E7C86] font-semibold' : 'hover:bg-black/5 text-[#0B1F3A]'
                  }`}
                >
                  <span className="truncate">{r.id} · {r.status}</span>
                  <span className="text-[10px] text-[#8A99A8]">{r.provider}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Goal Card (VisionOS frosted panel) */}
      <div className="glass-card rounded-[22px] p-4 relative overflow-hidden">
        {/* Subtle top specular border highlight */}
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent" />
        
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs text-[#5B6B7A]">
            <span className="font-semibold text-[#0E7C86]">Mission Goal</span>
            <span>·</span>
            <span className="font-mono text-[11px]">{activeRun.model}</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-700 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Contract Sealed</span>
          </div>
        </div>

        <p className="text-[14px] leading-snug font-semibold text-[#0B1F3A] mb-3">
          {activeRun.goal}
        </p>

        {/* Clean Unboxed Metadata */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5B6B7A] pt-2 border-t border-black/5">
          <span>{activeRun.budget.usedSteps}/{activeRun.budget.maxSteps} Steps</span>
          <span>·</span>
          <span>{activeRun.budget.usedSeconds}s / {activeRun.budget.maxSeconds}s</span>
          <span>·</span>
          <span className="text-[#0E7C86] font-medium font-mono">
            Drift: {activeRun.driftScore}/100 Nominal
          </span>
        </div>
      </div>

      {/* 3. Steer Giant Button Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Pause / Resume Button */}
        <button
          onClick={() => togglePauseResume(activeRun.id)}
          disabled={isStopped || isCompleted}
          className={`steer-btn-pause min-h-[76px] rounded-[22px] p-3.5 flex flex-col items-center justify-center gap-1.5 transition-all duration-150 active:scale-[0.97] group cursor-pointer ${
            isStopped || isCompleted ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-800 flex items-center justify-center group-hover:scale-110 transition-transform">
            {isPaused ? <Play className="w-4 h-4 fill-amber-800" /> : <Pause className="w-4 h-4" />}
          </div>
          <span className="text-[13px] font-bold tracking-tight text-amber-950">
            {isPaused ? '▶ Resume Run' : '⏸ Pause Run'}
          </span>
          <span className="text-[10px] text-amber-900/70 font-mono">
            {isPaused ? 'Clock Held' : 'Freeze Time Budget'}
          </span>
        </button>

        {/* E-STOP Button */}
        <button
          onClick={() => {
            hapticError();
            setEstopConfirmOpen(true);
          }}
          disabled={isStopped}
          className={`steer-btn-stop min-h-[76px] rounded-[22px] p-3.5 flex flex-col items-center justify-center gap-1.5 transition-all duration-150 active:scale-[0.97] group cursor-pointer ${
            isStopped ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-800 flex items-center justify-center group-hover:scale-110 transition-transform">
            <AlertOctagon className="w-4 h-4" />
          </div>
          <span className="text-[13px] font-bold tracking-tight text-red-950">
            {isStopped ? '⚡ E-STOPPED' : '🚨 E-STOP'}
          </span>
          <span className="text-[10px] text-red-900/70 font-mono">
            {isStopped ? 'Ledger Frozen' : '12ms Abort Kill'}
          </span>
        </button>
      </div>

      {/* 4. Redirect Button (Primary full-width pill) */}
      <button
        onClick={() => {
          hapticLight();
          setRedirectOpen(true);
        }}
        disabled={isStopped || isCompleted}
        className="w-full h-[50px] rounded-full steer-btn-teal text-white flex items-center justify-center gap-2 font-semibold text-[13px] tracking-tight transition-all active:scale-[0.98] specular-shine cursor-pointer disabled:opacity-50 shadow-md"
      >
        <CornerDownRight className="w-4 h-4 text-emerald-300" />
        <span>↳ Redirect Instruction</span>
      </button>

      {/* 5. Latest Step Card (Live telemetry snippet) */}
      <div className="glass-card rounded-[22px] p-4 relative text-left">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-800 border border-emerald-500/20">
              200 OK
            </span>
            <span className="text-[12px] font-semibold text-[#0B1F3A]">
              Step {latestStep?.seq || 1}: {latestStep?.title || 'Synthesizing Contract'}
            </span>
          </div>

          <span className="text-[10px] font-mono text-[#8A99A8]">
            {latestStep?.durationMs || 42}ms
          </span>
        </div>

        {/* Streaming Model Reasoning Snippet */}
        <div className="p-2.5 rounded-xl bg-black/[0.03] border border-black/5 font-mono text-[11px] leading-relaxed text-[#5B6B7A] mb-3">
          <span className="text-[#0E7C86] font-semibold mr-1">reasoning &gt;</span>
          {latestStep?.reasoningSnippet || 'Executing deterministic verification pipeline in isolated gVisor runtime...'}
        </div>

        <div className="flex items-center justify-between text-xs text-[#5B6B7A]">
          <span className="text-[11px] font-mono">
            Tool: <strong className="text-[#0B1F3A]">{latestStep?.tool || 'search_sec_edgar'}</strong>
          </span>
          <button
            onClick={() => {
              hapticLight();
              setActiveTab('telemetry');
            }}
            className="flex items-center gap-0.5 text-[#0E7C86] font-semibold hover:underline cursor-pointer"
          >
            <span>Telemetry Details</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 6. Chaos Injection Test Card */}
      <div className="glass-subtle rounded-[20px] p-3.5 border border-white/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B1F3A]">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Chaos Testing Injection</span>
          </div>
          <span className="text-[10px] font-mono text-[#8A99A8]">
            Self-Healing Demo
          </span>
        </div>

        <div className="flex items-center gap-2 mb-2.5">
          {(['fail', 'slow', 'corrupt'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => {
                hapticLight();
                setChaosMode(mode);
              }}
              className={`flex-1 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                chaosMode === mode
                  ? 'bg-amber-500/20 text-amber-900 border border-amber-500/30 font-semibold'
                  : 'bg-white/40 text-[#5B6B7A] hover:bg-white/70'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <button
          onClick={handleChaosTrigger}
          disabled={isChaosLoading || isStopped}
          className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 active:scale-95 text-amber-950 font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 border border-amber-500/20"
        >
          <Zap className="w-3.5 h-3.5 text-amber-600" />
          <span>
            {isChaosLoading ? 'Injecting Fault & Recovering...' : '⚡ Break search_web from Phone'}
          </span>
        </button>
      </div>

      {/* 7. Deliverable Shortcut if available */}
      {activeRun.artifact && (
        <div className="glass-card rounded-[20px] p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0E7C86]/15 flex items-center justify-center text-[#0E7C86]">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#0B1F3A] block">
                {activeRun.artifact.name}
              </span>
              <span className="text-[10px] text-[#5B6B7A] font-mono">
                ✓ {activeRun.artifact.wordCount} words · Verified
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              hapticLight();
              setDeliverableOpen(true);
            }}
            className="px-3 py-1.5 rounded-full bg-[#0E7C86] text-white text-xs font-semibold hover:bg-[#096169] active:scale-95 transition-all"
          >
            Read Briefing ↗
          </button>
        </div>
      )}
    </div>
  );
};
