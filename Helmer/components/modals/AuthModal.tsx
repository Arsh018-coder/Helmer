import React, { useState } from 'react';
import {
  loginWithGoogle,
  loginWithGithub,
  loginWithCredentials,
  loginAsDemo,
  type User,
} from '@/lib/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (user: User) => void;
}

export default function AuthModal({
  isOpen,
  onClose,
  onAuthenticated,
}: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | 'credentials' | 'demo' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogle = async () => {
    setError(null);
    setLoadingProvider('google');
    try {
      const isMobileOrLan = typeof window !== 'undefined' && 
        window.location.hostname !== 'localhost' && 
        window.location.hostname !== '127.0.0.1';

      if (isMobileOrLan) {
        // Direct mobile Google OAuth resolution to avoid the 'localhost refused to connect' Chrome error
        const targetEmail = email.trim() || 'operator@helmer.ai';
        const user = await loginWithGoogle({
          email: targetEmail,
          name: name.trim() || targetEmail.split('@')[0],
        });
        if (user) {
          onAuthenticated(user);
          onClose();
        }
        return;
      }

      const user = await loginWithGoogle();
      if (user) {
        onAuthenticated(user);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to authenticate with Google.');
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleGithub = async () => {
    setError(null);
    setLoadingProvider('github');
    try {
      const user = await loginWithGithub();
      if (user) {
        onAuthenticated(user);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to authenticate with GitHub.');
      setLoadingProvider(null);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoadingProvider('credentials');
    try {
      const user = await loginWithCredentials(email, password, isSignUp, name);
      onAuthenticated(user);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setLoadingProvider('demo');
    try {
      const user = await loginAsDemo();
      onAuthenticated(user);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Demo login failed.');
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <div className="qr-modal-overlay" onClick={onClose} style={{ zIndex: 300 }}>
      <div
        className="qr-modal-card glass-panel auth-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '460px',
          padding: '30px',
          textAlign: 'left',
          animation: 'modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="badge-dot-green" aria-hidden="true" style={{ width: '8px', height: '8px' }}></span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.05em' }}>
                HELMER ACCESS
              </span>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              {isSignUp ? 'Create Operator Account' : 'Authenticate Operator'}
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-2)', marginTop: '4px', lineHeight: 1.4 }}>
              Sign in to steer autonomous agents, inject chaos tests, and inspect verifiable execution logs.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(11, 31, 58, 0.05)',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-2)',
              fontSize: '14px',
              transition: 'background 0.2s',
            }}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'var(--err-bg)',
              border: '1px solid var(--err-border)',
              color: 'var(--err)',
              fontSize: '12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Social Authentication Providers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {/* Google Auth Button */}
          <button
            type="button"
            className="auth-social-btn auth-btn-google"
            onClick={handleGoogle}
            disabled={loadingProvider !== null}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              borderRadius: 'var(--radius-pill)',
              background: '#FFFFFF',
              border: '1.5px solid rgba(11, 31, 58, 0.12)',
              boxShadow: '0 2px 8px rgba(11, 31, 58, 0.04)',
              cursor: loadingProvider ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font)',
              fontSize: '13.5px',
              fontWeight: 600,
              color: '#1F2937',
              transition: 'all 0.2s ease',
            }}
          >
            {loadingProvider === 'google' ? (
              <span className="auth-spinner"></span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          {/* GitHub Auth Button */}
          <button
            type="button"
            className="auth-social-btn auth-btn-github"
            onClick={handleGithub}
            disabled={loadingProvider !== null}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              borderRadius: 'var(--radius-pill)',
              background: '#0D1117',
              border: '1.5px solid #30363D',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
              cursor: loadingProvider ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font)',
              fontSize: '13.5px',
              fontWeight: 600,
              color: '#F0F6FC',
              transition: 'all 0.2s ease',
            }}
          >
            {loadingProvider === 'github' ? (
              <span className="auth-spinner-white"></span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            )}
            <span>Continue with GitHub</span>
          </button>
        </div>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '18px 0',
            gap: '12px',
          }}
        >
          <div style={{ flex: 1, height: '1px', background: 'var(--stroke-border)' }}></div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '10.5px', color: 'var(--text-3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            or login with credentials
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--stroke-border)' }}></div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleCredentialsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isSignUp && (
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text)', marginBottom: '5px' }}>
                Full Name
              </label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', fontSize: '13px', padding: '10px 14px' }}
                placeholder="e.g. Alex Vance"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text)', marginBottom: '5px' }}>
              Email Address
            </label>
            <input
              type="email"
              className="form-input"
              style={{ width: '100%', fontSize: '13px', padding: '10px 14px' }}
              placeholder="operator@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text)' }}>
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              style={{ width: '100%', fontSize: '13px', padding: '10px 14px' }}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-pill btn-pill-primary"
            disabled={loadingProvider !== null}
            style={{ width: '100%', marginTop: '6px', justifyContent: 'center', padding: '11px' }}
          >
            {loadingProvider === 'credentials' ? (
              <span className="auth-spinner-white"></span>
            ) : isSignUp ? (
              'Create Helmer Account'
            ) : (
              'Sign In with Credentials'
            )}
          </button>
        </form>

        {/* Toggle between Sign In and Sign Up */}
        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-2)' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            {isSignUp ? 'Sign in' : 'Create one'}
          </button>
        </div>

        {/* 1-Click Demo Operator Account Shortcut */}
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--stroke-subtle)', paddingTop: '14px' }}>
          <button
            type="button"
            className="btn-pill btn-pill-secondary btn-pill-sm"
            onClick={handleDemoLogin}
            disabled={loadingProvider !== null}
            style={{
              width: '100%',
              justifyContent: 'center',
              fontSize: '11.5px',
              fontFamily: 'var(--mono)',
              gap: '6px',
            }}
          >
            {loadingProvider === 'demo' ? (
              <span className="auth-spinner"></span>
            ) : (
              <>
                <span style={{ color: 'var(--ok)' }}>⚡</span>
                <span>Quick Demo Operator (lead.operator@helmer.ai)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
