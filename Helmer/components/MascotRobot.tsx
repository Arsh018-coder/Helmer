'use client';

import React, { useState, useEffect, useRef } from 'react';

/**
 * MascotRobot — Interactive 3D Robot Mascot Centerpiece.
 * Features:
 * - Real-time 3D parallax tilt responsive to mouse cursor coordinates
 * - Visor eye gaze tracking that smoothly follows user cursor
 * - Clickable telemetry ping interaction with animated status beacon
 */
export default function MascotRobot() {
  const mascotRef = useRef<HTMLDivElement>(null);
  const [mascotOffset, setMascotOffset] = useState({
    x: 0,
    y: 0,
    tiltX: 0,
    tiltY: 0,
    eyeX: 0,
    eyeY: 0,
  });
  const [robotStatus, setRobotStatus] = useState<string>('TELEMETRY ACTIVE · 60 FPS');
  const [isRobotPinged, setIsRobotPinged] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isDesktop || prefersReducedMotion) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let targetEyeX = 0;
    let targetEyeY = 0;
    let currentEyeX = 0;
    let currentEyeY = 0;
    let animId: number;

    const handleMouseMove = (e: MouseEvent) => {
      if (!mascotRef.current) return;
      const rect = mascotRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = (e.clientX - centerX) / (window.innerWidth / 2);
      const deltaY = (e.clientY - centerY) / (window.innerHeight / 2);

      targetX = Math.max(-12, Math.min(12, deltaX * 12));
      targetY = Math.max(-10, Math.min(10, deltaY * 10));

      targetEyeX = Math.max(-5.5, Math.min(5.5, deltaX * 5.5));
      targetEyeY = Math.max(-2.5, Math.min(2.5, deltaY * 2.5));
    };

    const handleMouseLeave = () => {
      targetX = 0;
      targetY = 0;
      targetEyeX = 0;
      targetEyeY = 0;
    };

    const animateRobot = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      const tiltX = -currentY * 0.45;
      const tiltY = currentX * 0.45;

      currentEyeX += (targetEyeX - currentEyeX) * 0.15;
      currentEyeY += (targetEyeY - currentEyeY) * 0.15;

      if (mascotRef.current) {
        mascotRef.current.style.setProperty('--eye-offset-x', `${currentEyeX.toFixed(2)}px`);
        mascotRef.current.style.setProperty('--eye-offset-y', `${currentEyeY.toFixed(2)}px`);
      }

      setMascotOffset({ x: currentX, y: currentY, tiltX, tiltY, eyeX: currentEyeX, eyeY: currentEyeY });
      animId = requestAnimationFrame(animateRobot);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);
    animId = requestAnimationFrame(animateRobot);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animId);
    };
  }, []);

  const handleRobotClick = () => {
    setIsRobotPinged(true);
    setRobotStatus('PING ACKNOWLEDGED · LATENCY 6ms');
    setTimeout(() => {
      setIsRobotPinged(false);
      setRobotStatus('TELEMETRY ACTIVE · 60 FPS');
    }, 2400);
  };

  return (
    <div
      className="mascot-container"
      ref={mascotRef}
      onClick={handleRobotClick}
      title="Click robot to send a real-time telemetry ping"
      style={{
        transform: `translate(${mascotOffset.x}px, ${mascotOffset.y}px) rotateX(${mascotOffset.tiltX}deg) rotateY(${mascotOffset.tiltY}deg)`,
        transition: 'transform 0.15s ease-out',
        '--eye-offset-x': `${mascotOffset.eyeX.toFixed(2)}px`,
        '--eye-offset-y': `${mascotOffset.eyeY.toFixed(2)}px`,
      } as React.CSSProperties}
    >
      {/* Rotating Coordinate Ring & Radar Pulse */}
      <div className="robot-telemetry-halo" aria-hidden="true"></div>
      <div className="robot-radar-pulse" aria-hidden="true"></div>

      {/* Robot Floating Wrapper */}
      <div className="mascot-float-wrap">
        <div className="mascot-img-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/robo.png"
            alt="Helmer autonomous robot mascot on fluted cylindrical pedestal"
            className="mascot-img"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (!target.src.includes('Gemini_Generated_Image_a2yzlha2yzlha2yz_8f78cf09.png')) {
                target.src = '/assets/aistudio/Gemini_Generated_Image_a2yzlha2yzlha2yz_8f78cf09.png';
              }
            }}
          />
        </div>
      </div>

      {/* Interactive Status Beacon floating above */}
      <div className="robot-beacon-pill" style={{ transform: isRobotPinged ? 'scale(1.06)' : 'scale(1)' }}>
        <span className="beacon-dot" aria-hidden="true"></span>
        <span>{robotStatus}</span>
      </div>

      {/* Realistic Ground Pedestal Shadow */}
      <div className="mascot-pedestal-shadow" aria-hidden="true"></div>
    </div>
  );
}
