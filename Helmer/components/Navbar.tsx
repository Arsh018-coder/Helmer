import React, { useState, useEffect, useRef } from 'react';
import type { User } from '@/lib/auth';

interface NavbarProps {
  currentPath: string;
  activeRunId: string;
  activeRunStatus?: string;
  navigateTo: (path: string, e?: React.MouseEvent) => void;
  onOpenQrModal: () => void;
  user?: User | null;
  onOpenAuthModal?: () => void;
  onSignOut?: () => void;
}

/**
 * Top Navigation Bar — Apple reflective frosted glass design.
 * Provides instant tab navigation across Overview, Console, Live Run, History, and Mobile Steer,
 * with the authentication operator portal positioned at the rightmost position.
 */
export default function Navbar({
  currentPath,
  activeRunId,
  activeRunStatus,
  navigateTo,
  onOpenQrModal,
  user,
  onOpenAuthModal,
  onSignOut,
}: NavbarProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const runPath = activeRunId ? `/run/${activeRunId}` : '/run';
  const steerPath = activeRunId ? `/r/${activeRunId}` : '/r';

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsProfileOpen(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsProfileOpen(false);
    }, 220);
  };

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  return (
    <header className="navbar">
      <div className="navbar-ambient-glow" aria-hidden="true"></div>
      <div className="container navbar-inner">
        <a href="/" className="nav-brand" onClick={(e) => navigateTo('/', e)} aria-label="Helmer Home">
          <div className="nav-logo-3d">
            <img src="/logo.png" alt="Helmer" className="nav-logo-img" />
          </div>
          <span>Helmer</span>
        </a>

        <nav className="nav-links" aria-label="Main Navigation">
          <a href="/" className={`nav-link ${currentPath === '/' ? 'active' : ''}`} onClick={(e) => navigateTo('/', e)}>
            Overview
          </a>
          <a href="/console" className={`nav-link ${currentPath === '/console' ? 'active' : ''}`} onClick={(e) => navigateTo('/console', e)}>
            Console
          </a>
          <a href={runPath} className={`nav-link ${currentPath.startsWith('/run') ? 'active' : ''}`} onClick={(e) => navigateTo(runPath, e)}>
            <span
              className="badge-dot-green"
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                marginRight: '6px',
                verticalAlign: 'middle',
                animation: activeRunStatus === 'running' ? 'pulse 1.8s infinite' : 'none',
              }}
            ></span>
            Live Run
          </a>
          <a href="/history" className={`nav-link ${currentPath === '/history' ? 'active' : ''}`} onClick={(e) => navigateTo('/history', e)}>
            History
          </a>
          <a href={steerPath} className={`nav-link ${currentPath.startsWith('/r') ? 'active' : ''}`} onClick={(e) => navigateTo(steerPath, e)}>
            Mobile Steer
          </a>
        </nav>

        <div className="nav-actions">
          <button
            className="btn-pill btn-pill-secondary btn-pill-sm"
            onClick={onOpenQrModal}
            title="Steer from your phone via QR code"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
            QR Steer
          </button>

          {/* Rightmost Authentication Button / Profile Menu */}
          {!user ? (
            <button
              id="nav-auth-btn"
              className="btn-pill btn-pill-secondary btn-pill-sm auth-nav-trigger"
              onClick={onOpenAuthModal}
              title="Authenticate Operator (Google, GitHub, or Credentials)"
              aria-label="Sign in"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '6px 14px',
                border: '1px solid var(--accent-border)',
                background: 'var(--accent-tint)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Sign In</span>
            </button>
          ) : (
            <div
              className="auth-profile-wrapper"
              ref={dropdownRef}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              style={{ position: 'relative' }}
            >
              <button
                id="nav-user-menu-btn"
                className="auth-user-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsProfileOpen((prev) => !prev);
                }}
                title={`Logged in as ${user.name}`}
                aria-label="User Account Menu"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 11px 4px 5px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--stroke-border)',
                  background: 'rgba(255, 255, 255, 0.75)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(11, 31, 58, 0.04)',
                }}
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '1px solid var(--stroke-border)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent) 0%, #1e40af 100%)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name}
                </span>
                <span className="badge-dot-green" style={{ width: '6px', height: '6px', margin: 0 }} aria-hidden="true"></span>
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileOpen && (
                <div
                  className="auth-profile-dropdown glass-panel"
                  onClick={(e) => e.stopPropagation()}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '240px',
                    padding: '12px',
                    borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    boxShadow: '0 14px 40px rgba(11, 31, 58, 0.15), 0 0 0 1px rgba(11, 31, 58, 0.08)',
                    zIndex: 200,
                    animation: 'dropdownFadeIn 0.15s ease-out',
                  }}
                >
                  {/* User summary header */}
                  <div style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--stroke-subtle)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.email}
                    </div>
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'var(--accent-tint)',
                          fontSize: '10px',
                          fontFamily: 'var(--mono)',
                          color: 'var(--accent)',
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {user.provider}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(22, 163, 74, 0.1)',
                          fontSize: '10px',
                          fontFamily: 'var(--mono)',
                          color: 'var(--ok)',
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {user.role}
                      </span>
                    </div>
                  </div>

                  {/* Dropdown Options: 1. Profile, 2. Log out */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <a
                      id="nav-profile-link"
                      href="/profile"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsProfileOpen(false);
                        navigateTo('/profile', e);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        color: 'var(--text)',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        transition: 'all 0.15s ease',
                        cursor: 'pointer',
                        background: currentPath === '/profile' ? 'var(--accent-tint)' : 'transparent',
                        border: currentPath === '/profile' ? '1px solid var(--accent-border)' : '1px solid transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (currentPath !== '/profile') {
                          e.currentTarget.style.background = 'rgba(11, 31, 58, 0.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentPath !== '/profile') {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--accent)' }}>
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span>Profile & Keys</span>
                      </div>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-3)' }}>⌘P</span>
                    </a>

                    <button
                      id="nav-logout-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsProfileOpen(false);
                        onSignOut?.();
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        border: '1px solid var(--err-border)',
                        borderRadius: '8px',
                        background: 'var(--err-bg)',
                        color: 'var(--err)',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(220, 38, 38, 0.16)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--err-bg)';
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      <span>Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
