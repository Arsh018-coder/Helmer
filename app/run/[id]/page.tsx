/**
 * Live run view — Helmer
 * Renders the 3-column run view for a specific run id.
 * The id param is passed to AppShell so it can derive the currentPath.
 */
import AppShell from '@/components/AppShell';

interface RunPageProps {
  params: Promise<{ id: string }>;
}

export default async function RunPage({ params }: RunPageProps) {
  const { id } = await params;
  return <AppShell route="/run" id={id} />;
}
