import { NextResponse } from 'next/server';
import { authenticateWithOAuth } from '../../../../../server/userStore';
import { generateOAuthState, getGithubAuthUrl, fetchPublicGithubProfile } from '../../../../../server/oauth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const redirectUri = `${origin}/api/auth/oauth/callback/github`;
  const state = generateOAuthState();

  const githubAuthUrl = getGithubAuthUrl(state, redirectUri);

  if (githubAuthUrl) {
    const response = NextResponse.redirect(githubAuthUrl);
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
  return NextResponse.redirect(`${origin}/auth/oauth-connect?provider=github&state=${state}`);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let profileData: { email: string; name: string; avatar?: string };

    if (body.username) {
      // Dynamically fetch live public profile from official GitHub REST API
      const liveGithub = await fetchPublicGithubProfile(body.username);
      profileData = {
        email: body.email || liveGithub.email,
        name: body.name || liveGithub.name,
        avatar: liveGithub.avatar,
      };
    } else {
      if (!body.email || !body.email.includes('@')) {
        return NextResponse.json({ ok: false, error: 'A valid email or GitHub username is required.' }, { status: 400 });
      }
      profileData = {
        email: body.email,
        name: body.name || body.email.split('@')[0],
        avatar: body.avatar || `https://github.com/${encodeURIComponent(body.name || 'octocat')}.png`,
      };
    }

    const { user, token } = authenticateWithOAuth('github', profileData);

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
    return NextResponse.json({ ok: false, error: error?.message || 'GitHub authentication failed' }, { status: 400 });
  }
}
