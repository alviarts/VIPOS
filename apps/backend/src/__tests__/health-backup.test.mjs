// Backup-freshness health probe (`/api/health/backup`).
//
// Drives the route and the lower-level `buildBackupHealthPayload` with
// fakes for the filesystem so we don't depend on a real backup dir.
// Covers all five outcomes (ok / stale / corrupt / no_backups /
// no_backup_dir) plus an HTTP-level smoke test through the mounted app.
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as healthBackup from '../routes/health-backup.js';
import { buildApp } from '../app.js';

const ORIG_ENV = { ...process.env };
let tmpDir;

beforeEach(async () => {
  process.env = { ...ORIG_ENV };
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'vipos-bf-'));
});

afterEach(async () => {
  process.env = { ...ORIG_ENV };
  if (tmpDir) await fsp.rm(tmpDir, { recursive: true, force: true });
});

async function writeDump(name, sizeBytes, mtimeMs) {
  const p = path.join(tmpDir, name);
  await fsp.writeFile(p, Buffer.alloc(sizeBytes));
  if (mtimeMs !== undefined) {
    await fsp.utimes(p, new Date(mtimeMs), new Date(mtimeMs));
  }
  return p;
}

describe('buildBackupHealthPayload', () => {
  it('reports `ok` for a fresh non-empty dump', async () => {
    const now = new Date('2026-05-05T03:00:00Z');
    await writeDump('vipos-2026-05-05T020000Z.dump', 4096, now.getTime() - 60 * 60 * 1000);
    const payload = await healthBackup.buildBackupHealthPayload({
      now: () => now,
      backupDir: tmpDir,
      thresholdHours: 25,
    });
    expect(payload.status).toBe('ok');
    expect(payload.threshold_hours).toBe(25);
    expect(payload.dump.size_bytes).toBe(4096);
    expect(payload.dump.age_hours).toBeGreaterThan(0.99);
    expect(payload.dump.age_hours).toBeLessThan(1.01);
  });

  it('reports `corrupt` for a zero-byte dump (the 2026-05-05 silent-failure pattern)', async () => {
    const now = new Date('2026-05-05T03:00:00Z');
    await writeDump('vipos-2026-05-05T020000Z.dump', 0, now.getTime() - 30 * 60 * 1000);
    const payload = await healthBackup.buildBackupHealthPayload({
      now: () => now,
      backupDir: tmpDir,
      thresholdHours: 25,
    });
    expect(payload.status).toBe('corrupt');
    expect(payload.dump.size_bytes).toBe(0);
  });

  it('reports `stale` when the newest dump is older than threshold', async () => {
    const now = new Date('2026-05-05T03:00:00Z');
    // 30h old > 25h threshold
    await writeDump('vipos-2026-05-03T210000Z.dump', 4096, now.getTime() - 30 * 60 * 60 * 1000);
    const payload = await healthBackup.buildBackupHealthPayload({
      now: () => now,
      backupDir: tmpDir,
      thresholdHours: 25,
    });
    expect(payload.status).toBe('stale');
    expect(payload.dump.age_hours).toBeGreaterThan(25);
  });

  it('reports `no_backups` when the dir exists but has no .dump files', async () => {
    await fsp.writeFile(path.join(tmpDir, 'README'), 'placeholder');
    const payload = await healthBackup.buildBackupHealthPayload({
      now: () => new Date('2026-05-05T03:00:00Z'),
      backupDir: tmpDir,
      thresholdHours: 25,
    });
    expect(payload.status).toBe('no_backups');
    expect(payload.dump).toBeUndefined();
  });

  it('reports `no_backup_dir` when the directory does not exist', async () => {
    const missing = path.join(tmpDir, 'does-not-exist');
    const payload = await healthBackup.buildBackupHealthPayload({
      now: () => new Date('2026-05-05T03:00:00Z'),
      backupDir: missing,
      thresholdHours: 25,
    });
    expect(payload.status).toBe('no_backup_dir');
    expect(payload.backup_dir).toBe(missing);
  });

  it('picks the newest dump when multiple are present', async () => {
    const now = new Date('2026-05-05T03:00:00Z');
    await writeDump('old.dump', 1000, now.getTime() - 26 * 60 * 60 * 1000);
    await writeDump('newer.dump', 2000, now.getTime() - 2 * 60 * 60 * 1000);
    await writeDump('newest.dump', 3000, now.getTime() - 30 * 60 * 1000);
    const payload = await healthBackup.buildBackupHealthPayload({
      now: () => now,
      backupDir: tmpDir,
      thresholdHours: 25,
    });
    expect(payload.status).toBe('ok');
    expect(payload.dump.size_bytes).toBe(3000);
    expect(payload.dump.path).toContain('newest.dump');
  });

  it('respects BACKUP_FRESHNESS_THRESHOLD_HOURS env var', async () => {
    process.env.BACKUP_FRESHNESS_THRESHOLD_HOURS = '2';
    const now = new Date('2026-05-05T03:00:00Z');
    // 5h old → fresh under default 25h, stale under env=2h
    await writeDump('vipos.dump', 1000, now.getTime() - 5 * 60 * 60 * 1000);
    expect(healthBackup.resolveThresholdHours()).toBe(2);
    const payload = await healthBackup.buildBackupHealthPayload({
      now: () => now,
      backupDir: tmpDir,
    });
    expect(payload.status).toBe('stale');
    expect(payload.threshold_hours).toBe(2);
  });

  it('falls back to default 25h when the env override is invalid', () => {
    process.env.BACKUP_FRESHNESS_THRESHOLD_HOURS = 'not-a-number';
    expect(healthBackup.resolveThresholdHours()).toBe(healthBackup.DEFAULT_THRESHOLD_HOURS);
  });
});

