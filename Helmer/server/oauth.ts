/**
 * server/oauth.ts — Industry-Grade OAuth 2.0 Handshake & Profile Resolver
 * Supports Google OAuth 2.0 and GitHub OAuth 2.0 with:
 * - State CSRF generation and verification
 * - Code exchange against official token endpoints
 * - Live UserInfo retrieval (Google API v3 & GitHub REST API v3)
 * - Public GitHub profile resolution (live avatar & name from api.github.com)
 */

import { randomBytes } from 'node:crypto';

export interface OAuthProfile {
  email: string;
  name: string;
  avatar?: string;
  provider: 'google' | 'github';
  rawId?: string;
}

export function generateOAuthState(): string {
  return randomBytes(24).toString('base64url');
}

/** Get Google OAuth 2.0 Authorization URL */
export function getGoogleAuthUrl(state: string, redirectUri: string): string | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Get GitHub OAuth 2.0 Authorization URL */
export function getGithubAuthUrl(state: string, redirectUri: string): string | null {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  if (!clientId) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state,
    allow_signup: 'true',
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/** Exchange authorization code for Google user profile */
export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<OAuthProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured on server.');
  }

  // 1. Exchange code for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || 'Failed to exchange Google OAuth code.');
  }

  // 2. Fetch user profile from Google UserInfo
  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const userData = await userRes.json();
  if (!userRes.ok || !userData.email) {
    throw new Error('Failed to retrieve user profile from Google.');
  }

  return {
    email: userData.email,
    name: userData.name || userData.email.split('@')[0],
    avatar: userData.picture,
    provider: 'google',
    rawId: userData.sub,
  };
}

/** Exchange authorization code for GitHub user profile */
export async function exchangeGithubCode(code: string, redirectUri: string): Promise<OAuthProfile> {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error('GitHub OAuth credentials not configured on server.');
  }

  // 1. Exchange code for access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || 'Failed to exchange GitHub OAuth code.');
  }

  const token = tokenData.access_token;

  // 2. Fetch user profile
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'Helmer-Autonomous-Agent-Platform',
      Accept: 'application/vnd.github.v3+json',
    },
  });

  const userData = await userRes.json();
  if (!userRes.ok) {
    throw new Error('Failed to retrieve GitHub profile.');
  }

  // 3. Fetch primary email if not public in profile
  let email = userData.email;
  if (!email) {
    try {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'Helmer-Autonomous-Agent-Platform',
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (emailRes.ok) {
        const emails = await emailRes.json();
        const primary = emails.find((e: any) => e.primary && e.verified) || emails[0];
        if (primary) email = primary.email;
      }
    } catch {}
  }

  if (!email) {
    email = `${userData.login}@users.noreply.github.com`;
  }

  return {
    email,
    name: userData.name || userData.login,
    avatar: userData.avatar_url,
    provider: 'github',
    rawId: String(userData.id),
  };
}

/** Fetch public GitHub account by username to populate real live user profile */
export async function fetchPublicGithubProfile(username: string): Promise<OAuthProfile> {
  const cleanUsername = username.trim().replace(/^@/, '');
  if (!cleanUsername) {
    throw new Error('Please enter a valid GitHub username.');
  }

  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}`, {
    headers: {
      'User-Agent': 'Helmer-Autonomous-Agent-Platform',
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`GitHub user '${cleanUsername}' was not found.`);
    }
    throw new Error(`Failed to verify GitHub user '${cleanUsername}'.`);
  }

  const data = await res.json();
  const email = data.email || `${cleanUsername}@users.noreply.github.com`;

  return {
    email,
    name: data.name || cleanUsername,
    avatar: data.avatar_url || `https://github.com/${cleanUsername}.png`,
    provider: 'github',
    rawId: String(data.id),
  };
}
