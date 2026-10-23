/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useHelmer } from '../lib/useHelmer';
import { DynamicIsland } from './DynamicIsland';
import { Wifi, Battery, Smartphone, Maximize2, Volume2, VolumeX, QrCode } from 'lucide-react';
import { hapticLight } from '../lib/haptics';

interface MobileFrameProps {
  children: React.ReactNode;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({ children }) => {
  const {
    deviceMode,
    setDeviceMode,
    soundEnabled,
    toggleSound,
    setQrOpen,
    activeRun,
    isLiveConnected
  } = useHelmer();

  const [currentTime, setCurrentTime] = useState('9:41');
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsMobileDevice(window.innerWidth < 640 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent));
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours % 12 || 12}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const showFrame = deviceMode === 'frame' && !isMobileDevice;

  return (
    <div className={`min-h-screen w-full flex flex-col items-center justify-start transition-all duration-300 ${isMobileDevice ? 'p-0 pb-16' : 'p-2 sm:p-4 md:p-6'}`}>
      {/* Top Floating Utility Control Bar (Hidden or Compact on real mobile) */}
      {!isMobileDevice && (
        <div className="w-full max-w-4xl flex items-center justify-between mb-3 px-2 py-1.5 glass-subtle rounded-full text-xs text-[#0B1F3A]/70">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-[#0B1F3A]">
              <span className={`w-2 h-2 rounded-full ${isLiveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-[#0E7C86]'}`} />
              <span className="tracking-tight">HELMER</span>
            </div>
            <span className="hidden sm:inline text-[#8A99A8]">·</span>
            <span className="hidden sm:inline font-mono text-[11px] text-[#5B6B7A]">
              {isLiveConnected ? '⚡ Live Connected (12ms)' : 'VisionOS Frosted Simulator'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Connection Badge */}
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium flex items-center gap-1 ${isLiveConnected ? 'bg-emerald-500/10 text-emerald-800 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-800'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLiveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{isLiveConnected ? 'LIVE SYNC' : 'OFFLINE'}</span>
            </div>

            {/* Audio / Haptic Toggle */}
            <button
              onClick={() => {
                hapticLight();
                toggleSound();
              }}
              className="px-2.5 py-1 rounded-full bg-white/50 hover:bg-white/80 active:scale-95 transition-all flex items-center gap-1 font-medium text-[11px] text-[#0B1F3A]"
              title={soundEnabled ? 'Mute Haptics & Audio' : 'Enable Haptics & Audio'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-[#0E7C86]" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
              <span className="hidden sm:inline">{soundEnabled ? 'Haptics ON' : 'Muted'}</span>
            </button>

            {/* QR Pairing Trigger */}
            <button
              onClick={() => {
                hapticLight();
                setQrOpen(true);
              }}
              className="px-2.5 py-1 rounded-full bg-white/50 hover:bg-white/80 active:scale-95 transition-all flex items-center gap-1 font-medium text-[11px] text-[#0B1F3A]"
              title="Scan QR Code / Pocket Pair"
            >
              <QrCode className="w-3.5 h-3.5 text-[#0E7C86]" />
              <span className="hidden sm:inline">Pair Phone</span>
            </button>

            {/* Device Frame View Switcher */}
            <div className="flex items-center bg-white/40 p-0.5 rounded-full border border-white/60">
              <button
                onClick={() => {
                  hapticLight();
                  setDeviceMode('frame');
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${
                  deviceMode === 'frame'
                    ? 'bg-white shadow-xs text-[#0B1F3A]'
                    : 'text-[#5B6B7A] hover:text-[#0B1F3A]'
                }`}
              >
                <Smartphone className="w-3 h-3" />
                <span className="hidden sm:inline">iPhone 16</span>
              </button>
              <button
                onClick={() => {
                  hapticLight();
                  setDeviceMode('canvas');
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${
                  deviceMode === 'canvas'
                    ? 'bg-white shadow-xs text-[#0B1F3A]'
                    : 'text-[#5B6B7A] hover:text-[#0B1F3A]'
                }`}
              >
                <Maximize2 className="w-3 h-3" />
                <span className="hidden sm:inline">Edge-to-Edge</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container: Frame Mode (Desktop Mockup) vs Native Mobile Edge-to-Edge */}
      {showFrame ? (
        // Authentic iPhone 16 Pro Glass Shell Mockup (Desktop view)
        <div className="relative w-full max-w-[412px] h-[874px] rounded-[54px] p-[11px] bg-gradient-to-b from-[#e3e8f0] via-[#cbd5e1] to-[#94a3b8] shadow-[0_35px_80px_-15px_rgba(11,31,58,0.3),_inset_0_1px_3px_rgba(255,255,255,0.9),_inset_0_-2px_4px_rgba(11,31,58,0.2)] border border-white/80 transition-all duration-300">
          {/* Inner Titanium Bezel */}
          <div className="relative w-full h-full rounded-[45px] overflow-hidden bg-[#F5F7FB] border-[3px] border-slate-900/10 shadow-[inset_0_0_10px_rgba(0,0,0,0.06)] flex flex-col">
            
            {/* Top iOS Status Bar with Dynamic Island */}
            <div className="relative pt-3 px-7 pb-1 flex items-center justify-between shrink-0 select-none pointer-events-auto z-40 bg-transparent">
              <span className="text-[13px] font-semibold text-[#0B1F3A] tracking-tight w-12 text-left">
                {currentTime}
              </span>

              {/* Centered Dynamic Island */}
              <div className="absolute left-1/2 -translate-x-1/2 top-2.5">
                <DynamicIsland />
              </div>

              {/* Status Icons: 5G, Wi-Fi, Battery */}
              <div className="flex items-center gap-1.5 text-[#0B1F3A] w-14 justify-end">
                <span className="text-[10px] font-bold tracking-tight">5G</span>
                <Wifi className="w-3.5 h-3.5 stroke-[2.2]" />
                <div className="flex items-center gap-0.5">
                  <div className="w-[18px] h-[9px] border-[1.2px] border-[#0B1F3A] rounded-[3px] p-[1px] flex items-center">
                    <div className="h-full w-[85%] bg-[#0B1F3A] rounded-[1.5px]" />
                  </div>
                  <div className="w-[1.2px] h-[3.5px] bg-[#0B1F3A] rounded-r-xs" />
                </div>
              </div>
            </div>

            {/* Scrollable Viewport Body */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col pb-20 pt-1">
              {children}
            </div>

            {/* Apple Home Indicator Bar */}
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-36 h-1 bg-[#0B1F3A]/30 rounded-full pointer-events-none z-50" />
          </div>
        </div>
      ) : (
        // Native Edge-to-Edge Responsive Mode (Real Phone or Canvas Mode)
        <div className={`w-full ${isMobileDevice ? 'max-w-md min-h-screen px-2 pt-2' : 'max-w-4xl min-h-[820px] rounded-3xl glass-surface p-4 sm:p-6'} relative flex flex-col overflow-hidden`}>
          {/* Top Dynamic Island on real phone */}
          <div className="w-full flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${isLiveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-[11px] font-bold text-[#0B1F3A]">HELMER STEER</span>
            </div>
            <DynamicIsland />
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${isLiveConnected ? 'bg-emerald-500/15 text-emerald-800' : 'bg-amber-500/15 text-amber-800'}`}>
              {isLiveConnected ? 'SYNCED' : 'DEMO'}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pb-20">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};
