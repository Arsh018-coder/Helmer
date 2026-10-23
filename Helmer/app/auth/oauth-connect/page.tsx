'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setCurrentUser, type User } from '@/lib/auth';

export default function OAuthConnectPage() {
  const router = useRouter();
  const [provider, setProvider] = useState<'google' | 'github'>('google');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [githubPreview, setGithubPreview] = useState<{ avatar?: string; name?: string; bio?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const p = params.get('provider');
    if (p === 'github' || p === 'google') {
      setProvider(p);
    }
  }, []);

  // Fetch live GitHub preview when username is entered
  const handleGithubUsernameChange = async (username: string) => {
    setGithubUsername(username);
    setError(null);
    const clean = username.trim().replace(/^@/, '');
    if (clean.length >= 2) {
      try {
        const res = await fetch(`https://api.github.com/users/${encodeURIComponent(clean)}`);
        if (res.ok) {
          const data = await res.json();
          setGithubPreview({
            avatar: data.avatar_url,
            name: data.name || clean,
            bio: data.bio || `Public Repos: ${data.public_repos}`,
          });
          if (!name) setName(data.name || clean);
        } else {
          setGithubPreview(null);
        }
      } catch {
        setGithubPreview(null);
      }
    } else {
      setGithubPreview(null);
    }
  };

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = `/api/auth/oauth/${provider}`;
      const payload = provider === 'github'
        ? { username: githubUsername, email, name: name || githubPreview?.name }
        : { email, name };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'OAuth authorization failed.');
      }

      setCurrentUser(data.user, data.token);
      window.location.href = '/';
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check inputs.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font)',
        color: 'var(--text)',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '32px',
          borderRadius: 'var(--r-md)',
          boxShadow: '0 24px 60px rgba(11, 31, 58, 0.12)',
          background: 'var(--panel-bg, #ffffff)',
          border: '1px solid var(--stroke-border)',
          backdropFilter: 'blur(30px)',
        }}
      >
        {/* Provider Switcher Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button
            type="button"
            onClick={() => { setProvider('google'); setError(null); }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '10px',
              border: provider === 'google' ? '1.5px solid var(--accent)' : '1px solid var(--stroke-border)',
              background: provider === 'google' ? 'var(--accent-tint)' : 'transparent',
              color: 'var(--text)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
            </svg>
            <span>Google OAuth</span>
          </button>

          <button
            type="button"
            onClick={() => { setProvider('github'); setError(null); }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '10px',
              border: provider === 'github' ? '1.5px solid var(--accent)' : '1px solid var(--stroke-border)',
              background: provider === 'github' ? 'var(--accent-tint)' : 'transparent',
              color: 'var(--text)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>GitHub OAuth</span>
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span className="badge-dot-green" aria-hidden="true" style={{ width: '8px', height: '8px' }}></span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>
              DYNAMIC OAUTH 2.0 PROTOCOL
            </span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
            {provider === 'google' ? 'Authenticate with Google' : 'Authenticate with GitHub'}
          </h2>
          <p style={{ fontSize: '12.5px', color: 'var(--text-2)', marginTop: '4px', lineHeight: 1.4 }}>
            Connect your personal {provider === 'google' ? 'Google Workspace' : 'GitHub profile'}. Live accounts are verified, salted, and securely issued tamper-proof session tokens.
          </p>
        </div>

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
            }}
          >
            ✕ {error}
          </div>
        )}

        <form onSubmit={handleAuthorize} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {provider === 'github' ? (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                GitHub Username or Handle
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. torvalds or your-handle"
                value={githubUsername}
                onChange={(e) => handleGithubUsernameChange(e.target.value)}
                required
                style={{ width: '100%', fontSize: '13px', padding: '10px 14px', fontFamily: 'var(--mono)' }}
              />

              {githubPreview && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(11, 31, 58, 0.04)',
                    border: '1px solid var(--stroke-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  {githubPreview.avatar && (
                    <img
                      src={githubPreview.avatar}
                      alt="avatar"
                      style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  )}
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 700 }}>{githubPreview.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>{githubPreview.bio}</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Google Email Address
              </label>
              <input
                type="email"
                className="form-input"
                placeholder="yourname@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', fontSize: '13px', padding: '10px 14px' }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Full Display Name (Optional)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder={provider === 'github' ? githubPreview?.name || 'Your Full Name' : 'e.g. Neeraj Sharma'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', fontSize: '13px', padding: '10px 14px' }}
            />
          </div>

          <button
            type="submit"
            className="btn-pill btn-pill-primary"
            disabled={isLoading}
            style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: '6px', fontSize: '13.5px' }}
          >
            {isLoading ? (
              <span className="auth-spinner-white"></span>
            ) : (
              `Authorize with ${provider === 'google' ? 'Google' : 'GitHub'} →`
            )}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => router.push('/')}
            style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: '12px', cursor: 'pointer' }}
          >
            ← Return to Helmer
          </button>
        </div>
      </div>
    </div>
  );
}
