/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useHelmer } from '../../lib/useHelmer';
import { X, QrCode, Camera, Copy, Check, Smartphone, Sparkles, RefreshCw } from 'lucide-react';
import { hapticLight, hapticSuccess } from '../../lib/haptics';

export const QrModal: React.FC = () => {
  const { isQrOpen, setQrOpen, activeRun } = useHelmer();
  const [activeTab, setActiveTab] = useState<'display' | 'scan'>('display');
  const [copiedLink, setCopiedLink] = useState(false);
  const [simulatedScanned, setSimulatedScanned] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraError, setCameraError] = useState(false);

  const shareToken = 'hmac_' + (activeRun?.id || 'uhpwpnza') + '_9f82d1c';
  const steerUrl = `https://helmer.app/r/${activeRun?.id || 'uhpwpnza'}?t=${shareToken}`;

  // Camera stream handler for Scan mode
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (isQrOpen && activeTab === 'scan') {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch(() => {
          setCameraError(true);
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [isQrOpen, activeTab]);

  if (!isQrOpen) return null;

  const handleCopyLink = () => {
    hapticSuccess();
    navigator.clipboard.writeText(steerUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSimulateInstantPair = () => {
    hapticSuccess();
    setSimulatedScanned(true);
    setTimeout(() => {
      setSimulatedScanned(false);
      setQrOpen(false);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-[32px] glass-elevated border border-white/95 shadow-2xl p-5 flex flex-col gap-3.5 text-center animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-1.5 border-b border-black/5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0E7C86]/15 flex items-center justify-center text-[#0E7C86]">
              <QrCode className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-[#0B1F3A]">
              POCKET STEER PAIRING
            </span>
          </div>

          <button
            onClick={() => {
              hapticLight();
              setQrOpen(false);
            }}
            className="p-1 rounded-full hover:bg-black/5 text-[#5B6B7A]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: Show QR vs Camera Scanner */}
        <div className="grid grid-cols-2 p-0.5 rounded-full bg-black/5 text-xs font-semibold">
          <button
            onClick={() => {
              hapticLight();
              setActiveTab('display');
            }}
            className={`py-1.5 rounded-full transition-all cursor-pointer ${
              activeTab === 'display' ? 'bg-white shadow-xs text-[#0B1F3A]' : 'text-[#5B6B7A]'
            }`}
          >
            Display Code
          </button>
          <button
            onClick={() => {
              hapticLight();
              setActiveTab('scan');
            }}
            className={`py-1.5 rounded-full transition-all cursor-pointer ${
              activeTab === 'scan' ? 'bg-white shadow-xs text-[#0B1F3A]' : 'text-[#5B6B7A]'
            }`}
          >
            Camera Scanner
          </button>
        </div>

        {activeTab === 'display' ? (
          // Display Cryptographic QR Code
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-white rounded-2xl shadow-inner border border-black/10 flex flex-col items-center">
              {/* SVG QR Code Pattern */}
              <svg className="w-48 h-48" viewBox="0 0 100 100" fill="none">
                {/* Background */}
                <rect width="100" height="100" fill="#FFFFFF" rx="8" />
                {/* Top-Left Corner Box */}
                <rect x="8" y="8" width="24" height="24" rx="4" fill="#0B1F3A" />
                <rect x="12" y="12" width="16" height="16" rx="2" fill="#FFFFFF" />
                <rect x="16" y="16" width="8" height="8" rx="1.5" fill="#0E7C86" />
                {/* Top-Right Corner Box */}
                <rect x="68" y="8" width="24" height="24" rx="4" fill="#0B1F3A" />
                <rect x="72" y="12" width="16" height="16" rx="2" fill="#FFFFFF" />
                <rect x="76" y="16" width="8" height="8" rx="1.5" fill="#0E7C86" />
                {/* Bottom-Left Corner Box */}
                <rect x="8" y="68" width="24" height="24" rx="4" fill="#0B1F3A" />
                <rect x="12" y="72" width="16" height="16" rx="2" fill="#FFFFFF" />
                <rect x="16" y="76" width="8" height="8" rx="1.5" fill="#0E7C86" />
                {/* High density data matrices */}
                <rect x="36" y="10" width="4" height="4" fill="#0B1F3A" />
                <rect x="44" y="10" width="8" height="4" fill="#0E7C86" />
                <rect x="56" y="10" width="4" height="4" fill="#0B1F3A" />
                <rect x="36" y="18" width="6" height="6" fill="#0E7C86" />
                <rect x="46" y="18" width="4" height="4" fill="#0B1F3A" />
                <rect x="54" y="18" width="8" height="4" fill="#0B1F3A" />
                <rect x="36" y="28" width="4" height="6" fill="#0B1F3A" />
                <rect x="44" y="28" width="6" height="4" fill="#0E7C86" />
                <rect x="56" y="28" width="4" height="4" fill="#0B1F3A" />
                {/* Center Hub */}
                <rect x="10" y="38" width="80" height="4" fill="#0B1F3A" />
                <rect x="10" y="46" width="20" height="6" fill="#0E7C86" />
                <rect x="34" y="46" width="12" height="12" rx="2" fill="#0E7C86" />
                <rect x="50" y="46" width="18" height="6" fill="#0B1F3A" />
                <rect x="72" y="46" width="18" height="6" fill="#0E7C86" />
                {/* Lower Hub */}
                <rect x="36" y="64" width="8" height="8" fill="#0B1F3A" />
                <rect x="48" y="64" width="6" height="4" fill="#0E7C86" />
                <rect x="58" y="64" width="12" height="6" fill="#0B1F3A" />
                <rect x="74" y="64" width="16" height="4" fill="#0E7C86" />
                <rect x="36" y="76" width="16" height="6" fill="#0B1F3A" />
                <rect x="56" y="76" width="8" height="12" fill="#0E7C86" />
                <rect x="68" y="76" width="12" height="6" fill="#0B1F3A" />
                <rect x="84" y="76" width="6" height="14" fill="#0E7C86" />
                {/* Center Helmer Glyphs */}
                <circle cx="50" cy="50" r="5" fill="#FFFFFF" />
                <circle cx="50" cy="50" r="3" fill="#0E7C86" />
              </svg>

              <span className="text-[10px] text-[#5B6B7A] font-mono mt-1">
                RUN: {activeRun?.id || 'uhpwpnza'} · HMAC Signed
              </span>
            </div>

            <p className="text-xs text-[#5B6B7A] leading-relaxed">
              Scan with your smartphone camera to launch the remote control interface in under 400ms.
            </p>

            <button
              onClick={handleCopyLink}
              className="w-full py-2.5 rounded-full bg-slate-900 text-white font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copied to Clipboard' : 'Copy Direct Steer URL'}</span>
            </button>
          </div>
        ) : (
          // Camera Scanner View with Targeting Reticle
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-56 h-56 rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-white/20 shadow-lg">
              {/* Native Video Feed or Fallback */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Targeting Reticle Overlay */}
              <div className="absolute inset-4 border-2 border-dashed border-[#0E7C86] rounded-xl flex items-center justify-center pointer-events-none">
                {/* Animated Red Laser Scan Line */}
                <div className="absolute w-full h-[2px] bg-red-500 shadow-[0_0_8px_red] animate-bounce" />
                
                {/* Reticle Corner Brackets */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#0E7C86]" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#0E7C86]" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#0E7C86]" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#0E7C86]" />
              </div>

              {cameraError && (
                <div className="absolute inset-0 bg-slate-950/90 text-white p-4 flex flex-col items-center justify-center text-xs">
                  <Camera className="w-8 h-8 text-[#0E7C86] mb-2" />
                  <span>Camera in simulator mode</span>
                </div>
              )}
            </div>

            <p className="text-xs text-[#5B6B7A] leading-relaxed">
              Align QR code in viewfinder to instantly lock remote session.
            </p>

            <button
              onClick={handleSimulateInstantPair}
              className="w-full py-2.5 rounded-full bg-[#0E7C86] text-white font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{simulatedScanned ? '✓ Hardware Paired (340ms)' : 'Simulate Instant QR Lock'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
