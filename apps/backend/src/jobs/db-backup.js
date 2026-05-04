/**
 * P2-08 — daily Postgres backup job.
 *
 * Mirrors the existing `scripts/backup-postgres.sh` but as a BullMQ
 * recurring job so it runs in the same worker process as
 * audit-retention / report / settlement / etc, and inherits the
 * Sentry + Prometheus hooks the rest of the queues already get.
 *
 * Pipeline per run:
 *
 *   1. `pg_dump --format=custom` against `DIRECT_URL` (or `DATABASE_URL`).
 *   2. Pipe the dump straight into a local file under `BACKUP_DIR`
 *      (default `./var/backups`).
 *   3. If `S3_BUCKET` is configured, stream the local file to
 *      `s3://$bucket/$prefix/daily/YYYY/MM/<timestamp>.dump`. On
 *      Sundays we also copy that key to `weekly/<iso-week>.dump`; on
 *      the first day of the month, also to `monthly/YYYY-MM.dump`.
 *      Retention beyond 14 days is delegated to S3 lifecycle rules.
 *   4. Prune local dumps older than `BACKUP_LOCAL_RETENTION_DAYS`
 *      (default 14).
 *
 * Job payload (all optional):
 *
 *   {
 *     // Override the dump filename prefix (defaults to "vipos").
 *     name?: string,
 *     // Override BACKUP_DIR for this single run.
 *     localDir?: string,
 *     // Override the S3 prefix root (defaults to "vipos-backups").
 *     s3Prefix?: string,
 *     // Override the local retention in days (default 14).
 *     localRetentionDays?: number,
 *     // Skip the S3 upload even when configured (smoke tests).
 *     skipUpload?: boolean,
 *   }
 *
 * Returned summary:
 *
 *   {
 *     dumpPath: string,
 *     dumpSizeBytes: number,
 *     uploadedKey: string | null,
 *     copiedTo: string[], // weekly/monthly aliases when applicable
 *     prunedLocal: number,
 *   }
 */
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { logger } = require('../lib/logger');
const defaultStorage = require('../lib/storage');

const execFileAsync = promisify(execFile);
const log = logger.child({ component: 'db-backup' });

const DEFAULT_LOCAL_RETENTION_DAYS = 14;
const DEFAULT_S3_PREFIX = 'vipos-backups';
const DEFAULT_NAME_PREFIX = 'vipos';

/**
 * Resolve the connection string used by pg_dump. Prefer DIRECT_URL so
 * we bypass PgBouncer (PgBouncer + pg_dump don't get along), then fall
 * back to DATABASE_URL.
 *
 * @returns {string}
 */
function resolveDumpUrl() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('db-backup: DATABASE_URL or DIRECT_URL must be set');
  }
  return url;
}

/**
 * Format a Date as `YYYY-MM-DDTHHmmssZ` in UTC for use in filenames.
 * Lower precision than ISO-8601 to keep filenames POSIX-friendly.
 *
 * @param {Date} d
 */
function formatTimestamp(d) {
  // 20260504T180420123Z → 2026-05-04T180420Z
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}${mi}${ss}Z`;
}

/**
 * ISO 8601 week number (1..53) for a Date. Used for the weekly prefix.
 */
function isoWeek(d) {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target - firstThursday) / 86400000;
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

/**
 * Run pg_dump and stream the output to `outPath`. Rejects when the
 * child exits with non-zero so callers can let the BullMQ retry policy
 * take over.
 *
 * @param {string} dbUrl
 * @param {string} outPath
 */
function runPgDump(dbUrl, outPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '--format=custom',
      '--no-owner',
      '--no-acl',
      '--no-comments',
      '--quote-all-identifiers',
      '--file=' + outPath,
      dbUrl,
    ];
    const child = spawn('pg_dump', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`pg_dump exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

/**
 * Resolve the `git rev-parse HEAD` of the running checkout, used as
 * S3 object metadata so we know which build produced a given dump.
 * Best-effort — returns "unknown" if git isn't reachable (e.g. in a
 * production container that pruned the .git dir).
 */
async function resolveGitSha() {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD']);
    return stdout.trim();
  } catch {
    return 'unknown';
  }
}

