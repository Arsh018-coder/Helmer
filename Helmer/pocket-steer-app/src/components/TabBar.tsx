/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useHelmer } from '../lib/useHelmer';
import { Radio, Terminal, Activity, ShieldCheck, KeyRound } from 'lucide-react';
import { hapticLight } from '../lib/haptics';

export const TabBar: React.FC = () => {
  const { activeTab, setActiveTab } = useHelmer();

  const tabs = [
    { id: 'steer', label: 'Steer', icon: Radio },
    { id: 'console', label: 'Console', icon: Terminal },
    { id: 'telemetry', label: 'Telemetry', icon: Activity },
    { id: 'verify', label: 'Verify', icon: ShieldCheck },
    { id: 'vault', label: 'Vault', icon: KeyRound }
  ] as const;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 px-3 pb-4 pt-2">
      <nav 
        className="w-full max-w-[390px] mx-auto h-[62px] rounded-full glass-elevated border border-white/90 shadow-[0_20px_40px_-10px_rgba(11,31,58,0.18),_inset_0_1.5px_2px_#FFFFFF] grid grid-cols-5 items-center px-1"
      >
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => {
                hapticLight();
                setActiveTab(tab.id);
              }}
              className="relative flex flex-col items-center justify-center h-full min-h-[44px] min-w-[44px] group transition-all duration-200 active:scale-95"
              aria-label={tab.label}
            >
              {/* Active Ambient Pill Indicator */}
              {isActive && (
                <div 
                  className="absolute inset-x-1.5 inset-y-1 bg-[#0E7C86]/12 rounded-full -z-10 border border-[#0E7C86]/20 transition-all duration-300"
                />
              )}

              <Icon
                className={`w-[20px] h-[20px] transition-all duration-200 ${
                  isActive
                    ? 'text-[#0E7C86] stroke-[2.4] scale-105'
                    : 'text-[#5B6B7A] stroke-[1.8] group-hover:text-[#0B1F3A]'
                }`}
              />

              <span
                className={`text-[10px] font-medium tracking-tight mt-0.5 transition-colors duration-200 ${
                  isActive ? 'text-[#0E7C86] font-semibold' : 'text-[#8A99A8]'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
