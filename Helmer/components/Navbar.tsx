import React from 'react';

interface NavbarProps {
  currentPath: string;
  activeRunId: string;
  activeRunStatus?: string;
  navigateTo: (path: string, e?: React.MouseEvent) => void;
  onOpenQrModal: () => void;
}

/**
 * Top Navigation Bar — Apple reflective frosted glass design.
 * Provides instant tab navigation across Overview, Console, Live Run, History, and Mobile Steer.
 */
export default function Navbar({
  currentPath,
  activeRunId,
  activeRunStatus,
  navigateTo,
  onOpenQrModal,
}: NavbarProps) {
  const runPath = activeRunId ? `/run/${activeRunId}` : '/run';
  const steerPath = activeRunId ? `/r/${activeRunId}` : '/r';

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
          <a href="/console" className="btn-pill btn-pill-primary btn-pill-sm" onClick={(e) => navigateTo('/console', e)}>
            Open the console
          </a>
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
        </div>
      </div>
    </header>
  );
}
