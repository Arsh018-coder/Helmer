import React from 'react';

interface RedirectModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectInstruction: string;
  setRedirectInstruction: (val: string) => void;
  onSubmit: () => void;
}

/**
 * Redirect Modal — Inject mid-flight instructions into an active agent run.
 */
export default function RedirectModal({
  isOpen,
  onClose,
  redirectInstruction,
  setRedirectInstruction,
  onSubmit,
}: RedirectModalProps) {
  if (!isOpen) return null;

  return (
    <div className="qr-modal-overlay" onClick={onClose}>
      <div className="qr-modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px' }}>
          Redirect Working Instruction
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '14px' }}>
          Inject a mid-flight instruction. The agent loop blocks and incorporates this into the next decision step.
        </p>

        <textarea
          className="form-textarea"
          style={{ minHeight: '80px', marginBottom: '16px' }}
          value={redirectInstruction}
          onChange={(e) => setRedirectInstruction(e.target.value)}
          placeholder="e.g. Also include secondary European bank ledgers..."
        />

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="btn-pill btn-pill-secondary btn-pill-sm" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-pill btn-pill-primary btn-pill-sm" onClick={onSubmit}>
            Send Redirect
          </button>
        </div>
      </div>
    </div>
  );
}