async function pruneLocal(dir, retentionDays) {
  let pruned = 0;
  let entries;
  try {
    entries = await fsp.readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return 0;
    throw err;
  }
  const cutoff = Date.now() - retentionDays * 24 * 3600 * 1000;
  for (const name of entries) {
    if (!name.endsWith('.dump')) continue;
    const p = path.join(dir, name);
    let st;
    try {
      st = await fsp.stat(p);
    } catch {
      continue;
    }
    if (st.mtimeMs < cutoff) {
      await fsp.unlink(p);
      pruned += 1;
    }
  }
  return pruned;
}

/**
 * Copy an S3 object to additional retention prefixes (weekly/, monthly/).
 * Implemented via re-PUT of the local file rather than CopyObject so
 * MinIO + R2 + B2 all behave identically without permissioning quirks.
 *
 * @param {object} storage   storage module (DI hook)
 * @param {string} localPath
 * @param {string[]} keys
 * @param {Record<string,string>} metadata
 */
async function copyToAliases(storage, localPath, keys, metadata) {
  const copied = [];
  for (const key of keys) {
    const stream = fs.createReadStream(localPath);
    await storage.putObject(key, stream, {
      metadata,
      contentType: 'application/octet-stream',
    });
    copied.push(key);
  }
  return copied;
}

/**
 * @param {{ data?: object }} job
 * @returns {Promise<object>}
 */
async function processDbBackup(job, deps = {}) {
  const data = job?.data || {};
  const namePrefix = data.name || DEFAULT_NAME_PREFIX;
  const localDir =
    data.localDir || process.env.BACKUP_DIR || path.join(process.cwd(), 'var', 'backups');
  const s3Prefix = data.s3Prefix || process.env.BACKUP_S3_PREFIX || DEFAULT_S3_PREFIX;
  const localRetentionDays = Number(
    data.localRetentionDays ??
      process.env.BACKUP_LOCAL_RETENTION_DAYS ??
      DEFAULT_LOCAL_RETENTION_DAYS
  );
  const skipUpload = Boolean(data.skipUpload);
  const now = deps.now ? deps.now() : new Date();
  const dbUrl = deps.dbUrl ?? resolveDumpUrl();
  const dump = deps.runPgDump ?? runPgDump;
  const storage = deps.storage ?? defaultStorage;

  await fsp.mkdir(localDir, { recursive: true });
  const ts = formatTimestamp(now);
  const dumpName = `${namePrefix}-${ts}.dump`;
  const dumpPath = path.join(localDir, dumpName);

  log.info({ dumpPath }, 'pg_dump start');
  await dump(dbUrl, dumpPath);
  const stat = await fsp.stat(dumpPath);
  log.info({ dumpPath, sizeBytes: stat.size }, 'pg_dump complete');

  let uploadedKey = null;
  let copiedTo = [];
  if (!skipUpload && storage.isStorageEnabled()) {
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dailyKey = `${s3Prefix}/daily/${yyyy}/${mm}/${dumpName}`;
    const metadata = {
      'created-at-utc': now.toISOString(),
      'git-sha': await resolveGitSha(),
      'node-env': process.env.NODE_ENV || 'development',
      host: os.hostname(),
      'dump-format': 'pg-custom',
    };
    log.info({ key: dailyKey }, 'uploading to S3');
    const stream = fs.createReadStream(dumpPath);
    await storage.putObject(dailyKey, stream, {
      metadata,
      contentType: 'application/octet-stream',
    });
    uploadedKey = dailyKey;

    const aliases = [];
    // Sundays roll over the weekly snapshot.
    if (now.getUTCDay() === 0) {
      aliases.push(`${s3Prefix}/weekly/${yyyy}-W${String(isoWeek(now)).padStart(2, '0')}.dump`);
    }
    // First of the month rolls over the monthly snapshot.
    if (now.getUTCDate() === 1) {
      aliases.push(`${s3Prefix}/monthly/${yyyy}-${mm}.dump`);
    }
    if (aliases.length > 0) {
      copiedTo = await copyToAliases(storage, dumpPath, aliases, metadata);
    }
  } else {
    log.warn(
      { skipUpload, storageEnabled: storage.isStorageEnabled() },
      'skipping S3 upload (storage not configured or skipUpload set)'
    );
  }

  const prunedLocal = await pruneLocal(localDir, localRetentionDays);

  return {
    dumpPath,
    dumpSizeBytes: stat.size,
    uploadedKey,
    copiedTo,
    prunedLocal,
  };
}

module.exports = {
  processDbBackup,
  DEFAULT_LOCAL_RETENTION_DAYS,
  DEFAULT_S3_PREFIX,
  // Exposed for tests:
  formatTimestamp,
  isoWeek,
  pruneLocal,
};
