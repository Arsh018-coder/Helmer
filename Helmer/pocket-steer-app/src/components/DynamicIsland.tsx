/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useHelmer } from '../lib/useHelmer';
import { Activity, Pause, Play, AlertOctagon, ShieldCheck } from 'lucide-react';
import { hapticLight } from '../lib/haptics';

export const DynamicIsland: React.FC = () => {
  const { activeRun, togglePauseResume, setEstopConfirmOpen } = useHelmer();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!activeRun) return null;

  const isPaused = activeRun.status === 'paused';
  const isRunning = activeRun.status === 'running';
  const isStopped = activeRun.status === 'stopped';

  return (
    <div className="relative flex justify-center z-50 pointer-events-auto">
      <div
        onClick={() => {
          hapticLight();
          setIsExpanded(prev => !prev);
        }}
        className={`bg-black text-white rounded-full transition-all duration-300 ease-out cursor-pointer shadow-lg shadow-black/25 flex items-center justify-between border border-white/10 ${
          isExpanded
            ? 'w-[320px] h-[58px] px-4 py-2'
            : 'w-[124px] h-[34px] px-3 py-1'
        }`}
      >
        {!isExpanded ? (
          // Compact Dynamic Island Pill
          <>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isRunning
                    ? 'bg-emerald-400 animate-pulse'
                    : isPaused
                    ? 'bg-amber-400'
                    : 'bg-red-400'
                }`}
              />
              <span className="text-[11px] font-mono tracking-tight font-medium">
                {activeRun.id.slice(0, 6)}
              </span>
            </div>

            <div className="flex items-center gap-1 text-[11px] text-white/70 font-mono">
              <Activity className="w-3 h-3 text-[#0E7C86] animate-spin" style={{ animationDuration: '4s' }} />
              <span>{activeRun.driftScore}%</span>
            </div>
          </>
        ) : (
          // Expanded Dynamic Island
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  isRunning
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : isPaused
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {isRunning ? (
                  <Activity className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
                ) : isPaused ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <AlertOctagon className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[12px] font-semibold text-white truncate max-w-[140px]">
                  {activeRun.status.toUpperCase()} · RUN {activeRun.id}
                </span>
                <span className="text-[10px] text-white/60 font-mono">
                  {activeRun.budget.usedSeconds}s / {activeRun.budget.maxSeconds}s · Net
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => togglePauseResume(activeRun.id)}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 flex items-center justify-center text-white transition-transform"
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? <Play className="w-3.5 h-3.5 fill-white" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setEstopConfirmOpen(true)}
                className="w-8 h-8 rounded-full bg-red-600/80 hover:bg-red-600 active:scale-95 flex items-center justify-center text-white transition-transform"
                title="E-STOP"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