describe('GET /api/health/backup (HTTP integration)', () => {
  let server;
  let baseUrl;

  beforeEach(async () => {
    process.env.BACKUP_DIR = tmpDir;
    const app = buildApp({ rateLimitEnabled: false, morganEnabled: false });
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    if (server) await new Promise((r) => server.close(r));
  });

  function fetchPath(p) {
    return new Promise((resolve, reject) => {
      const req = http.request(baseUrl + p, { method: 'GET' }, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject);
      req.end();
    });
  }

  it('returns 200 + status:ok for a fresh dump under both /api and /api/v1', async () => {
    const fresh = Date.now() - 30 * 60 * 1000;
    await writeDump('vipos.dump', 4096, fresh);

    const v1 = await fetchPath('/api/v1/health/backup');
    expect(v1.status).toBe(200);
    expect(JSON.parse(v1.body).status).toBe('ok');

    const legacy = await fetchPath('/api/health/backup');
    expect(legacy.status).toBe(200);
    expect(JSON.parse(legacy.body).status).toBe('ok');
  });

  it('returns 503 + status:corrupt for a zero-byte dump', async () => {
    await writeDump('vipos.dump', 0, Date.now() - 30 * 60 * 1000);
    const res = await fetchPath('/api/v1/health/backup');
    expect(res.status).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('corrupt');
    expect(body.dump.size_bytes).toBe(0);
  });

  it('returns 503 + status:stale when newest dump is past threshold', async () => {
    await writeDump('vipos.dump', 4096, Date.now() - 30 * 60 * 60 * 1000);
    const res = await fetchPath('/api/v1/health/backup');
    expect(res.status).toBe(503);
    expect(JSON.parse(res.body).status).toBe('stale');
  });

  it('returns 503 + status:no_backups for empty dir', async () => {
    const res = await fetchPath('/api/v1/health/backup');
    expect(res.status).toBe(503);
    expect(JSON.parse(res.body).status).toBe('no_backups');
  });
});
