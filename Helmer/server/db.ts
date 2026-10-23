/**
 * server/db.ts — single PrismaClient instance
 *
 * Why the globalThis guard: Next.js hot-reloads modules in development, which
 * would create a new PrismaClient on every reload and exhaust the connection
 * pool. Stashing the instance on globalThis keeps one connection pool alive
 * across reloads. In production there is only one module load, so it's a no-op.
 *
 * Uses relative imports only — this file is shared between the Next.js route
 * handlers AND the worker (which runs under tsx, outside Next, so @/ is unavailable).
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Extend the global type so TypeScript knows about our stashed instance.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const db: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
