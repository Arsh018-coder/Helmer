/**
 * Landing page — Helmer
 * Thin server component; delegates rendering to the AppShell client component.
 */
import AppShell from '@/components/AppShell';

export default function LandingPage() {
  return <AppShell route="/" />;
}
