/**
 * P2-08 PR-B — weekly auto-test recovery.
 *
 * BullMQ processor that proves the daily database backups are
 * actually *restorable*, not just *uploaded*. Runs once a week in
 * staging (Sundays 04:00 UTC, after the 02:00 daily dump + 02:30
 * uploads sync + alias roll-over have settled).
 *
 * Pipeline per run:
 *
 *   1. Read latest object under `${BACKUP_S3_PREFIX}/daily/` from S3,
 *      pick the freshest by `LastModified`.
 *   2. Stream the dump to a tmp file on the worker host.
 *   3. Open an admin connection to `RESTORE_TEST_DATABASE_URL` and
 *      `CREATE DATABASE "<unique>"` for a throwaway sandbox.
 *   4. `pg_restore --clean --if-exists` into the sandbox.
 *   5. Run a small set of read-only sanity queries (row counts on the
 *      core tables + `max(audit_logs.created_at)` + count of applied
 *      migrations) so we catch silent corruption / missing tables /
 *      stale dumps.
 *   6. Drop the sandbox DB and remove the tmp dump file in `finally`,
 *      regardless of success.
 *
 * Throws on hard failure so the BullMQ worker `failed` event fires
 * and `attachBackupFailureNotifier` (wired in `jobs/index.js`) routes
 * the error to Sentry + the email queue.
 *
 * Returns a `{ skipped }` shape when the job is not enabled — those
 * runs do **not** throw and do **not** count as a failure.
 *
 * Job payload (all optional):
 *
 *   {
 *     // Override the S3 prefix root (defaults to "vipos-backups").
 *     s3Prefix?: string,
 *   }
 *
 * Returned summary on success:
 *
 *   {
 *     dumpKey: string,
 *     dumpSizeBytes: number,
 *     sandbox: string,
 *     counts: {
 *       users: number,
 *       tenants: number,
 *       audit_logs: number,
 *       _prisma_migrations: number,
 *       audit_logs_max_created_at: string | null,
 *     },
 *   }
 */
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');

const { logger } = require('../lib/logger');
const defaultStorage = require('../lib/storage');

const log = logger.child({ component: 'restore-test' });

const DEFAULT_S3_PREFIX = 'vipos-backups';
const SANDBOX_PREFIX = 'vipos_restore_test_';

// Tables we always row-count after a restore. If any of them is gone
// the job throws — that's the whole point of the auto-test. Identifiers
// are inlined as quoted literals (the names are constants, not user
// input) so we don't need parameter binding here.
const SANITY_TABLES = Object.freeze(['users', 'tenants', 'audit_logs', '_prisma_migrations']);

/**
 * Format a Date as `YYYYMMDDTHHmmssZ` in UTC. Same shape as
 * `db-backup.formatTimestamp` minus the dashes — Postgres identifiers
 * can include underscores but not dashes without quoting, and we
 * prefer to keep sandbox names quote-free so `psql \c` doesn't choke.
 *
 * @param {Date} d
 */
function formatTimestamp(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

/**
 * Build a unique sandbox database name. Includes a random hex suffix
 * so two runs in the same wall-clock second never collide (the
 * scheduler cron is once a week, but ad-hoc invocations can land
 * back-to-back).
 *
 * @param {Date} now
 * @param {() => string} [randomSuffix] DI hook for tests.
 */
function buildSandboxName(now, randomSuffix) {
  const ts = formatTimestamp(now);
  const rand = randomSuffix ? randomSuffix() : crypto.randomBytes(3).toString('hex');
  return `${SANDBOX_PREFIX}${ts}_${rand}`;
}

/**
 * Replace the database name component of a Postgres connection URL
 * without disturbing the query string (sslmode, channel_binding, ...).
 *
 * @param {string} adminUrl
 * @param {string} dbName
 * @returns {string}
 */
function swapDbName(adminUrl, dbName) {
  const url = new URL(adminUrl);
  url.pathname = `/${dbName}`;
  return url.toString();
}

/**
 * Reject any database name that isn't a safe SQL identifier. We
 * generate the name ourselves but still validate to keep the
 * `CREATE DATABASE` interpolation explicit + auditable.
 *
 * @param {string} name
 */
function assertSafeDbName(name) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`restore-test: refusing unsafe sandbox db name "${name}"`);
  }
}

