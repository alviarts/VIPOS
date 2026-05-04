/**
 * P2-08 — daily uploads sync.
 *
 * Walks the local `uploads/` directory and mirrors each file to S3
 * under `<s3-prefix>/uploads/<relative-path>`. Skips files that are
 * already in S3 with the same byte size, so successive runs only
 * upload the new / changed entries.
 *
 * Job payload (all optional):
 *
 *   {
 *     // Override local uploads root (default `apps/backend/uploads`).
 *     localDir?: string,
 *     // Override the S3 prefix root (default `vipos-backups`).
 *     s3Prefix?: string,
 *   }
 *
 * Returned summary:
 *
 *   {
 *     scanned: number,    // files walked locally
 *     uploaded: number,   // newly written to S3
 *     skipped: number,    // already present, same size
 *     totalBytes: number, // total bytes uploaded this run
 *   }
 *
 * Retention: out of scope for the worker — uploads are idempotent
 * mirrors, not snapshots. Versioning + lifecycle (e.g. R2 versioning)
 * is configured at the bucket level.
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { logger } = require('../lib/logger');
const defaultStorage = require('../lib/storage');

const log = logger.child({ component: 'uploads-backup' });

const DEFAULT_LOCAL_DIR = path.resolve(__dirname, '..', '..', 'uploads');
const DEFAULT_S3_PREFIX = 'vipos-backups';

/**
 * Recursively yield every file path under `dir` (relative to `dir`).
 *
 * @param {string} dir
 * @returns {AsyncGenerator<string>}
 */
async function* walk(dir, prefix = '') {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  for (const entry of entries) {
    const rel = prefix ? path.posix.join(prefix, entry.name) : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(abs, rel);
    } else if (entry.isFile()) {
      yield rel;
    }
  }
}

/**
 * Build a lookup of `relPath -> Size` for every object already in S3
 * under `<s3Prefix>/uploads/`.
 *
 * @param {object} storage
 * @param {string} s3Prefix
 */
async function fetchRemoteIndex(storage, s3Prefix) {
  const prefix = `${s3Prefix}/uploads/`;
  const objects = await storage.listObjects(prefix);
  const index = new Map();
  for (const obj of objects) {
    if (!obj.Key.startsWith(prefix)) continue;
    const rel = obj.Key.slice(prefix.length);
    index.set(rel, obj.Size);
  }
  return index;
}

/**
 * @param {{ data?: object }} job
 * @returns {Promise<object>}
 */
async function processUploadsBackup(job, deps = {}) {
  const data = job?.data || {};
  const localDir = data.localDir || process.env.UPLOADS_DIR || DEFAULT_LOCAL_DIR;
  const s3Prefix = data.s3Prefix || process.env.BACKUP_S3_PREFIX || DEFAULT_S3_PREFIX;
  const walker = deps.walk ?? walk;
  const storage = deps.storage ?? defaultStorage;

  if (!storage.isStorageEnabled()) {
    log.warn({ localDir }, 'uploads-backup: storage not configured, skipping');
    return { scanned: 0, uploaded: 0, skipped: 0, totalBytes: 0 };
  }

  // Existence check: don't fight uploads/ being absent in fresh dev
  // setups — just record zero work and move on.
  try {
    const st = await fsp.stat(localDir);
    if (!st.isDirectory()) {
      throw new Error(`uploads-backup: ${localDir} is not a directory`);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      log.info({ localDir }, 'uploads-backup: local dir missing, nothing to sync');
      return { scanned: 0, uploaded: 0, skipped: 0, totalBytes: 0 };
    }
    throw err;
  }

  const remote = await fetchRemoteIndex(storage, s3Prefix);

  let scanned = 0;
  let uploaded = 0;
  let skipped = 0;
  let totalBytes = 0;

  for await (const rel of walker(localDir)) {
    scanned += 1;
    const abs = path.join(localDir, rel);
    const st = await fsp.stat(abs);
    const remoteSize = remote.get(rel);
    if (remoteSize !== undefined && remoteSize === st.size) {
      skipped += 1;
      continue;
    }
    const key = `${s3Prefix}/uploads/${rel}`;
    const stream = fs.createReadStream(abs);
    await storage.putObject(key, stream, {
      contentType: guessContentType(rel),
    });
    uploaded += 1;
    totalBytes += st.size;
  }

  log.info({ scanned, uploaded, skipped, totalBytes }, 'uploads-backup complete');
  return { scanned, uploaded, skipped, totalBytes };
}

function guessContentType(rel) {
  const ext = path.extname(rel).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

module.exports = {
  processUploadsBackup,
  DEFAULT_LOCAL_DIR,
  DEFAULT_S3_PREFIX,
  // Exposed for tests:
  walk,
  fetchRemoteIndex,
};
