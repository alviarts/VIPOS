// P2-08 — retention helpers (isoWeek + pruneLocal) covered separately
// from the full processor flow so we keep an independent regression
// safety net for the retention math.
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tmpDir;
let dbBackup;

beforeEach(async () => {
  dbBackup = await import('../jobs/db-backup.js');
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'vipos-rt-'));
});

afterEach(async () => {
  if (tmpDir) await fsp.rm(tmpDir, { recursive: true, force: true });
});

describe('P2-08 retention', () => {
  it('isoWeek emits 1 for 2026-01-04', () => {
    expect(dbBackup.isoWeek(new Date('2026-01-04T00:00:00Z'))).toBe(1);
  });

  it('isoWeek emits the correct value for a known Sunday', () => {
    // 2026-05-03 is the Sunday of ISO week 18.
    expect(dbBackup.isoWeek(new Date('2026-05-03T00:00:00Z'))).toBe(18);
  });

  it('pruneLocal returns 0 when the dir does not exist', async () => {
    const ghost = path.join(tmpDir, 'no-such');
    expect(await dbBackup.pruneLocal(ghost, 14)).toBe(0);
  });

  it('pruneLocal ignores non-.dump files', async () => {
    const old = path.join(tmpDir, 'unrelated.txt');
    await fsp.writeFile(old, '');
    const longAgo = new Date(Date.now() - 30 * 86400 * 1000);
    await fsp.utimes(old, longAgo, longAgo);
    expect(await dbBackup.pruneLocal(tmpDir, 14)).toBe(0);
    // Untouched.
    expect((await fsp.stat(old)).isFile()).toBe(true);
  });

  it('pruneLocal removes only stale .dump files', async () => {
    const stale = path.join(tmpDir, 'old.dump');
    const fresh = path.join(tmpDir, 'fresh.dump');
    await fsp.writeFile(stale, '');
    await fsp.writeFile(fresh, '');
    const longAgo = new Date(Date.now() - 30 * 86400 * 1000);
    await fsp.utimes(stale, longAgo, longAgo);
    expect(await dbBackup.pruneLocal(tmpDir, 14)).toBe(1);
    await expect(fsp.stat(fresh)).resolves.toBeTruthy();
    await expect(fsp.stat(stale)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('formatTimestamp is filename-safe (no colons or dots)', () => {
    const stamp = dbBackup.formatTimestamp(new Date('2026-05-04T18:04:20.999Z'));
    expect(stamp).not.toMatch(/[:.]/);
    expect(stamp).toBe('2026-05-04T180420Z');
  });
});
