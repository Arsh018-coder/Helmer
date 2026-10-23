import { NextResponse } from 'next/server';
import { authenticateWithOAuth } from '../../../../../server/userStore';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    let profile = {
      email: 'alex.vance@gmail.com',
      name: 'Alex Vance',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
    };

    try {
      const body = await request.json();
      if (body.email) profile.email = body.email;
      if (body.name) profile.name = body.name;
      if (body.avatar) profile.avatar = body.avatar;
    } catch {
      // Use defaults if empty body
    }

    const { user, token } = authenticateWithOAuth('google', profile);

    const response = NextResponse.json({ ok: true, user, token });

    response.cookies.set('helmer_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Google authentication failed' }, { status: 400 });
  }
}
