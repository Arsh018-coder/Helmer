import { NextResponse } from 'next/server';
import { authenticateWithOAuth } from '../../../../../server/userStore';
import { generateOAuthState, getGoogleAuthUrl } from '../../../../../server/oauth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const redirectUri = `${origin}/api/auth/oauth/callback/google`;
  const state = generateOAuthState();

  const googleAuthUrl = getGoogleAuthUrl(state, redirectUri);

  if (googleAuthUrl) {
    const response = NextResponse.redirect(googleAuthUrl);
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60, // 10 minutes
    });
    return response;
  }

  // If credentials are not yet configured in .env, redirect to interactive OAuth gateway
  return NextResponse.redirect(`${origin}/auth/oauth-connect?provider=google&state=${state}`);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, avatar } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ ok: false, error: 'A valid Google email address is required.' }, { status: 400 });
    }

    const userName = name?.trim() || email.split('@')[0];
    const userAvatar = avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userName)}&backgroundColor=0e7c86`;

    const { user, token } = authenticateWithOAuth('google', {
      email,
      name: userName,
      avatar: userAvatar,
    });

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
