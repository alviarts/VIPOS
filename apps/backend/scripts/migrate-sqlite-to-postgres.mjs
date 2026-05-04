#!/usr/bin/env node
/**
 * Sync data from SQLite (apps/backend/data/vipos.db) to Postgres (DATABASE_URL).
 *
 * USAGE:
 *   # Dry-run (count only, no writes):
 *   node scripts/migrate-sqlite-to-postgres.mjs --dry-run
 *
 *   # Real migration (truncates Postgres tables first):
 *   node scripts/migrate-sqlite-to-postgres.mjs
 *
 *   # Custom paths + override default tenant for legacy Phase 1 sources:
 *   VIPOS_DB_PATH=/path/to/vipos.db \
 *     DATABASE_URL=postgresql://... \
 *     MIGRATION_DEFAULT_TENANT_ID=1 \
 *     node scripts/migrate-sqlite-to-postgres.mjs
 *
 * STRATEGY:
 *   1. Open SQLite read-only, snapshot all table names from sqlite_master.
 *   2. Connect to Postgres directly via `pg`. Disable FK enforcement for the
 *      session via `SET session_replication_role = 'replica'` (requires
 *      SUPERUSER or REPLICATION role).
 *   3. For each table: TRUNCATE Postgres → batch INSERT from SQLite (500 rows
 *      at a time) → reset SERIAL sequence to MAX(id). When the Postgres
 *      target has NOT NULL columns missing from the SQLite source (typically
 *      `tenant_id` after the Phase 2 multi-tenant cutover), the script
 *      auto-injects sensible defaults so legacy Phase 1 SQLite databases
 *      migrate cleanly without manual ALTER TABLE prep.
 *   4. Re-enable FK enforcement.
 *   5. Verify row count parity per table (zero data loss criteria).
 *
 * EXIT CODES:
 *   0 - success, all tables migrated, row count parity verified.
 *   1 - one or more tables mismatched, OR a required Postgres column is
 *       missing from SQLite and no auto-injection rule applies.
 *   2 - environment error (missing DATABASE_URL, SQLite not found, etc.).
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose') || process.env.VERBOSE === '1';

const SQLITE_PATH = process.env.VIPOS_DB_PATH || path.join(__dirname, '..', 'data', 'vipos.db');

const PG_URL = process.env.DATABASE_URL;

// Default tenant id assigned to legacy Phase 1 rows that have no tenant_id
// in the SQLite source. Override with MIGRATION_DEFAULT_TENANT_ID=2 etc. if
// you need to attribute the data to a non-default tenant.
const DEFAULT_TENANT_ID = parseInt(process.env.MIGRATION_DEFAULT_TENANT_ID || '1', 10);

// Auto-injection rules for Postgres NOT NULL columns missing from SQLite.
// Each entry: column name → () => value. Add new rules here when Phase N
// migrations introduce more required columns without backfill defaults.
const INJECTION_RULES = {
  tenant_id: () => DEFAULT_TENANT_ID,
};

if (!PG_URL) {
  console.error('ERROR: DATABASE_URL env var not set.');
  process.exit(2);
}
if (!existsSync(SQLITE_PATH)) {
  console.error(`ERROR: SQLite database not found at ${SQLITE_PATH}.`);
  process.exit(2);
}

console.log(`SQLite source: ${SQLITE_PATH}`);
console.log(`Postgres target host: ${new URL(PG_URL).hostname}`);
console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'REAL MIGRATION'}`);
console.log('');

// Tables that exist in SQLite source but should NOT be migrated (Prisma
// internal tracking, SQLite metadata).
const SKIP_TABLES = new Set(['sqlite_sequence', '_prisma_migrations']);

const sqlite = new Database(SQLITE_PATH, { readonly: true });
sqlite.pragma('foreign_keys = OFF');

const tableRows = sqlite
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  )
  .all();

const tables = tableRows.map((r) => r.name).filter((t) => !SKIP_TABLES.has(t));
console.log(`Found ${tables.length} tables in SQLite.`);

const pgClient = new pg.Client({ connectionString: PG_URL });
await pgClient.connect();

// Allow violating FKs during bulk insert. Reset at the end.
if (!DRY_RUN) {
  await pgClient.query("SET session_replication_role = 'replica'");
}

const summary = [];
let hadError = false;

for (const table of tables) {
  const sqliteCount = sqlite.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get().c;

  const pgCheck = await pgClient.query(`SELECT to_regclass('public.${table}') AS exists`);
  if (!pgCheck.rows[0].exists) {
    console.warn(`  SKIP ${table}: not present in Postgres schema.`);
    summary.push({ table, sqliteCount, pgCount: null, status: 'skip' });
    continue;
  }

  const pgCountBefore = parseInt(
    (await pgClient.query(`SELECT COUNT(*) AS c FROM "${table}"`)).rows[0].c,
    10
  );

  if (DRY_RUN) {
    summary.push({
      table,
      sqliteCount,
      pgCount: pgCountBefore,
      status: 'dry-run',
    });
    if (VERBOSE) {
      console.log(`  ${table}: sqlite=${sqliteCount}, postgres=${pgCountBefore} (dry run)`);
    }
    continue;
  }

  // Real migration: truncate + bulk insert.
  await pgClient.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);

  if (sqliteCount === 0) {
    summary.push({ table, sqliteCount, pgCount: 0, status: 'empty' });
    if (VERBOSE) console.log(`  ${table}: empty, skipped insert`);
    continue;
  }

  // Discover columns from SQLite (Postgres should have same set after
  // schema migration; we use SQLite's order for INSERT).
  const cols = sqlite
    .prepare(`PRAGMA table_info("${table}")`)
    .all()
    .map((c) => c.name);

  // Cross-check against Postgres: any NOT NULL column with no default that's
  // not in the SQLite source needs to be supplied by the migration script.
  // The classic case is `tenant_id` after the Phase 2 multi-tenant cutover.
  const pgRequired = (
    await pgClient.query(
      `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND is_nullable = 'NO'
           AND column_default IS NULL`,
      [table]
    )
  ).rows.map((r) => r.column_name);

  const missing = pgRequired.filter((c) => !cols.includes(c));
  const unhandled = missing.filter((c) => !INJECTION_RULES[c]);
  if (unhandled.length > 0) {
    console.error(
      `  FAIL ${table}: required Postgres column(s) [${unhandled.join(', ')}] ` +
        `missing from SQLite source and no INJECTION_RULES entry. Add the column ` +
        `to SQLite or extend INJECTION_RULES in this script.`
    );
    summary.push({ table, sqliteCount, pgCount: 0, status: 'mismatch' });
    hadError = true;
    continue;
  }

  // Build the augmented column list: SQLite cols first, then injected cols.
  const injected = missing.map((c) => ({ name: c, value: INJECTION_RULES[c]() }));
  if (injected.length > 0) {
    console.log(
      `  ${table}: injecting ${injected.map((i) => `${i.name}=${i.value}`).join(', ')} ` +
        `(legacy SQLite source missing Phase 2 columns)`
    );
  }
  const allCols = cols.concat(injected.map((i) => i.name));
  const colList = allCols.map((c) => `"${c}"`).join(', ');
  const sqliteSelectList = cols.map((c) => `"${c}"`).join(', ');
  const BATCH = 500;

  let inserted = 0;
  let offset = 0;
  while (offset < sqliteCount) {
    const rows = sqlite
      .prepare(`SELECT ${sqliteSelectList} FROM "${table}" LIMIT ${BATCH} OFFSET ${offset}`)
      .all();
    if (rows.length === 0) break;

    const placeholders = [];
    const values = [];
    let idx = 1;
    for (const row of rows) {
      const ph = [];
      for (const c of cols) {
        ph.push(`$${idx++}`);
        values.push(coerceValue(row[c]));
      }
      for (const inj of injected) {
        ph.push(`$${idx++}`);
        values.push(inj.value);
      }
      placeholders.push(`(${ph.join(', ')})`);
    }
    const sql = `INSERT INTO "${table}" (${colList}) VALUES ${placeholders.join(', ')}`;
    await pgClient.query(sql, values);

    inserted += rows.length;
    offset += rows.length;
  }

  // Reset sequence to MAX(id) so future inserts don't collide.
  if (allCols.includes('id')) {
    await pgClient.query(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'),
         GREATEST(COALESCE((SELECT MAX(id) FROM "${table}"), 1), 1),
         (SELECT EXISTS (SELECT 1 FROM "${table}")))`
    );
  }

  const pgCountAfter = parseInt(
    (await pgClient.query(`SELECT COUNT(*) AS c FROM "${table}"`)).rows[0].c,
    10
  );

  const ok = pgCountAfter === sqliteCount;
  if (!ok) hadError = true;

  console.log(
    `  ${ok ? 'OK ' : 'FAIL'} ${table}: sqlite=${sqliteCount} → postgres=${pgCountAfter}`
  );
  summary.push({
    table,
    sqliteCount,
    pgCount: pgCountAfter,
    status: ok ? 'ok' : 'mismatch',
  });
}

if (!DRY_RUN) {
  await pgClient.query("SET session_replication_role = 'origin'");
}

await pgClient.end();
sqlite.close();

console.log('');
console.log('=== Summary ===');
const byStatus = summary.reduce((acc, s) => {
  acc[s.status] = (acc[s.status] || 0) + 1;
  return acc;
}, {});
for (const [status, count] of Object.entries(byStatus)) {
  console.log(`  ${status}: ${count}`);
}

if (hadError) {
  console.error('');
  console.error('Row count mismatch detected. See above for details.');
  process.exit(1);
}
process.exit(0);

/**
 * SQLite → Postgres value coercion. better-sqlite3 returns:
 *   - INTEGER → number (or BigInt if too large)
 *   - REAL    → number
 *   - TEXT    → string
 *   - BLOB    → Buffer
 *   - NULL    → null
 *   - DATETIME stored as ISO string → string (Postgres accepts as TIMESTAMPTZ)
 *
 * pg driver handles all these natively. Only special case: BigInt > Number.MAX_SAFE_INTEGER
 * needs a string conversion to avoid pg corrupting the value.
 */
function coerceValue(v) {
  if (typeof v === 'bigint') return v.toString();
  return v;
}
