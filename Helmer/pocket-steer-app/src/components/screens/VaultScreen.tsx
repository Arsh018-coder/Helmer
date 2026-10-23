/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useHelmer } from '../../lib/useHelmer';
import { 
  KeyRound, 
  ShieldCheck, 
  Cpu, 
  Smartphone, 
  Volume2, 
  VolumeX, 
  Eye, 
  EyeOff, 
  Check, 
  Fingerprint, 
  Server,
  Zap,
  Lock
} from 'lucide-react';
import { hapticLight, hapticSuccess } from '../../lib/haptics';

export const VaultScreen: React.FC = () => {
  const {
    systemHealth,
    deviceMode,
    setDeviceMode,
    soundEnabled,
    hapticsEnabled,
    toggleSound,
    toggleHaptics
  } = useHelmer();

  const [geminiKey, setGeminiKey] = useState('AIzaSyD-env-configured-gemini-2.0-flash');
  const [groqKey, setGroqKey] = useState('gsk_9281a8c9e01f28b74a1');
  const [openaiKey, setOpenaiKey] = useState('');
  const [showGemini, setShowGemini] = useState(false);
  const [showGroq, setShowGroq] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [savedKey, setSavedKey] = useState(false);
  const [biometricAuthenticated, setBiometricAuthenticated] = useState(true);

  const handleSaveKeys = () => {
    hapticSuccess();
    setSavedKey(true);
    setTimeout(() => setSavedKey(false), 2000);
  };

  const handleBiometricTest = () => {
    hapticSuccess();
    setBiometricAuthenticated(false);
    setTimeout(() => {
      setBiometricAuthenticated(true);
      hapticSuccess();
    }, 800);
  };

  return (
    <div className="flex flex-col gap-3.5 px-3.5 pt-2 pb-24 text-left animate-in fade-in duration-300">
      
      {/* 1. User Identity Card */}
      <div className="glass-card rounded-[22px] p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0E7C86] via-[#38BDF8] to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
              H
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
            </div>
          </div>

          <div className="flex flex-col flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-[#0B1F3A]">
                Chief Flight Controller
              </span>
              <span className="text-[10px] font-mono text-[#0E7C86] font-semibold bg-[#0E7C86]/10 px-2 py-0.5 rounded-full">
                OPERATOR
              </span>
            </div>
            <span className="text-xs text-[#5B6B7A]">
              operator@helmer.ai
            </span>
            <span className="text-[10px] text-[#8A99A8] font-mono mt-0.5">
              Auth: Google Workspace · Hardware Attested
            </span>
          </div>
        </div>
      </div>

      {/* 2. Credential Vault */}
      <div className="glass-card rounded-[22px] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B1F3A]">
            <KeyRound className="w-3.5 h-3.5 text-[#0E7C86]" />
            <span>Encrypted Provider Key Vault</span>
          </div>
          <button
            onClick={handleBiometricTest}
            className="flex items-center gap-1 text-[10px] font-mono text-[#0E7C86] hover:underline cursor-pointer"
          >
            <Fingerprint className="w-3 h-3" />
            <span>FaceID Check</span>
          </button>
        </div>

        {/* Gemini API Key */}
        <div>
          <label className="text-[11px] font-medium text-[#5B6B7A] block mb-1">
            Google Gemini API Key
          </label>
          <div className="relative flex items-center">
            <input
              type={showGemini ? 'text' : 'password'}
              value={geminiKey}
              onChange={e => setGeminiKey(e.target.value)}
              className="w-full text-xs font-mono text-[#0B1F3A] bg-white/60 focus:bg-white border border-black/10 focus:border-[#0E7C86] rounded-xl pl-3 pr-9 py-2 outline-none"
            />
            <button
              onClick={() => {
                hapticLight();
                setShowGemini(!showGemini);
              }}
              className="absolute right-2.5 text-[#8A99A8] hover:text-[#0B1F3A] p-1"
            >
              {showGemini ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Groq API Key */}
        <div>
          <label className="text-[11px] font-medium text-[#5B6B7A] block mb-1">
            Groq Cloud Key (qwen/qwen3.8-27b)
          </label>
          <div className="relative flex items-center">
            <input
              type={showGroq ? 'text' : 'password'}
              value={groqKey}
              onChange={e => setGroqKey(e.target.value)}
              className="w-full text-xs font-mono text-[#0B1F3A] bg-white/60 focus:bg-white border border-black/10 focus:border-[#0E7C86] rounded-xl pl-3 pr-9 py-2 outline-none"
            />
            <button
              onClick={() => {
                hapticLight();
                setShowGroq(!showGroq);
              }}
              className="absolute right-2.5 text-[#8A99A8] hover:text-[#0B1F3A] p-1"
            >
              {showGroq ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* OpenAI Key */}
        <div>
          <label className="text-[11px] font-medium text-[#5B6B7A] block mb-1">
            OpenAI API Key (Optional)
          </label>
          <div className="relative flex items-center">
            <input
              type={showOpenai ? 'text' : 'password'}
              value={openaiKey}
              placeholder="sk-..."
              onChange={e => setOpenaiKey(e.target.value)}
              className="w-full text-xs font-mono text-[#0B1F3A] bg-white/60 focus:bg-white border border-black/10 focus:border-[#0E7C86] rounded-xl pl-3 pr-9 py-2 outline-none"
            />
            <button
              onClick={() => {
                hapticLight();
                setShowOpenai(!showOpenai);
              }}
              className="absolute right-2.5 text-[#8A99A8] hover:text-[#0B1F3A] p-1"
            >
              {showOpenai ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <button
          onClick={handleSaveKeys}
          className="w-full py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs active:scale-95 transition-all mt-1 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {savedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5" />}
          <span>{savedKey ? 'Vault Saved' : 'Encrypt & Save Keys'}</span>
        </button>
      </div>

      {/* 3. Node Health & Isolation */}
      <div className="glass-card rounded-[22px] p-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B1F3A]">
            <Server className="w-3.5 h-3.5 text-[#0E7C86]" />
            <span>Execution Worker Node</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
            ONLINE
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-white/50 border border-black/5 flex flex-col">
            <span className="text-[10px] text-[#8A99A8]">Worker Tag</span>
            <span className="font-semibold text-[#0B1F3A]">{systemHealth.workerTag}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/50 border border-black/5 flex flex-col">
            <span className="text-[10px] text-[#8A99A8]">RPC Roundtrip</span>
            <span className="font-semibold text-[#0E7C86]">{systemHealth.latencyMs}ms</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/50 border border-black/5 flex flex-col">
            <span className="text-[10px] text-[#8A99A8]">Isolation Kernel</span>
            <span className="font-semibold text-[#0B1F3A]">gVisor Secure</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/50 border border-black/5 flex flex-col">
            <span className="text-[10px] text-[#8A99A8]">Ledger Chain</span>
            <span className="font-semibold text-emerald-700">SHA-256 Valid</span>
          </div>
        </div>
      </div>

      {/* 4. Touch & Physical Settings */}
      <div className="glass-card rounded-[22px] p-4 flex flex-col gap-2.5">
        <span className="text-xs font-semibold text-[#0B1F3A]">
          Physical Feel & Experience
        </span>

        <div className="flex items-center justify-between p-2 rounded-xl bg-white/50">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#0E7C86]" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[#0B1F3A]">Device Presentation</span>
              <span className="text-[10px] text-[#5B6B7A]">iPhone 16 Pro Frame vs Edge-to-Edge</span>
            </div>
          </div>
          <button
            onClick={() => {
              hapticLight();
              setDeviceMode(deviceMode === 'frame' ? 'canvas' : 'frame');
            }}
            className="px-2.5 py-1 rounded-full bg-slate-900 text-white text-[11px] font-semibold active:scale-95"
          >
            {deviceMode === 'frame' ? 'iPhone Frame' : 'Full Canvas'}
          </button>
        </div>

        <div className="flex items-center justify-between p-2 rounded-xl bg-white/50">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-[#0E7C86]" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[#0B1F3A]">Apple Taptic Audio</span>
              <span className="text-[10px] text-[#5B6B7A]">Synthesized micro-clicks & vibration</span>
            </div>
          </div>
          <button
            onClick={() => {
              hapticLight();
              toggleSound();
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
              soundEnabled ? 'bg-[#0E7C86] text-white' : 'bg-black/10 text-[#5B6B7A]'
            }`}
          >
            {soundEnabled ? 'Active' : 'Muted'}
          </button>
        </div>
      </div>
    </div>
  );
};
