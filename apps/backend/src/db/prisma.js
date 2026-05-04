/**
 * Prisma client singleton (P2-01a infrastructure).
 *
 * Routes belum migrate ke Prisma di P2-01a — mereka masih pakai better-sqlite3
 * via `models/database.js`. Singleton ini disiapkan supaya P2-01b (route cutover)
 * tinggal pakai tanpa harus restructure module loading.
 *
 * USAGE (post-cutover):
 *   const prisma = require('./db/prisma');
 *   const user = await prisma.user.findUnique({ where: { id } });
 *
 * HOT-RELOAD SAFETY:
 *   Di dev (vite HMR / nodemon), require cache di-clear setiap reload.
 *   Pakai globalThis untuk avoid >1 PrismaClient instance yang habiskan
 *   connection pool. Pattern direkomen Prisma docs.
 */

let PrismaClient;
try {
  ({ PrismaClient } = require('@prisma/client'));
} catch (err) {
  // Module not found di environment yang belum `npx prisma generate`.
  // Lazy throw saat dipakai, supaya import statement tidak crash test
  // suite yang masih pakai SQLite.
  PrismaClient = class PrismaClientStub {
    constructor() {
      throw new Error(
        'Prisma client belum di-generate. Jalankan `npx prisma generate` di apps/backend.'
      );
    }
  };
}

function buildClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

// Reuse singleton across hot-reloads in dev. In prod (single process), each
// `require()` gets the cached module so the singleton is naturally a single
// instance.
const prisma = globalThis.__VIPOS_PRISMA__ || buildClient();
if (process.env.NODE_ENV !== 'production') {
  globalThis.__VIPOS_PRISMA__ = prisma;
}

module.exports = prisma;
