// Disk-usage health probe (`/api/health/disk`).
//
// Drives `buildDiskHealthPayload` with a fake `readFsUsage` so we
// don't depend on the runner's actual disk state. Covers the four
// outcomes (ok / high_usage / no_mount / error) plus an HTTP-level
// smoke through the mounted app.
import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as healthDisk from '../routes/health-disk.js';
import { buildApp } from '../app.js';

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIG_ENV };
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

function fakeFsAt(usedPercent) {
  // Pick a billion-byte total so the math reads naturally in test
  // failure messages: 100 GB total, X% used.
  const total = 100 * 1_000_000_000;
  const used = Math.round((usedPercent / 100) * total);
  const free = total - used;
  return {
    total_bytes: total,
    free_bytes: free,
    used_bytes: used,
    used_percent: Number(usedPercent.toFixed(2)),
  };
}

describe('buildDiskHealthPayload', () => {
  it('reports `ok` when usage is under the threshold', async () => {
    const payload = await healthDisk.buildDiskHealthPayload({
      mount: '/var/backups/vipos',
      thresholdPercent: 90,
      readFsUsage: async () => fakeFsAt(70),
    });
    expect(payload.status).toBe('ok');
    expect(payload.fs.used_percent).toBe(70);
    expect(payload.threshold_percent).toBe(90);
    expect(payload.mount).toBe('/var/backups/vipos');
  });

  it('reports `high_usage` when usage meets or exceeds the threshold', async () => {
    const payload = await healthDisk.buildDiskHealthPayload({
      mount: '/var/backups/vipos',
      thresholdPercent: 90,
      readFsUsage: async () => fakeFsAt(91.5),
    });
    expect(payload.status).toBe('high_usage');
    expect(payload.fs.used_percent).toBe(91.5);
  });

  it('returns `high_usage` exactly at the threshold (>= comparison)', async () => {
    const payload = await healthDisk.buildDiskHealthPayload({
      mount: '/var/backups/vipos',
      thresholdPercent: 90,
      readFsUsage: async () => fakeFsAt(90),
    });
    expect(payload.status).toBe('high_usage');
  });

  it('reports `no_mount` when readFsUsage returns null', async () => {
    const payload = await healthDisk.buildDiskHealthPayload({
      mount: '/does-not-exist',
      thresholdPercent: 90,
      readFsUsage: async () => null,
    });
    expect(payload.status).toBe('no_mount');
    expect(payload.fs).toBeUndefined();
  });

  it('reports `error` when readFsUsage throws', async () => {
    const payload = await healthDisk.buildDiskHealthPayload({
      mount: '/dev/null',
      thresholdPercent: 90,
      readFsUsage: async () => {
        const e = new Error('EIO: simulated read failure');
        e.code = 'EIO';
        throw e;
      },
    });
    expect(payload.status).toBe('error');
    expect(payload.error).toContain('EIO');
  });
});

describe('resolveMount + resolveThresholdPercent', () => {
  it('resolveMount prefers DISK_HEALTH_MOUNT, then BACKUP_DIR, then default', () => {
    delete process.env.DISK_HEALTH_MOUNT;
    delete process.env.BACKUP_DIR;
    expect(healthDisk.resolveMount()).toMatch(/var\/backups$/);

    process.env.BACKUP_DIR = '/var/backups/vipos';
    expect(healthDisk.resolveMount()).toBe('/var/backups/vipos');

    process.env.DISK_HEALTH_MOUNT = '/srv/foo';
    expect(healthDisk.resolveMount()).toBe('/srv/foo');
  });

  it('resolveThresholdPercent honours valid env override', () => {
    process.env.DISK_USAGE_THRESHOLD_PERCENT = '85';
    expect(healthDisk.resolveThresholdPercent()).toBe(85);
  });

  it('resolveThresholdPercent falls back to default for invalid values', () => {
    process.env.DISK_USAGE_THRESHOLD_PERCENT = 'NaN';
    expect(healthDisk.resolveThresholdPercent()).toBe(healthDisk.DEFAULT_THRESHOLD_PERCENT);

    process.env.DISK_USAGE_THRESHOLD_PERCENT = '0';
    expect(healthDisk.resolveThresholdPercent()).toBe(healthDisk.DEFAULT_THRESHOLD_PERCENT);

    process.env.DISK_USAGE_THRESHOLD_PERCENT = '150';
    expect(healthDisk.resolveThresholdPercent()).toBe(healthDisk.DEFAULT_THRESHOLD_PERCENT);
  });
});

describe('GET /api/health/disk (HTTP integration)', () => {
  let server;
  let baseUrl;

  beforeEach(async () => {
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

  // The HTTP integration tests need a real `statfs` call to land
  // somewhere, so we point the probe at the test runner's own tmp
  // dir (always exists, always has free space). We can't easily
  // stub `readFsUsage` from the route side without exposing test
  // hooks in production code, so this just verifies the wiring +
  // the `ok` response shape under both `/api/v1` and the legacy
  // alias. The unit tests above exhaustively cover the failure modes.

  it('returns 200 + status:ok under both /api and /api/v1', async () => {
    // Point the probe at a known-existing directory so `statfs` lands.
    // Threshold 99% is so generous that any reasonable runner stays
    // under it; the unit tests above cover threshold edge cases.
    process.env.DISK_HEALTH_MOUNT = '/tmp';
    process.env.DISK_USAGE_THRESHOLD_PERCENT = '99';
    const v1 = await fetchPath('/api/v1/health/disk');
    expect(v1.status).toBe(200);
    const v1Body = JSON.parse(v1.body);
    expect(v1Body.status).toBe('ok');
    expect(typeof v1Body.fs.used_percent).toBe('number');
    expect(typeof v1Body.fs.total_bytes).toBe('number');

    const legacy = await fetchPath('/api/health/disk');
    expect(legacy.status).toBe(200);
    expect(JSON.parse(legacy.body).status).toBe('ok');
  });
});
