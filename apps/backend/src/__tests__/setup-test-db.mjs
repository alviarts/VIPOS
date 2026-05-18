/**
 * Helper to spin up a fresh per-test Postgres state (P2-01b finalstep).
 *
 * Strategy:
 *   - One shared test DB (DATABASE_URL_TEST or DATABASE_URL).
 *   - Schema is applied once (via global setup `setup-test-global.mjs`).
 *   - Before each test file (`setupTestEnv` in beforeAll), we TRUNCATE all
 *     tables with RESTART IDENTITY CASCADE, then re-seed defaults.
 *   - Tests run serially (vitest singleFork=true).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let _query;
let _initDatabase;
let _runAsSystem;
let _resetForTests;
let _cachedTables;

function getDeps() {
  if (!_query) {
    process.env.DATABASE_DRIVER = 'postgres';
    // P2-02: default to the non-superuser `vipos_app` role so Postgres RLS
    // policies actually apply during tests. Override via DATABASE_URL_TEST or
    // DATABASE_URL if the local Postgres has a different role configured.
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      process.env.DATABASE_URL_TEST ||
      'postgresql://vipos_app:apppass@localhost:5432/vipos_test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-vipos';
    process.env.DISABLE_API_DOCS = '1';

    ({ query: _query, runAsSystem: _runAsSystem, _resetForTests } = require('../db'));
    ({ initDatabase: _initDatabase } = require('../db/init'));
  }
  return { query: _query, initDatabase: _initDatabase, runAsSystem: _runAsSystem };
}

async function listAppTables(query) {
  if (_cachedTables) return _cachedTables;
  const r = await query(
    `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename NOT IN ('_prisma_migrations')
       ORDER BY tablename`
  );
  _cachedTables = r.rows.map((row) => `"${row.tablename}"`);
  return _cachedTables;
}

async function resetDb(query) {
  const tables = await listAppTables(query);
  if (!tables.length) return;
  // RLS blocks cross-tenant TRUNCATE outside the system bypass.
  await query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
}

export async function setupTestEnv() {
  const { query, initDatabase, runAsSystem } = getDeps();
  await runAsSystem(() => resetDb(query));
  await initDatabase();
}

export async function teardownTestEnv() {
  // Pool stays alive across files (faster). Only end on full process exit
  // — vitest will tear down the process when all suites are done.
}

export async function closeTestPool() {
  if (_resetForTests) _resetForTests();
}
