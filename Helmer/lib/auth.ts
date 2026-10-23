/**
 * lib/auth.ts — Dynamic Client Authentication SDK for Helmer.
 * Connects directly to backend authentication endpoints:
 * - /api/auth/login
 * - /api/auth/register
 * - /api/auth/session
 * - /api/auth/logout
 * - /api/auth/oauth/google
 * - /api/auth/oauth/github
 *
 * Persists session tokens in secure HTTP-only cookies and localStorage,
 * with reactive multi-tab event synchronization.
 */

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: 'google' | 'github' | 'credentials';
  role: 'operator' | 'admin' | 'viewer';
  createdAt: string;
  lastLoginAt?: string;
}

const STORAGE_KEY = 'helmer_auth_user';
const TOKEN_KEY = 'helmer_auth_token';

/** Read current user from localStorage cache for instant render */
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

/** Store or clear the active user session in client storage */
export function setCurrentUser(user: User | null, token?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      if (token) localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
    // Broadcast auth change event to all components & tabs
    window.dispatchEvent(new CustomEvent('helmer-auth-change', { detail: user }));
  } catch {
    // Quota or storage restrictions handled
  }
}

/** Get stored auth token if present */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Dynamically verify the current session with the backend */
export async function refreshUserSession(): Promise<User | null> {
  if (typeof window === 'undefined') return null;
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/auth/session', {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.user) {
        setCurrentUser(data.user);
        return data.user;
      }
    }
  } catch {
    // Server or network unavailable, fall back to cached user
  }
  return getCurrentUser();
}

/**
 * Sign in with Google via dynamic OAuth 2.0 flow.
 * If direct profile data is provided, authenticates via POST.
 * Otherwise initiates standard OAuth redirect to /api/auth/oauth/google.
 */
export async function loginWithGoogle(profile?: { email: string; name?: string; avatar?: string }): Promise<User | void> {
  if (profile && profile.email) {
    const res = await fetch('/api/auth/oauth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(profile),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Google authentication failed.');
    }

    setCurrentUser(data.user, data.token);
    return data.user;
  }

  if (typeof window !== 'undefined') {
    window.location.href = '/api/auth/oauth/google';
  }
}

/**
 * Sign in with GitHub via dynamic OAuth 2.0 flow.
 * If direct profile/username data is provided, authenticates via POST.
 * Otherwise initiates standard OAuth redirect to /api/auth/oauth/github.
 */
export async function loginWithGithub(profile?: { username?: string; email?: string; name?: string }): Promise<User | void> {
  if (profile && (profile.username || profile.email)) {
    const res = await fetch('/api/auth/oauth/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(profile),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'GitHub authentication failed.');
    }

    setCurrentUser(data.user, data.token);
    return data.user;
  }

  if (typeof window !== 'undefined') {
    window.location.href = '/api/auth/oauth/github';
  }
}

/**
 * Sign in or sign up with email and password credentials.
 * Dispatches to /api/auth/register or /api/auth/login.
 */
export async function loginWithCredentials(
  email: string,
  password: string,
  isSignUp: boolean,
  name?: string
): Promise<User> {
  const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';
  const payload = isSignUp ? { email, password, name } : { email, password };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || (isSignUp ? 'Registration failed.' : 'Invalid credentials.'));
  }

  setCurrentUser(data.user, data.token);
  return data.user;
}

/** Quick Demo Operator Account authenticated via server endpoint */
export async function loginAsDemo(): Promise<User> {
  try {
    return await loginWithCredentials('lead.operator@helmer.ai', 'Operator123!', false);
  } catch {
    // If user record needs re-creation, fall back to registration
    return await loginWithCredentials('lead.operator@helmer.ai', 'Operator123!', true, 'Lead Operator');
  }
}

/** Sign out the active user via server endpoint and clear local session */
export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Silent fail on network
  }
  setCurrentUser(null);
}
