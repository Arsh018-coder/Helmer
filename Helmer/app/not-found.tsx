/**
 * 404 Not Found — Helmer
 */
import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--accent)', fontWeight: 600, marginBottom: '12px' }}>
        404 · PAGE NOT FOUND
      </div>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>
        Trajectory Out of Bounds
      </h1>
      <p style={{ color: 'var(--text-2)', maxWidth: '440px', lineHeight: 1.5, marginBottom: '24px', fontSize: '14px' }}>
        The requested path does not match any active flight telemetry or route in the Helmer engine.
      </p>
      <Link href="/" className="btn-pill btn-pill-primary" style={{ textDecoration: 'none' }}>
        Return to Overview →
      </Link>
    </div>
  );
}
