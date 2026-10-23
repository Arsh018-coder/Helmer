/**
 * Mobile steer page — Helmer
 * Phone-first view: status, latest step, big Pause/Resume/Stop/Redirect.
 * Accessed via QR code with a share token in production.
 */
import AppShell from '@/components/AppShell';

interface SteerPageProps {
  params: Promise<{ id: string }>;
}

export default async function SteerPage({ params }: SteerPageProps) {
  const { id } = await params;
  return <AppShell route="/r" id={id} />;
}
