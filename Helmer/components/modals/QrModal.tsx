import React from 'react';

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrDataUrl: string | null;
  steerUrl: string | null;
  activeRunId: string;
  navigateTo: (path: string, e?: React.MouseEvent) => void;
}

/**
 * QR Modal — Steer from your phone remote.
 * Displays a generated cryptographic QR code pointing to the live steering remote.
 */
export default function QrModal({
  isOpen,
  onClose,
  qrDataUrl,
  steerUrl,
  activeRunId,
  navigateTo,
}: QrModalProps) {
  if (!isOpen) return null;

  return (
    <div className="qr-modal-overlay" onClick={onClose}>
      <div className="qr-modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text)' }}>
            Steer From Your Phone
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-2)' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '18px', lineHeight: 1.5 }}>
          Scan this code with your phone camera to pause, redirect, or trigger chaos faults in real-time.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="Scan to open the mobile steer view"
              width={180}
              height={180}
              style={{ background: '#FFFFFF', padding: '10px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.4)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
            />
          ) : (
            <div
              style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', borderRadius: '14px', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: '11px', textAlign: 'center', padding: '10px' }}
            >
              Enter the access code to mint a share link
            </div>
          )}
        </div>

        <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)', wordBreak: 'break-all', marginBottom: '14px', background: 'rgba(255, 255, 255, 0.04)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '2px' }}>TARGET REMOTE URL:</div>
          <div>{steerUrl || `http://localhost:3000/r/${activeRunId}`}</div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            className="btn-pill"
            style={{ flex: 1, padding: '10px 14px', fontSize: '12px', background: 'rgba(255,255,255,0.08)', color: 'var(--text)' }}
            onClick={() => {
              const target = steerUrl || `${window.location.origin}/r/${activeRunId}`;
              navigator.clipboard.writeText(target);
              alert('Copied link to clipboard: ' + target);
            }}
          >
            📋 Copy Remote URL
          </button>
          <button
            className="btn-pill btn-pill-primary"
            style={{ flex: 1, padding: '10px 14px', fontSize: '12px' }}
            onClick={() => {
              onClose();
              if (steerUrl) {
                window.open(steerUrl, '_blank', 'noopener,noreferrer');
              } else {
                navigateTo(`/r/${activeRunId}`);
              }
            }}
          >
            Open Simulator ↗
          </button>
        </div>

        <p style={{ fontSize: '11px', color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.4, margin: 0 }}>
          💡 Ensure your phone is connected to the same Wi-Fi or laptop mobile hotspot.
        </p>
      </div>
    </div>
  );
}
