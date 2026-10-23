/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export const AmbientBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 bg-[#F5F7FB]">
      {/* Animated Chromatic Mesh Layer */}
      <div className="absolute inset-0 animate-ambient-mesh filter blur-[60px] opacity-90 transition-opacity duration-1000">
        {/* Teal Core */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{
            top: '8%',
            left: '12%',
            background: 'radial-gradient(circle, rgba(14, 124, 134, 0.22) 0%, transparent 68%)'
          }}
        />

        {/* Sky Blue */}
        <div
          className="absolute w-[550px] h-[550px] rounded-full"
          style={{
            top: '25%',
            right: '8%',
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.35) 0%, transparent 68%)'
          }}
        />

        {/* Indigo / Violet Glow */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            bottom: '10%',
            left: '20%',
            background: 'radial-gradient(circle, rgba(165, 180, 252, 0.38) 0%, transparent 70%)'
          }}
        />

        {/* Amber / Warm Subtle Accent */}
        <div
          className="absolute w-[400px] h-[400px] rounded-full"
          style={{
            top: '55%',
            right: '25%',
            background: 'radial-gradient(circle, rgba(251, 191, 36, 0.16) 0%, transparent 65%)'
          }}
        />
      </div>

      {/* Subtle Specular Horizon Vignette */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.75) 0%, transparent 80%)'
        }}
      />
    </div>
  );
};
