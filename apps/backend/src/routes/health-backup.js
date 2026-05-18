// Backup-freshness health probe.
//
// `GET /health/backup` checks the **most recent local Postgres dump**
// produced by the BullMQ `db-backup` job (or the `backup-postgres.sh`
// shell fallback) and reports whether the backup pipeline is fresh +
// non-corrupt enough to trust.
//
// Why this endpoint exists:
//   2026-05-05 we lost ~12h of backup coverage because Postgres creds
//   were rotated but the `vipos-worker` pm2 process kept the old env
//   in memory. The job kept "succeeding" from the queue's POV but
//   produced 3 zero-byte dump files in `/var/backups/vipos/`. Sentry
//   eventually flagged it, but only after manual investigation. With
//   this probe a monitor (Uptime Kuma, BetterUptime, k8s liveness, etc)
//   can poll `/api/health/backup` and alert within minutes when:
//     - no dump has landed for >threshold hours  (job stopped firing)
//     - the newest dump is zero-byte             (silent auth/config bug)
//     - `BACKUP_DIR` doesn't exist               (deploy regression)
//
// Response shape (200 ok):
//   {
//     status: 'ok',
//     timestamp: <iso8601>,
//     dump: {
//       path: <absolute-or-relative>,
//       age_hours: <number>,
//       size_bytes: <number>,
//       mtime: <iso8601>,
//     },
//     threshold_hours: <number>,
//   }
//
// Response shape (503 stale / corrupt / missing):
//   {
//     status: 'stale' | 'corrupt' | 'no_backups' | 'no_backup_dir' | 'error',
//     timestamp: <iso8601>,
//     threshold_hours: <number>,
//     dump?: { ... },           // present for stale + corrupt
//     error?: <string>,         // present for error
//     backup_dir: <string>,
//   }
//
// Threshold is configurable via `BACKUP_FRESHNESS_THRESHOLD_HOURS`
// (default 25 — daily cron at 02:00 UTC plus 1h slack).
//
// Why **only the local dump** and not S3/R2:
//   - the local file is the source of truth for "did the job actually
//     produce output", independent of upload state
//   - S3 LIST has latency + cost we don't want on a frequently-polled
//     health endpoint
//   - R2 lifecycle rules (when configured) can purge old objects, but
//     local pruning is governed by `BACKUP_LOCAL_RETENTION_DAYS` and
//     keeps at least the most recent dump for ages

const express = require('express');
const fsp = require('fs/promises');
const path = require('path');

const { logger } = require('../lib/logger');

const log = logger.child({ component: 'health-backup' });

const DEFAULT_THRESHOLD_HOURS = 25;

function resolveBackupDir() {
  return process.env.BACKUP_DIR || path.join(process.cwd(), 'var', 'backups');
}

function resolveThresholdHours() {
  const raw = process.env.BACKUP_FRESHNESS_THRESHOLD_HOURS;
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n <= 0) return DEFAULT_THRESHOLD_HOURS;
  return n;
}

/**
 * Find the newest `*.dump` file in `dir` by mtime. Returns null if the
 * directory exists but has zero `.dump` entries; throws ENOENT-flagged
 * error if the directory itself is missing.
 *
 * @param {string} dir
 * @returns {Promise<{ path: string, mtimeMs: number, sizeBytes: number } | null>}
 */
async function findNewestDump(dir) {
  let entries;
  try {
    entries = await fsp.readdir(dir);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      const wrapped = new Error(`backup dir does not exist: ${dir}`);
      wrapped.code = 'ENOENT';
      throw wrapped;
    }
    throw err;
  }
  let newest = null;
  for (const name of entries) {
    if (!name.endsWith('.dump')) continue;
    const p = path.join(dir, name);
    let st;
    try {
      st = await fsp.stat(p);
    } catch {
      continue; // race with prune; ignore
    }
    if (!st.isFile()) continue;
    if (!newest || st.mtimeMs > newest.mtimeMs) {
      newest = { path: p, mtimeMs: st.mtimeMs, sizeBytes: st.size };
    }
  }
  return newest;
}

async function buildBackupHealthPayload(deps = {}) {
  const now = deps.now ? deps.now() : new Date();
  const find = deps.findNewestDump || findNewestDump;
  const backupDir = deps.backupDir || resolveBackupDir();
  const thresholdHours = deps.thresholdHours ?? resolveThresholdHours();
  const timestamp = now.toISOString();

  let newest;
  try {
    newest = await find(backupDir);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return {
        status: 'no_backup_dir',
        timestamp,
        threshold_hours: thresholdHours,
        backup_dir: backupDir,
      };
    }
    return {
      status: 'error',
      timestamp,
      threshold_hours: thresholdHours,
      backup_dir: backupDir,
      error: String(err.message || err).slice(0, 200),
    };
  }

  if (!newest) {
    return {
      status: 'no_backups',
      timestamp,
      threshold_hours: thresholdHours,
      backup_dir: backupDir,
    };
  }

  const ageHours = (now.getTime() - newest.mtimeMs) / 3_600_000;
  const dump = {
    path: newest.path,
    age_hours: Number(ageHours.toFixed(3)),
    size_bytes: newest.sizeBytes,
    mtime: new Date(newest.mtimeMs).toISOString(),
  };

  // Zero-byte dumps are the exact silent-failure pattern that bit us
  // on 2026-05-05 (pg_dump auth error → empty output file).
  if (newest.sizeBytes === 0) {
    return {
      status: 'corrupt',
      timestamp,
      threshold_hours: thresholdHours,
      backup_dir: backupDir,
      dump,
    };
  }

  if (ageHours > thresholdHours) {
    return {
      status: 'stale',
      timestamp,
      threshold_hours: thresholdHours,
      backup_dir: backupDir,
      dump,
    };
  }

  return {
    status: 'ok',
    timestamp,
    threshold_hours: thresholdHours,
    backup_dir: backupDir,
    dump,
  };
}

const router = express.Router();

router.get('/', async (_req, res) => {
  let payload;
  try {
    payload = await buildBackupHealthPayload();
  } catch (err) {
    log.error({ err: { message: err.message } }, 'backup health probe failed');
    return res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      threshold_hours: resolveThresholdHours(),
      backup_dir: resolveBackupDir(),
      error: String(err.message || err).slice(0, 200),
    });
  }
  const httpStatus = payload.status === 'ok' ? 200 : 503;
  return res.status(httpStatus).json(payload);
});

module.exports = {
  router,
  buildBackupHealthPayload,
  // exposed for tests:
  findNewestDump,
  resolveBackupDir,
  resolveThresholdHours,
  DEFAULT_THRESHOLD_HOURS,
};
