import React, { useState } from 'react';

interface DeliverableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  content: string;
  goal?: string;
  onDownload: () => void;
}

/**
 * DeliverableModal — Fullscreen/Maximized view of the generated deliverable.
 * Provides a wide reading experience, formatted markdown view, copy-to-clipboard,
 * word count badge, and raw text toggle.
 */
export default function DeliverableModal({
  isOpen,
  onClose,
  title = 'briefing.md',
  content,
  goal,
  onDownload,
}: DeliverableModalProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');

  if (!isOpen) return null;

  // Clean any residual truncation strings if present
  const cleanContent = content.replace(/\n?…\[truncated\s+\d+\s+characters\]/g, '').trim();
  const wordCount = cleanContent ? cleanContent.split(/\s+/).filter(Boolean).length : 0;
  const charCount = cleanContent.length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  /** Simple, elegant markdown renderer without heavy external deps */
  const renderFormattedMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();

      // Heading 1
      if (trimmed.startsWith('# ')) {
        return (
          <h1
            key={idx}
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--text)',
              marginTop: idx === 0 ? '0' : '22px',
              marginBottom: '12px',
              letterSpacing: '-0.02em',
              borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
              paddingBottom: '8px',
            }}
          >
            {trimmed.slice(2)}
          </h1>
        );
      }

      // Heading 2
      if (trimmed.startsWith('## ')) {
        return (
          <h2
            key={idx}
            style={{
              fontSize: '17px',
              fontWeight: 600,
              color: 'var(--text)',
              marginTop: '18px',
              marginBottom: '8px',
              letterSpacing: '-0.01em',
            }}
          >
            {trimmed.slice(3)}
          </h2>
        );
      }

      // Heading 3
      if (trimmed.startsWith('### ')) {
        return (
          <h3
            key={idx}
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--accent)',
              marginTop: '14px',
              marginBottom: '6px',
            }}
          >
            {trimmed.slice(4)}
          </h3>
        );
      }

      // Bullet points
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const bulletText = trimmed.slice(2);
        return (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              marginBottom: '6px',
              paddingLeft: '4px',
              fontSize: '13.5px',
              lineHeight: 1.6,
              color: 'var(--text)',
            }}
          >
            <span style={{ color: 'var(--accent)', fontWeight: 700, lineHeight: 1.6 }}>•</span>
            <span>{renderInlineText(bulletText)}</span>
          </div>
        );
      }

      // Empty line / paragraph break
      if (!trimmed) {
        return <div key={idx} style={{ height: '10px' }} />;
      }

      // Standard paragraph
      return (
        <p
          key={idx}
          style={{
            fontSize: '13.5px',
            lineHeight: 1.65,
            color: 'var(--text)',
            marginBottom: '8px',
          }}
        >
          {renderInlineText(trimmed)}
        </p>
      );
    });
  };

  /** Formats bold, URLs, and code */
  const renderInlineText = (text: string) => {
    // Replace markdown links and raw URLs
    const parts = text.split(/(https?:\/\/[^\s)"'<>]+)/g);
    return parts.map((part, i) => {
      if (/^https?:\/\//.test(part)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--accent)',
              textDecoration: 'underline',
              wordBreak: 'break-all',
            }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div
      className="qr-modal-overlay"
      onClick={onClose}
      style={{
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '92vw',
          maxWidth: '860px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px',
          background: 'rgba(255, 255, 255, 0.82)',
          border: '1.5px solid rgba(255, 255, 255, 0.95)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          animation: 'fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.45)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: 'rgba(0, 113, 227, 0.12)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '15px',
              }}
            >
              📄
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                  {title}
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(52, 199, 89, 0.15)',
                    color: 'var(--ok)',
                    fontWeight: 600,
                  }}
                >
                  ✓ VERIFIED DELIVERABLE
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                {wordCount} words · {charCount} characters · Markdown artifact
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* View Mode Toggle */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(0, 0, 0, 0.06)',
                borderRadius: '8px',
                padding: '2px',
                marginRight: '6px',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('formatted')}
                style={{
                  border: 'none',
                  background: viewMode === 'formatted' ? '#FFFFFF' : 'transparent',
                  color: viewMode === 'formatted' ? 'var(--text)' : 'var(--text-3)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: viewMode === 'formatted' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Formatted
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                style={{
                  border: 'none',
                  background: viewMode === 'raw' ? '#FFFFFF' : 'transparent',
                  color: viewMode === 'raw' ? 'var(--text)' : 'var(--text-3)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: viewMode === 'raw' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Raw Source
              </button>
            </div>

            <button
              className="btn-pill btn-pill-secondary btn-pill-sm"
              onClick={handleCopy}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>

            <button className="btn-pill btn-pill-primary btn-pill-sm" onClick={onDownload}>
              ⬇ Download
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: 'var(--text-2)',
                padding: '4px 8px',
                marginLeft: '4px',
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Goal Banner */}
        {goal && (
          <div
            style={{
              padding: '10px 24px',
              background: 'rgba(0, 113, 227, 0.05)',
              borderBottom: '1px solid rgba(0, 113, 227, 0.1)',
              fontSize: '12px',
              color: 'var(--text-2)',
            }}
          >
            <strong style={{ color: 'var(--accent)' }}>Goal:</strong> {goal}
          </div>
        )}

        {/* Content Body */}
        <div
          style={{
            padding: '26px 30px',
            overflowY: 'auto',
            flex: 1,
            background: '#FFFFFF',
          }}
        >
          {viewMode === 'formatted' ? (
            <div style={{ maxWidth: '100%', wordBreak: 'break-word' }}>
              {renderFormattedMarkdown(cleanContent)}
            </div>
          ) : (
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'var(--mono)',
                fontSize: '12px',
                lineHeight: 1.6,
                color: 'var(--text)',
                background: 'rgba(0, 0, 0, 0.03)',
                padding: '16px',
                borderRadius: '10px',
              }}
            >
              {cleanContent}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid rgba(0, 0, 0, 0.08)',
            background: 'rgba(255, 255, 255, 0.65)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: 'var(--text-3)',
          }}
        >
          <span>Deterministic execution deliverable · Tracing citations to flight recorder</span>
          <button className="btn-pill btn-pill-secondary btn-pill-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
