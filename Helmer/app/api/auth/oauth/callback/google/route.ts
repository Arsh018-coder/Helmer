import { NextResponse } from 'next/server';
import { exchangeGoogleCode } from '../../../../../../server/oauth';
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
    return NextResponse.redirect(`${url.origin}/?error=google_oauth_denied`);
  }

  if (expectedState && state && state !== expectedState) {
    return NextResponse.redirect(`${url.origin}/?error=invalid_oauth_state`);
  }

  const matchReturnTo = cookieHeader.match(/oauth_return_to=([^;]+)/);
  const matchOrigin = cookieHeader.match(/oauth_client_origin=([^;]+)/);
  const returnTo = matchReturnTo ? decodeURIComponent(matchReturnTo[1].trim()) : '/';
  const clientOrigin = matchOrigin ? decodeURIComponent(matchOrigin[1].trim()) : url.origin;

  try {
    const redirectUri = `${url.origin}/api/auth/oauth/callback/google`;
    const profile = await exchangeGoogleCode(code, redirectUri);
    const { user, token } = authenticateWithOAuth('google', profile);

    const targetBase = clientOrigin && !clientOrigin.includes('localhost') ? clientOrigin : url.origin;
    const targetRedirect = new URL(returnTo, targetBase).toString();

    const response = NextResponse.redirect(targetRedirect);

    response.cookies.set('helmer_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    response.cookies.set('helmer_user', encodeURIComponent(JSON.stringify(user)), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    response.cookies.delete('oauth_state');
    response.cookies.delete('oauth_return_to');
    response.cookies.delete('oauth_client_origin');
    return response;
  } catch (error: any) {
    console.error('[Google Callback Error]:', error);
    const targetBase = clientOrigin && !clientOrigin.includes('localhost') ? clientOrigin : url.origin;
    return NextResponse.redirect(`${targetBase}/?error=${encodeURIComponent(error.message || 'google_oauth_failed')}`);
  }
}
