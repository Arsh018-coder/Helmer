/**
 * server/userStore.ts — Industry-Grade User & Session Authentication Engine
 *
 * Implements:
 * - PBKDF2 (100,000 iterations, SHA-512) salted password hashing.
 * - Constant-time comparison (timingSafeEqual) against timing attacks.
 * - Cryptographically signed JWT/HMAC session tokens with expiration.
 * - Persistent atomic storage in server/data/users.json with memory caching.
 * - Dynamic OAuth user reconciliation (Google & GitHub).
 * - Multi-transport session extraction (HTTP-Only Cookie and Authorization Header).
 */

import { randomBytes, pbkdf2Sync, createHmac, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: 'credentials' | 'google' | 'github';
  role: 'operator' | 'admin' | 'viewer';
  createdAt: string;
  lastLoginAt?: string;
}

export interface UserRecord extends PublicUser {
  passwordHash?: string;
  salt?: string;
  updatedAt: string;
}

export interface SessionPayload {
  sub: string; // User ID
  email: string;
  role: 'operator' | 'admin' | 'viewer';
  iat: number;
  exp: number;
  jti: string;
}

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SECRET = config.secretKey || 'helmer-enclave-production-auth-secret-key-32b';

// In-memory cache
let usersCache: Map<string, UserRecord> = new Map();
let isInitialized = false;

function ensureDataDirectory(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('[UserStore] Failed to create data directory:', err);
  }
}

