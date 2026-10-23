/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useHelmer } from '../../lib/useHelmer';
import { AlertOctagon, X, Zap } from 'lucide-react';
import { hapticError, hapticLight } from '../../lib/haptics';

export const EstopModal: React.FC = () => {
  const { isEstopConfirmOpen, setEstopConfirmOpen, triggerEstop, activeRun } = useHelmer();

  if (!isEstopConfirmOpen || !activeRun) return null;

  const handleConfirmEstop = async () => {
    hapticError();
    await triggerEstop(activeRun.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-[32px] glass-elevated border border-red-500/30 shadow-2xl p-6 flex flex-col gap-4 text-center animate-in zoom-in-95 duration-200">
        
        <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-600 flex items-center justify-center mx-auto border border-red-500/30">
          <AlertOctagon className="w-8 h-8 animate-pulse" />
        </div>

        <div>
          <span className="text-[17px] font-bold text-red-950 block">
            Execute Emergency Stop?
          </span>
          <span className="text-xs text-[#5B6B7A] mt-1 block">
            This issues a hardware kill-switch to worker <strong className="font-mono text-[#0B1F3A]">{activeRun.workerTag}</strong> in under 12ms. Time budget and tools are permanently frozen.
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] font-mono text-red-900 text-left">
          • Halts LLM token streaming<br/>
          • Closes open browser tools<br/>
          • Seals immutable ledger with E_STOPPED verdict
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-1">
          <button
            onClick={() => {
              hapticLight();
              setEstopConfirmOpen(false);
            }}
            className="py-3 rounded-full bg-white/60 hover:bg-white text-xs font-semibold text-[#0B1F3A] transition-colors cursor-pointer border border-black/5"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirmEstop}
            className="py-3 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-xs font-bold text-white transition-transform cursor-pointer shadow-lg shadow-red-600/30 flex items-center justify-center gap-1.5"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>Kill Run (12ms)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
