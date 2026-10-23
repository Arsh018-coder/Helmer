/**
 * lib/auth.ts — client-side authentication system for Helmer.
 * Supports Google OAuth, GitHub OAuth, and Email/Password credentials,
 * with session persistence and reactive state synchronization.
 */

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: 'google' | 'github' | 'credentials';
  role: 'operator' | 'admin' | 'viewer';
  createdAt: string;
}

const STORAGE_KEY = 'helmer_auth_user';
const ACCOUNTS_STORAGE_KEY = 'helmer_user_accounts';

/** Read current user from localStorage safely in the browser. */
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

/** Store or clear the active user session. */
export function setCurrentUser(user: User | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    // Dispatch a custom event so all open tabs and components react immediately
    window.dispatchEvent(new CustomEvent('helmer-auth-change', { detail: user }));
  } catch {
    // LocalStorage quota or access issue
  }
}

/** Sign in with Google simulation / OAuth. */
export async function loginWithGoogle(): Promise<User> {
  // Realistic network latency simulation
  await new Promise((resolve) => setTimeout(resolve, 600));

  const user: User = {
    id: 'usr_g_' + Math.random().toString(36).substring(2, 9),
    name: 'Alex Vance',
    email: 'alex.vance@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
    provider: 'google',
    role: 'operator',
    createdAt: new Date().toISOString(),
  };

  setCurrentUser(user);
  return user;
}

/** Sign in with GitHub simulation / OAuth. */
export async function loginWithGithub(): Promise<User> {
  // Realistic network latency simulation
  await new Promise((resolve) => setTimeout(resolve, 600));

  const user: User = {
    id: 'usr_gh_' + Math.random().toString(36).substring(2, 9),
    name: 'devx-operator',
    email: 'operator@github.com',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=faces',
    provider: 'github',
    role: 'admin',
    createdAt: new Date().toISOString(),
  };

  setCurrentUser(user);
  return user;
}

/**
 * Sign in or sign up with email and password credentials.
 */
export async function loginWithCredentials(
  email: string,
  password: string,
  isSignUp: boolean,
  name?: string
): Promise<User> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  // Load existing registered accounts from localStorage
  let accounts: Record<string, { name: string; passwordHash: string }> = {};
  try {
    const rawAccounts = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (rawAccounts) accounts = JSON.parse(rawAccounts);
  } catch {}

  if (isSignUp) {
    const userName = name?.trim() || trimmedEmail.split('@')[0];
    accounts[trimmedEmail] = { name: userName, passwordHash: password };
    try {
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    } catch {}

    const newUser: User = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name: userName,
      email: trimmedEmail,
      provider: 'credentials',
      role: 'operator',
      createdAt: new Date().toISOString(),
    };
    setCurrentUser(newUser);
    return newUser;
  }

  // Sign In verification
  const existing = accounts[trimmedEmail];
  if (existing) {
    if (existing.passwordHash !== password) {
      throw new Error('Incorrect password. Please try again.');
    }
    const user: User = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name: existing.name,
      email: trimmedEmail,
      provider: 'credentials',
      role: 'operator',
      createdAt: new Date().toISOString(),
    };
    setCurrentUser(user);
    return user;
  }

  // If no previous account exists for this email, allow first-time instant login
  const defaultName = name?.trim() || trimmedEmail.split('@')[0];
  const user: User = {
    id: 'usr_' + Math.random().toString(36).substring(2, 9),
    name: defaultName,
    email: trimmedEmail,
    provider: 'credentials',
    role: 'operator',
    createdAt: new Date().toISOString(),
  };
  setCurrentUser(user);
  return user;
}

/** Demo operator account for 1-click evaluation. */
export async function loginAsDemo(): Promise<User> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const demoUser: User = {
    id: 'usr_demo_01',
    name: 'Lead Operator',
    email: 'lead.operator@helmer.ai',
    provider: 'credentials',
    role: 'admin',
    createdAt: new Date().toISOString(),
  };
  setCurrentUser(demoUser);
  return demoUser;
}

/** Sign out the active user. */
export function logout(): void {
  setCurrentUser(null);
}
