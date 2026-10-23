'use client';

/**
 * ErrorBoundary — Helmer
 * Wraps critical panels so a runtime exception in one pane never crashes
 * the whole workspace. Renders a minimal frosted-glass error card with a
 * "retry" button that resets the boundary.
 */

import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Optional label shown in the fallback card (e.g. "Agent Log Panel") */
  label?: string;
  /** Fallback UI override — if provided, ignores the built-in card */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? 'Unknown error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production you would ship to a logging endpoint here.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          role="alert"
          style={{
            padding: '20px 24px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg,rgba(255,255,255,0.58) 0%,rgba(255,255,255,0.22) 100%)',
            backdropFilter: 'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            border: '1.5px solid rgba(255,255,255,0.92)',
            boxShadow: 'inset 0 2px 2.5px 0 #FFFFFF,0 14px 34px -6px rgba(11,31,58,0.10)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#DC2626',
                boxShadow: '0 0 8px rgba(220,38,38,0.45)',
                flexShrink: 0,
              }}
              aria-hidden="true"
            />
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#DC2626',
              }}
            >
              {this.props.label ?? 'Panel'} — Render Error
            </span>
          </div>

          <p
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '11.5px',
              color: 'var(--text-2)',
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}
          >
            {this.state.message}
          </p>

          <button
            onClick={this.reset}
            style={{
              alignSelf: 'flex-start',
              padding: '6px 16px',
              borderRadius: '9999px',
              border: '1px solid rgba(220,38,38,0.3)',
              background: 'rgba(220,38,38,0.08)',
              color: '#DC2626',
              fontFamily: 'var(--font)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(220,38,38,0.16)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(220,38,38,0.08)';
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
