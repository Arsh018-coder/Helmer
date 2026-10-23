/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useHelmer } from '../../lib/useHelmer';
import { Terminal, Cpu, Play, Shield, Sliders, CheckCircle2, Copy, Check } from 'lucide-react';
import { hapticLight, hapticSuccess } from '../../lib/haptics';

export const ConsoleScreen: React.FC = () => {
  const { launchNewRun, activeRun } = useHelmer();

  const [goal, setGoal] = useState('Q3 Financial Drift Reconciliation & EDGAR 10-Q Filing Attestation');
  const [provider, setProvider] = useState<'Groq' | 'Gemini' | 'OpenAI'>('Gemini');
  const [model, setModel] = useState('gemini-2.0-flash');
  
  // Budget sliders
  const [maxSteps, setMaxSteps] = useState(8);
  const [maxSeconds, setMaxSeconds] = useState(180);
  const [maxLlmCalls, setMaxLlmCalls] = useState(25);

  const [isLaunching, setIsLaunching] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'llm' | 'tool' | 'recorder' | 'pass'>('all');
  const [copiedLogs, setCopiedLogs] = useState(false);

  const suggestionPills = [
    'Q3 Financial Drift Reconciliation',
    'EDGAR 10-Q Filing Attestation',
    'Semiconductor Supply Audit (ASML)',
    'CRISPR Off-Target Safety Invariants'
  ];

  const handleProviderSelect = (p: 'Groq' | 'Gemini' | 'OpenAI') => {
    hapticLight();
    setProvider(p);
    if (p === 'Groq') setModel('qwen/qwen3.8-27b');
    else if (p === 'Gemini') setModel('gemini-2.0-flash');
    else setModel('gpt-4o-mini');
  };

  const handleLaunch = async () => {
    if (!goal.trim() || isLaunching) return;
    setIsLaunching(true);
    await launchNewRun(goal, provider, model, { maxSteps, maxSeconds, maxLlmCalls });
    setTimeout(() => setIsLaunching(false), 800);
  };

  // Generate logs from current active run events
  const logs = activeRun?.events || [];
  const filteredLogs = logs.filter(ev => {
    if (logFilter === 'all') return true;
    if (logFilter === 'llm') return ev.type === 'modelReasoning' || ev.type === 'runStarted';
    if (logFilter === 'tool') return ev.type === 'toolCall' || ev.type === 'toolResult' || ev.type === 'faultInjected';
    if (logFilter === 'recorder') return ev.type === 'contractDrafted' || ev.type === 'stepStarted';
    if (logFilter === 'pass') return ev.type === 'contractVerified' || ev.type === 'runFinished';
    return true;
  });

  const handleCopyLogs = () => {
    hapticLight();
    const text = filteredLogs
      .map(l => `[${new Date(l.ts).toISOString().slice(11, 19)}] [${l.type}] ${JSON.stringify(l.payload)}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3.5 px-3.5 pt-2 pb-24 text-left animate-in fade-in duration-300">
      
      {/* 1. Console Header */}
      <div className="glass-card rounded-[22px] p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0E7C86]/15 flex items-center justify-center text-[#0E7C86]">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[13px] font-bold text-[#0B1F3A] block">
                MISSION CONTROL
              </span>
              <span className="text-[10px] text-[#5B6B7A] font-mono">
                Deterministic Agent Sandbox
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>gVisor Isolated</span>
          </div>
        </div>

        <div className="text-[11px] text-[#5B6B7A] leading-relaxed">
          Configure deterministic bounds, LLM quota, and cryptographic recording invariants before tool dispatch.
        </div>
      </div>

      {/* 2. Goal Composer */}
      <div className="glass-card rounded-[22px] p-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-[#0B1F3A]">
            Autonomous Goal Contract
          </label>
          <span className="text-[10px] font-mono text-[#8A99A8]">
            {goal.length} chars
          </span>
        </div>

        <textarea
          rows={3}
          value={goal}
          onChange={e => setGoal(e.target.value)}
          placeholder="State the deterministic criteria and verification goal..."
          className="w-full text-xs font-medium text-[#0B1F3A] bg-white/60 focus:bg-white border border-black/10 focus:border-[#0E7C86] rounded-xl p-2.5 outline-none transition-all placeholder:text-[#8A99A8] resize-none"
        />

        {/* Suggestion Pills */}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {suggestionPills.map(pill => (
            <button
              key={pill}
              type="button"
              onClick={() => {
                hapticLight();
                setGoal(pill);
              }}
              className="text-[10px] px-2.5 py-1 rounded-full bg-white/50 hover:bg-white text-[#0B1F3A] border border-black/5 active:scale-95 transition-all cursor-pointer font-medium"
            >
              + {pill}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Provider & Model Selector */}
      <div className="glass-card rounded-[22px] p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#0B1F3A]">LLM Model Provider</span>
          <span className="text-[10px] font-mono text-[#0E7C86] font-medium">{model}</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/5">
          {(['Gemini', 'Groq', 'OpenAI'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => handleProviderSelect(p)}
              className={`py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                provider === p
                  ? 'bg-white shadow-xs text-[#0B1F3A] font-semibold'
                  : 'text-[#5B6B7A] hover:text-[#0B1F3A]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Budget Configuration Sliders */}
      <div className="glass-card rounded-[22px] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B1F3A]">
            <Sliders className="w-3.5 h-3.5 text-[#0E7C86]" />
            <span>Resource Bounds</span>
          </div>
          <span className="text-[10px] font-mono text-[#8A99A8]">Enforced strictly</span>
        </div>

        {/* Max Steps Slider */}
        <div>
          <div className="flex justify-between text-[11px] mb-1 font-mono">
            <span className="text-[#5B6B7A]">Max Steps</span>
            <span className="text-[#0B1F3A] font-semibold">{maxSteps} steps</span>
          </div>
          <input
            type="range"
            min={1}
            max={15}
            value={maxSteps}
            onChange={e => setMaxSteps(Number(e.target.value))}
            className="w-full accent-[#0E7C86] cursor-pointer"
          />
        </div>

        {/* Max Seconds Slider */}
        <div>
          <div className="flex justify-between text-[11px] mb-1 font-mono">
            <span className="text-[#5B6B7A]">Time Budget (Net)</span>
            <span className="text-[#0B1F3A] font-semibold">{maxSeconds}s</span>
          </div>
          <input
            type="range"
            min={30}
            max={300}
            step={15}
            value={maxSeconds}
            onChange={e => setMaxSeconds(Number(e.target.value))}
            className="w-full accent-[#0E7C86] cursor-pointer"
          />
        </div>

        {/* Max LLM Calls Slider */}
        <div>
          <div className="flex justify-between text-[11px] mb-1 font-mono">
            <span className="text-[#5B6B7A]">Max LLM Calls</span>
            <span className="text-[#0B1F3A] font-semibold">{maxLlmCalls} calls</span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            value={maxLlmCalls}
            onChange={e => setMaxLlmCalls(Number(e.target.value))}
            className="w-full accent-[#0E7C86] cursor-pointer"
          />
        </div>
      </div>

      {/* 5. Launch Autonomous Run CTA */}
      <button
        onClick={handleLaunch}
        disabled={isLaunching || !goal.trim()}
        className="w-full h-[52px] rounded-full steer-btn-teal text-white flex items-center justify-center gap-2 font-bold text-sm tracking-tight transition-all active:scale-[0.98] specular-shine cursor-pointer shadow-lg disabled:opacity-50"
      >
        <Play className="w-4 h-4 fill-white" />
        <span>{isLaunching ? 'Dispatching Invariants...' : 'Launch Autonomous Run →'}</span>
      </button>

      {/* 6. Monospace Terminal Log Stream */}
      <div className="glass-card rounded-[22px] p-3.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B1F3A]">
            <Terminal className="w-3.5 h-3.5 text-[#0E7C86]" />
            <span>Terminal Log Stream</span>
          </div>

          <button
            onClick={handleCopyLogs}
            className="text-[10px] font-mono text-[#5B6B7A] hover:text-[#0B1F3A] flex items-center gap-1 cursor-pointer"
          >
            {copiedLogs ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Log Level Filters */}
        <div className="flex items-center gap-1 mb-2.5 overflow-x-auto pb-0.5">
          {(['all', 'llm', 'tool', 'recorder', 'pass'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                hapticLight();
                setLogFilter(tab);
              }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase transition-all cursor-pointer ${
                logFilter === tab
                  ? 'bg-[#0E7C86] text-white font-semibold'
                  : 'bg-white/40 text-[#5B6B7A] hover:bg-white/80'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Monospace Log Viewer */}
        <div className="h-44 overflow-y-auto rounded-xl bg-black/[0.04] p-2.5 font-mono text-[10px] text-[#0B1F3A] flex flex-col gap-1.5 border border-black/5 select-text">
          {filteredLogs.length === 0 ? (
            <span className="text-[#8A99A8] italic">No events matching filter.</span>
          ) : (
            filteredLogs.map(ev => (
              <div key={ev.seq} className="leading-snug">
                <span className="text-[#8A99A8] mr-1">
                  [{new Date(ev.ts).toISOString().slice(11, 19)}]
                </span>
                <span className="text-[#0E7C86] font-semibold mr-1">
                  #{ev.seq} {ev.type}
                </span>
                <span className="text-[#5B6B7A]">
                  {JSON.stringify(ev.payload).slice(0, 80)}...
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