function loadUsersFromDisk(): void {
  ensureDataDirectory();
  usersCache.clear();

  if (fs.existsSync(USERS_FILE)) {
    try {
      const content = fs.readFileSync(USERS_FILE, 'utf-8');
      const records: UserRecord[] = JSON.parse(content);
      for (const user of records) {
        usersCache.set(user.email.toLowerCase(), user);
      }
      return;
    } catch (err) {
      console.error('[UserStore] Failed to read users.json, creating baseline:', err);
    }
  }

  // Seed with default demo operator account if file does not exist
  const salt = randomBytes(32).toString('hex');
  const demoUser: UserRecord = {
    id: 'usr_demo_01',
    name: 'Lead Operator',
    email: 'lead.operator@helmer.ai',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=faces',
    provider: 'credentials',
    role: 'admin',
    salt,
    passwordHash: hashPasswordWithSalt('Operator123!', salt),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  usersCache.set(demoUser.email.toLowerCase(), demoUser);
  persistUsersToDisk();
}

function persistUsersToDisk(): void {
  ensureDataDirectory();
  try {
    const list = Array.from(usersCache.values());
    const tempFile = `${USERS_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(list, null, 2), 'utf-8');
    fs.renameSync(tempFile, USERS_FILE);
  } catch (err) {
    console.error('[UserStore] Failed to persist users to disk:', err);
  }
}

function getStore(): Map<string, UserRecord> {
  if (!isInitialized) {
    loadUsersFromDisk();
    isInitialized = true;
  }
  return usersCache;
}

/** Hash password using PBKDF2 with SHA-512 and unique salt */
export function hashPasswordWithSalt(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
}

/** Constant-time verification */
function verifyPasswordSafe(password: string, salt: string, expectedHash: string): boolean {
  const hash = hashPasswordWithSalt(password, salt);
  const left = Buffer.from(hash, 'hex');
  const right = Buffer.from(expectedHash, 'hex');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Mint cryptographically signed tamper-proof session token */
export function createSessionToken(user: PublicUser): string {
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email.toLowerCase(),
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((Date.now() + SESSION_TTL_MS) / 1000),
    jti: randomBytes(16).toString('hex'),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', SECRET).update(payloadB64).digest('base64url');

  return `${payloadB64}.${signature}`;
}

/** Verify signature and expiry of session token */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, providedSig] = parts;
  const expectedSig = createHmac('sha256', SECRET).update(payloadB64).digest('base64url');

  const left = Buffer.from(providedSig);
  const right = Buffer.from(expectedSig);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }

  try {
    const payload: SessionPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** Sanitize user record for client exposure */
export function toPublicUser(record: UserRecord): PublicUser {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    avatar: record.avatar,
    provider: record.provider,
    role: record.role,
    createdAt: record.createdAt,
    lastLoginAt: record.lastLoginAt,
  };
}

/** Find user by email */
export function getUserByEmail(email: string): UserRecord | null {
  const store = getStore();
  return store.get(email.trim().toLowerCase()) || null;
}

/** Find user by ID */
export function getUserById(id: string): UserRecord | null {
  const store = getStore();
  for (const user of store.values()) {
    if (user.id === id) return user;
  }
  return null;
}

/** Register a new user with credentials */
export function registerUser(email: string, password: string, name?: string, role: 'operator' | 'admin' | 'viewer' = 'operator'): { user: PublicUser; token: string } {
  const normalizedEmail = email.trim().toLowerCase();
  const store = getStore();

  if (store.has(normalizedEmail)) {
    throw new Error('An account with this email already exists.');
  }

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const salt = randomBytes(32).toString('hex');
  const passwordHash = hashPasswordWithSalt(password, salt);
  const now = new Date().toISOString();

  const newUser: UserRecord = {
    id: 'usr_' + randomBytes(6).toString('hex'),
    name: name?.trim() || normalizedEmail.split('@')[0],
    email: normalizedEmail,
    provider: 'credentials',
    role,
    salt,
    passwordHash,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };

  store.set(normalizedEmail, newUser);
  persistUsersToDisk();

  const publicUser = toPublicUser(newUser);
  const token = createSessionToken(publicUser);
  return { user: publicUser, token };
}

/** Authenticate existing user with credentials */
export function authenticateWithCredentials(email: string, password: string): { user: PublicUser; token: string } {
  const normalizedEmail = email.trim().toLowerCase();
  const user = getUserByEmail(normalizedEmail);

  if (!user || !user.salt || !user.passwordHash) {
    throw new Error('Invalid email or password.');
  }

  if (!verifyPasswordSafe(password, user.salt, user.passwordHash)) {
    throw new Error('Invalid email or password.');
  }

  user.lastLoginAt = new Date().toISOString();
  persistUsersToDisk();

  const publicUser = toPublicUser(user);
  const token = createSessionToken(publicUser);
  return { user: publicUser, token };
}

/** Authenticate or upsert OAuth user (Google / GitHub) */
export function authenticateWithOAuth(
  provider: 'google' | 'github',
  profile: { email: string; name: string; avatar?: string }
): { user: PublicUser; token: string } {
  const normalizedEmail = profile.email.trim().toLowerCase();
  const store = getStore();
  const existing = store.get(normalizedEmail);
  const now = new Date().toISOString();

  let userRecord: UserRecord;

  if (existing) {
    existing.name = profile.name || existing.name;
    if (profile.avatar) existing.avatar = profile.avatar;
    existing.lastLoginAt = now;
    userRecord = existing;
  } else {
    userRecord = {
      id: `usr_${provider.slice(0, 2)}_${randomBytes(6).toString('hex')}`,
      name: profile.name,
      email: normalizedEmail,
      avatar: profile.avatar,
      provider,
      role: 'operator',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    };
    store.set(normalizedEmail, userRecord);
  }

  persistUsersToDisk();

  const publicUser = toPublicUser(userRecord);
  const token = createSessionToken(publicUser);
  return { user: publicUser, token };
}

/** Extract and verify user session from Request (Cookie or Authorization header) */
export function getAuthenticatedUser(request: Request): PublicUser | null {
  let token: string | null = null;

  // 1. Check Authorization: Bearer <token>
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 2. Check Cookie header: helmer_session=<token>
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/helmer_session=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1].trim());
    }
  }

  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  const user = getUserById(payload.sub);
  return user ? toPublicUser(user) : null;
}