/**
 * Default `pg_restore` runner — mirrors `runPgDump` from db-backup.js.
 * Streams stderr into the rejection message so BullMQ failure logs
 * surface the actual cause.
 *
 * @param {string} dbUrl   target sandbox connection string
 * @param {string} dumpPath path to the local dump file
 */
function runPgRestore(dbUrl, dumpPath) {
  return new Promise((resolve, reject) => {
    const args = ['--clean', '--if-exists', '--no-owner', '--no-acl', '--dbname', dbUrl, dumpPath];
    const child = spawn('pg_restore', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`pg_restore exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

/**
 * Default executor for one-shot SQL (CREATE / DROP DATABASE) against
 * an admin connection. Uses `pg.Client` directly so we don't depend
 * on `psql` being on PATH inside the worker container — `pg_restore`
 * already comes with the postgres client tools, but `psql` may not on
 * minimal images.
 *
 * @param {string} connectionString
 * @param {string} sql
 */
async function defaultPsqlExec(connectionString, sql) {
  // Lazy require so test runs that mock `psqlExec` never load the
  // `pg` library + try to resolve native bindings.
  const { Client } = require('pg');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

/**
 * Default sanity-query runner. Counts rows in the canonical core
 * tables and reads the latest `audit_logs.created_at` so we can spot
 * stale dumps. Returns a plain object — every key is namespaced so
 * the structured log line is grep-friendly.
 *
 * @param {string} connectionString sandbox URL (post-restore)
 * @param {string[]} [tables] override the list of tables to count
 */
async function defaultRunSanityQueries(connectionString, tables = SANITY_TABLES) {
  const { Client } = require('pg');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const counts = {};
    for (const t of tables) {
      assertSafeDbName(t);
      // Identifier quoting keeps mixed-case / reserved names safe
      // while the value is a constant from SANITY_TABLES (not user
      // input) so this is not an injection vector.
      const r = await client.query(`SELECT count(*)::bigint AS c FROM "${t}"`);
      counts[t] = Number(r.rows[0].c);
    }
    if (tables.includes('audit_logs')) {
      const r = await client.query('SELECT max(created_at) AS m FROM "audit_logs"');
      const m = r.rows[0].m;
      counts.audit_logs_max_created_at = m ? new Date(m).toISOString() : null;
    }
    return counts;
  } finally {
    await client.end();
  }
}

/**
 * BullMQ processor entry point. Accepts a `deps` bag for tests so we
 * can swap out storage / pg_restore / the admin URL / the SQL helpers
 * without touching the network or spawning child processes.
 *
 * Idempotency: each invocation creates a uniquely-named sandbox DB
 * (timestamp + 6 hex chars) and `DROP`s it in `finally`, so running
 * the job back-to-back never leaves dangling state behind.
 *
 * @param {{ data?: object } | undefined} job
 * @param {object} [deps]
 * @param {object} [deps.storage]
 * @param {(dbUrl: string, dumpPath: string) => Promise<void>} [deps.runPgRestore]
 * @param {string} [deps.adminUrl]
 * @param {(connectionString: string, sql: string) => Promise<unknown>} [deps.psqlExec]
 * @param {(connectionString: string, tables?: string[]) => Promise<object>} [deps.runSanityQueries]
 * @param {() => Date} [deps.now]
 * @param {() => string} [deps.randomSuffix]
 * @returns {Promise<object>}
 */
async function processRestoreTest(job, deps = {}) {
  const data = job?.data || {};
  const storage = deps.storage ?? defaultStorage;
  const runRestore = deps.runPgRestore ?? runPgRestore;
  const adminUrl = deps.adminUrl ?? process.env.RESTORE_TEST_DATABASE_URL;
  const psqlExec = deps.psqlExec ?? defaultPsqlExec;
  const runSanityQueries = deps.runSanityQueries ?? defaultRunSanityQueries;
  const now = deps.now ? deps.now() : new Date();
  const s3Prefix = data.s3Prefix || process.env.BACKUP_S3_PREFIX || DEFAULT_S3_PREFIX;

  // --- gates ---------------------------------------------------------
  // The job is enabled per-host via env so prod workers stay off-by-
  // default — only the staging worker container exports
  // BACKUP_RESTORE_TEST_ENABLED=1.
  if (!process.env.BACKUP_RESTORE_TEST_ENABLED) {
    log.info({}, 'restore-test skipped: BACKUP_RESTORE_TEST_ENABLED not set');
    return { skipped: 'disabled' };
  }
  if (!storage.isStorageEnabled()) {
    log.warn({}, 'restore-test skipped: storage not configured');
    return { skipped: 'no-storage' };
  }
  if (!adminUrl) {
    log.warn({}, 'restore-test skipped: RESTORE_TEST_DATABASE_URL not set');
    return { skipped: 'no-admin-url' };
  }

  // --- 1. find the latest daily dump ---------------------------------
  const dailyPrefix = `${s3Prefix}/daily/`;
  const objects = await storage.listObjects(dailyPrefix);
  if (objects.length === 0) {
    throw new Error(
      `restore-test: no daily dumps found under "${dailyPrefix}" — has db-backup ever run?`
    );
  }
  // listObjects returns LastModified as a Date; sort newest-first.
  const sorted = [...objects].sort((a, b) => {
    const at = a.LastModified ? new Date(a.LastModified).getTime() : 0;
    const bt = b.LastModified ? new Date(b.LastModified).getTime() : 0;
    return bt - at;
  });
  const latest = sorted[0];

  // --- 2. stream the dump to a tmp file ------------------------------
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'vipos-restore-test-'));
  const tmpFile = path.join(tmpDir, 'dump.dump');
  log.info(
    { dumpKey: latest.Key, dumpSizeBytes: latest.Size ?? null },
    'streaming latest daily dump from S3'
  );
  const stream = await storage.getObjectStream(latest.Key);
  if (!stream) {
    throw new Error(`restore-test: storage.getObjectStream returned null for "${latest.Key}"`);
  }
  await pipeline(stream, fs.createWriteStream(tmpFile));
  const stat = await fsp.stat(tmpFile);

  // --- 3. allocate a unique sandbox DB on the admin connection -------
  const sandbox = buildSandboxName(now, deps.randomSuffix);
  assertSafeDbName(sandbox);
  log.info({ sandbox }, 'creating sandbox database');
  await psqlExec(adminUrl, `CREATE DATABASE "${sandbox}"`);

  let counts = null;
  try {
    // --- 4. pg_restore into the sandbox ------------------------------
    const sandboxUrl = swapDbName(adminUrl, sandbox);
    log.info({ sandbox, dumpPath: tmpFile }, 'pg_restore start');
    await runRestore(sandboxUrl, tmpFile);
    log.info({ sandbox }, 'pg_restore complete');

    // --- 5. sanity queries -------------------------------------------
    counts = await runSanityQueries(sandboxUrl, SANITY_TABLES);
    log.info({ sandbox, counts }, 'restore-test sanity queries passed');
  } finally {
    // --- 6. always drop sandbox + remove tmp file --------------------
    try {
      await psqlExec(adminUrl, `DROP DATABASE IF EXISTS "${sandbox}"`);
    } catch (err) {
      log.error(
        { err: err?.message, sandbox },
        'failed to drop sandbox database — manual cleanup required'
      );
    }
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }

  return {
    dumpKey: latest.Key,
    dumpSizeBytes: stat.size,
    sandbox,
    counts,
  };
}

module.exports = {
  processRestoreTest,
  DEFAULT_S3_PREFIX,
  SANDBOX_PREFIX,
  SANITY_TABLES,
  // Exposed for tests:
  formatTimestamp,
  buildSandboxName,
  swapDbName,
  assertSafeDbName,
};
