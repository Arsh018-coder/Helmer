/**
 * /api/runs/[id]/share — mint the phone Steer link for one run.
 *
 * The returned URL carries a share token scoped to this run and valid for two hours, so a
 * phone can pause or redirect without being handed the project-wide access code.
 */

import { requireAccessCode, signShareToken } from '../../../../../server/auth';
import { db } from '../../../../../server/db';
import { handleRoute, okJson } from '../../../../../server/http';
import { getRunStatus } from '../../../../../server/runs';
import { parseWith, runIdSchema } from '../../../../../server/validation';

export const dynamic = 'force-dynamic';

interface RunContext {
  params: Promise<{ id: string }>;
}

export const POST = handleRoute<RunContext>('share', async (request, context) => {
  const { id } = await context.params;
  parseWith(runIdSchema, id);
  requireAccessCode(request);

  // Look the run up first so a share link is never issued for a typo.
  await getRunStatus(db, id);

  const token = signShareToken(id);
  
  // Determine accessible base origin:
  // 1. Configured TUNNEL_URL or non-default APP_URL/NEXT_PUBLIC_APP_URL
  // 2. Request origin if not localhost/127.0.0.1
  // 3. Auto-detected LAN IP (e.g. 172.22.214.101:3000) so phones on the same Wi-Fi can connect
  let baseOrigin = new URL(request.url).origin;
  
  const envUrl = process.env.TUNNEL_URL || (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL' ? process.env.APP_URL : null) || (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost') ? process.env.NEXT_PUBLIC_APP_URL : null);
  
  if (envUrl) {
    baseOrigin = envUrl.replace(/\/+$/, '');
  } else if (baseOrigin.includes('localhost') || baseOrigin.includes('127.0.0.1')) {
    try {
      const os = await import('node:os');
      const interfaces = os.networkInterfaces();
      let lanIp: string | null = null;
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
          if (iface.family === 'IPv4' && !iface.internal && !name.toLowerCase().includes('vmnet') && !name.toLowerCase().includes('veth')) {
            lanIp = iface.address;
            break;
          }
        }
        if (lanIp) break;
      }
      if (lanIp) {
        const port = new URL(request.url).port || '3000';
        baseOrigin = `http://${lanIp}:${port}`;
      }
    } catch {
      // Fallback to request origin
    }
  }

  return okJson({ url: `${baseOrigin}/r/${id}?t=${encodeURIComponent(token)}` });
});
