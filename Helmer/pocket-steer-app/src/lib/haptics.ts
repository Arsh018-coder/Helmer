/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Synthesize Apple Taptic Engine tactile micro-clicks using Web Audio API and navigator.vibrate
let audioCtx: AudioContext | null = null;
let soundEnabled = true;
let hapticsEnabled = true;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function toggleAudioHaptics(enableSound: boolean, enableVibrate: boolean) {
  soundEnabled = enableSound;
  hapticsEnabled = enableVibrate;
}

export function playTapticClick(frequency: number = 200, durationSec: number = 0.008, gainVal: number = 0.12) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, ctx.currentTime);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + durationSec);

    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + durationSec);
  } catch {
    // Ignore audio errors
  }
}

export function hapticLight() {
  if (hapticsEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(8);
    } catch {}
  }
  playTapticClick(220, 0.006, 0.08);
}

export function hapticMedium() {
  if (hapticsEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(18);
    } catch {}
  }
  playTapticClick(150, 0.012, 0.14);
}

export function hapticHeavy() {
  if (hapticsEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(35);
    } catch {}
  }
  playTapticClick(85, 0.024, 0.22);
}

export function hapticError() {
  if (hapticsEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([40, 30, 40]);
    } catch {}
  }
  // Double thud
  playTapticClick(70, 0.02, 0.25);
  setTimeout(() => playTapticClick(55, 0.03, 0.28), 70);
}

export function hapticSuccess() {
  if (hapticsEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([15, 25, 20]);
    } catch {}
  }
  playTapticClick(350, 0.015, 0.12);
  setTimeout(() => playTapticClick(620, 0.02, 0.16), 50);
}
