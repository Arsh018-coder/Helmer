/**
 * Offline bundle verifier — Helmer (additive feature F1)
 * Paste or upload an exported run bundle and a pinned head hash.
 * The SHA-256 chain is re-verified client-side with WebCrypto.
 * This route was missing from the original Vite SPA (AUDIT.md item F1).
 */
import AppShell from '@/components/AppShell';

export default function VerifyPage() {
  return <AppShell route="/verify" />;
}
