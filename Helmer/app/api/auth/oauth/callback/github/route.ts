import { NextResponse } from 'next/server';
import { exchangeGithubCode } from '../../../../../../server/oauth';
import { authenticateWithOAuth } from '../../../../../../server/userStore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // Verify CSRF state
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/oauth_state=([^;]+)/);
  const expectedState = match ? decodeURIComponent(match[1].trim()) : null;

  if (!code) {
    return NextResponse.redirect(`${url.origin}/?error=github_oauth_denied`);
  }

  if (expectedState && state && state !== expectedState) {
    return NextResponse.redirect(`${url.origin}/?error=invalid_oauth_state`);
  }

  try {
    const redirectUri = `${url.origin}/api/auth/oauth/callback/github`;
    const profile = await exchangeGithubCode(code, redirectUri);
    const { token } = authenticateWithOAuth('github', profile);

    const response = NextResponse.redirect(`${url.origin}/`);

    response.cookies.set('helmer_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    response.cookies.delete('oauth_state');
    return response;
  } catch (error: any) {
    console.error('[GitHub Callback Error]:', error);
    return NextResponse.redirect(`${url.origin}/?error=${encodeURIComponent(error.message || 'github_oauth_failed')}`);
  }
}
