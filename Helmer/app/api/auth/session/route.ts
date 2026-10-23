import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '../../../../server/userStore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }

  return NextResponse.json({ ok: true, user });
}
