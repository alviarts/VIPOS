// Disk-usage health probe.
//
// `GET /health/disk` checks the **free-space ratio** of the filesystem
// that holds `BACKUP_DIR` (default `./var/backups`) and reports 503
// when the disk crosses a configurable usage threshold. Pairs with
// `/health/backup`: that one catches "the job stopped producing
// fresh dumps", this one catches "the disk filled up so the next job
// will fail or truncate."
//
// Why this endpoint exists:
//   The 2026-05-05 incident response noted the prod VPS at ~70%
//   utilisation post-cleanup, with `dist.pre-deploy-*` snapshots, pm2
//   logs, BullMQ Redis volumes, and daily Postgres dumps all
//   competing for the same root volume. A monitor polling this probe
//   alerts long before any of those subsystems silently truncates or
//   fails.
//
// Response shape (200 ok):
//   {
//     status: 'ok',
//     timestamp: <iso8601>,
//     mount: <absolute-or-relative path>,
//     threshold_percent: <number>,
//     fs: {
//       total_bytes: <number>,
//       free_bytes: <number>,
//       used_bytes: <number>,
//       used_percent: <number>,
//     },
//   }
//
// Response shape (503 over threshold / inaccessible):
//   {
//     status: 'high_usage' | 'no_mount' | 'error',
//     timestamp: <iso8601>,
//     mount: <string>,
//     threshold_percent: <number>,
//     fs?: { ... },          // present for high_usage
//     error?: <string>,      // present for error
//   }
//
// Threshold is configurable via `DISK_USAGE_THRESHOLD_PERCENT`
// (default 90). Mount is configurable via `DISK_HEALTH_MOUNT`
// (default = whatever `BACKUP_DIR` resolves to, since that is the
// path the backup pipeline writes to and therefore the canonical
// "is there room for tonight's dump" question).
//
// Why **the backup-dir mount** instead of `/`:
//   The probe's purpose is to predict whether the next backup will
//   succeed. On VPSes where /var/backups is its own volume this is
//   the right question. When /var/backups lives on the root volume
//   the answer is identical, so we lose nothing by being precise.

const express = require('express');
const fsp = require('fs/promises');
const path = require('path');

const { logger } = require('../lib/logger');

const log = logger.child({ component: 'health-disk' });

const DEFAULT_THRESHOLD_PERCENT = 90;

function resolveMount() {
  return (
    process.env.DISK_HEALTH_MOUNT ||
    process.env.BACKUP_DIR ||
    path.join(process.cwd(), 'var', 'backups')
  );
}

function resolveThresholdPercent() {
  const raw = process.env.DISK_USAGE_THRESHOLD_PERCENT;
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n <= 0 || n > 100) {
    return DEFAULT_THRESHOLD_PERCENT;
  }
  return n;
}

/**
 * Return filesystem usage for the volume that holds `mount`. Uses
 * `fs.statfs` (Node 18+) — returns `null` if the mount path itself
 * is missing. Throws on other errors so callers can decide to wrap
 * them as `error` payloads vs. surface them.
 *
 * Returns: { total_bytes, free_bytes, used_bytes, used_percent } | null
 *
 * @param {string} mount
 */
async function readFsUsage(mount) {
  let stats;
  try {
    stats = await fsp.statfs(mount);
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
  // bavail = blocks available to non-root processes; bsize = block
  // size in bytes. Use bavail (not bfree) because that is what the
  // backup process actually has to play with.
  const totalBytes = Number(stats.blocks) * Number(stats.bsize);
  const freeBytes = Number(stats.bavail) * Number(stats.bsize);
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
  return {
    total_bytes: totalBytes,
    free_bytes: freeBytes,
    used_bytes: usedBytes,
    used_percent: Number(usedPercent.toFixed(2)),
  };
}

async function buildDiskHealthPayload(deps = {}) {
  const now = deps.now ? deps.now() : new Date();
  const read = deps.readFsUsage || readFsUsage;
  const mount = deps.mount || resolveMount();
  const thresholdPercent = deps.thresholdPercent ?? resolveThresholdPercent();
  const timestamp = now.toISOString();

  let fs;
  try {
    fs = await read(mount);
  } catch (err) {
    return {
      status: 'error',
      timestamp,
      mount,
      threshold_percent: thresholdPercent,
      error: String(err.message || err).slice(0, 200),
    };
  }

  if (!fs) {
    return {
      status: 'no_mount',
      timestamp,
      mount,
      threshold_percent: thresholdPercent,
    };
  }

  if (fs.used_percent >= thresholdPercent) {
    return {
      status: 'high_usage',
      timestamp,
      mount,
      threshold_percent: thresholdPercent,
      fs,
    };
  }

  return {
    status: 'ok',
    timestamp,
    mount,
    threshold_percent: thresholdPercent,
    fs,
  };
}

const router = express.Router();

router.get('/', async (_req, res) => {
  let payload;
  try {
    payload = await buildDiskHealthPayload();
  } catch (err) {
    log.error({ err: { message: err.message } }, 'disk health probe failed');
    return res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      mount: resolveMount(),
      threshold_percent: resolveThresholdPercent(),
      error: String(err.message || err).slice(0, 200),
    });
  }
  const httpStatus = payload.status === 'ok' ? 200 : 503;
  return res.status(httpStatus).json(payload);
});

module.exports = {
  router,
  buildDiskHealthPayload,
  // exposed for tests:
  readFsUsage,
  resolveMount,
  resolveThresholdPercent,
  DEFAULT_THRESHOLD_PERCENT,
};
