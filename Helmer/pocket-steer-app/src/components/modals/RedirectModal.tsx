/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useHelmer } from '../../lib/useHelmer';
import { X, CornerDownRight, Compass, ShieldAlert, Sparkles } from 'lucide-react';
import { hapticLight, hapticSuccess } from '../../lib/haptics';

export const RedirectModal: React.FC = () => {
  const { isRedirectOpen, setRedirectOpen, submitRedirect, activeRun } = useHelmer();
  const [instruction, setInstruction] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isRedirectOpen || !activeRun) return null;

  const suggestionChips = [
    'Focus specifically on gross margin reconciliation in note 12',
    'Disregard unverified forum commentary and secondary leaks',
    'Enforce maximum 250 words deliverable conciseness'
  ];

  const handleSubmit = async () => {
    if (!instruction.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await submitRedirect(instruction, activeRun.id);
    setInstruction('');
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg sm:rounded-[32px] rounded-t-[32px] glass-elevated border border-white/95 shadow-2xl p-5 flex flex-col gap-3.5 text-left animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-black/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#0E7C86]/15 flex items-center justify-center text-[#0E7C86]">
              <CornerDownRight className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[14px] font-bold text-[#0B1F3A] block">
                Inject Steering Directive
              </span>
              <span className="text-[10px] text-[#5B6B7A] font-mono">
                Intercepts Next Tool Loop · Run {activeRun.id}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              hapticLight();
              setRedirectOpen(false);
            }}
            className="p-1.5 rounded-full hover:bg-black/5 text-[#5B6B7A] hover:text-[#0B1F3A]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input Textarea */}
        <div>
          <label className="text-xs font-semibold text-[#0B1F3A] block mb-1">
            Steering Instruction
          </label>
          <textarea
            rows={3}
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            placeholder="Type steering constraint or pivot instruction for the agent..."
            className="w-full text-xs font-medium text-[#0B1F3A] bg-white/70 focus:bg-white border border-black/10 focus:border-[#0E7C86] rounded-xl p-3 outline-none transition-all placeholder:text-[#8A99A8] resize-none"
          />
        </div>

        {/* Suggestions */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A99A8]">
            Quick Directive Presets
          </span>
          <div className="flex flex-col gap-1">
            {suggestionChips.map(chip => (
              <button
                key={chip}
                onClick={() => {
                  hapticLight();
                  setInstruction(chip);
                }}
                className="text-left text-xs p-2 rounded-xl bg-white/40 hover:bg-white text-[#0B1F3A] border border-black/5 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3 h-3 text-[#0E7C86] shrink-0" />
                <span className="truncate">{chip}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!instruction.trim() || isSubmitting}
          className="w-full h-12 rounded-full steer-btn-teal text-white flex items-center justify-center gap-2 font-bold text-xs tracking-tight transition-all active:scale-[0.98] specular-shine cursor-pointer shadow-md disabled:opacity-50 mt-1"
        >
          <CornerDownRight className="w-4 h-4" />
          <span>{isSubmitting ? 'Transmitting Directive...' : 'Inject Steering Directive'}</span>
        </button>
      </div>
    </div>
  );
};
