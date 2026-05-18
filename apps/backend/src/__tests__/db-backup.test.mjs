// P2-08 — db-backup BullMQ processor.
//
// Drives the processor with a fake storage module + fake pg_dump
// (passed via `deps`) so we can verify the daily/weekly/monthly key
// shapes, retention pruning, and storage skip behaviour without
// spawning a real Postgres or hitting S3.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as dbBackup from '../jobs/db-backup.js';

const ORIG_ENV = { ...process.env };
let tmpDir;

beforeEach(async () => {
  process.env = { ...ORIG_ENV };
  process.env.DIRECT_URL = 'postgresql://test:test@localhost:5432/x';
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'vipos-bk-'));
});

afterEach(async () => {
  process.env = { ...ORIG_ENV };
  if (tmpDir) await fsp.rm(tmpDir, { recursive: true, force: true });
});

function fakePgDump() {
  return async (_url, outPath) => {
    await fsp.writeFile(outPath, Buffer.alloc(2048));
  };
}

function makeFakeStorage({ enabled = true } = {}) {
  const calls = [];
  return {
    isStorageEnabled: () => enabled,
    putObject: async (key, body, opts) => {
      calls.push({ key, opts });
    },
    listObjects: async () => [],
    headObject: async () => null,
    getObjectStream: async () => null,
    deleteObject: async () => undefined,
    getS3Client: () => null,
    _resetForTests: () => undefined,
    _calls: calls,
  };
}

describe('P2-08 db-backup', () => {
  it('writes the dump locally and skips S3 upload when storage is disabled', async () => {
    const storage = makeFakeStorage({ enabled: false });
    const out = await dbBackup.processDbBackup(
      { data: { localDir: tmpDir, skipUpload: false } },
      { runPgDump: fakePgDump(), now: () => new Date('2026-05-04T02:00:00Z'), storage }
    );
    expect(out.uploadedKey).toBeNull();
    expect(out.dumpSizeBytes).toBe(2048);
    expect(fs.existsSync(out.dumpPath)).toBe(true);
    expect(storage._calls).toEqual([]);
  });

  it('uploads to daily/YYYY/MM/<file>.dump on a regular Monday', async () => {
    const storage = makeFakeStorage();
    const out = await dbBackup.processDbBackup(
      { data: { localDir: tmpDir, s3Prefix: 'vipos-bk' } },
      { runPgDump: fakePgDump(), now: () => new Date('2026-05-04T02:00:00Z'), storage } // Monday
    );
    expect(out.uploadedKey).toMatch(/^vipos-bk\/daily\/2026\/05\/vipos-2026-05-04T020000Z\.dump$/);
    expect(out.copiedTo).toEqual([]);
    expect(storage._calls).toHaveLength(1);
    expect(storage._calls[0].opts.metadata['created-at-utc']).toBe('2026-05-04T02:00:00.000Z');
    expect(storage._calls[0].opts.metadata['dump-format']).toBe('pg-custom');
  });

  it('also writes weekly/<YYYY>-W<NN>.dump on Sundays', async () => {
    const storage = makeFakeStorage();
    const out = await dbBackup.processDbBackup(
      { data: { localDir: tmpDir, s3Prefix: 'vipos-bk' } },
      { runPgDump: fakePgDump(), now: () => new Date('2026-05-03T02:00:00Z'), storage } // Sunday
    );
    expect(out.copiedTo).toEqual(['vipos-bk/weekly/2026-W18.dump']);
    expect(storage._calls).toHaveLength(2);
  });

  it('also writes monthly/<YYYY>-MM.dump on the first of the month', async () => {
    const storage = makeFakeStorage();
    const out = await dbBackup.processDbBackup(
      { data: { localDir: tmpDir, s3Prefix: 'vipos-bk' } },
      { runPgDump: fakePgDump(), now: () => new Date('2026-06-01T02:00:00Z'), storage } // Mon, 1st
    );
    expect(out.copiedTo).toEqual(['vipos-bk/monthly/2026-06.dump']);
  });

  it('writes both weekly + monthly aliases when 1st falls on a Sunday', async () => {
    const storage = makeFakeStorage();
    const out = await dbBackup.processDbBackup(
      { data: { localDir: tmpDir, s3Prefix: 'vipos-bk' } },
      { runPgDump: fakePgDump(), now: () => new Date('2026-02-01T02:00:00Z'), storage } // Sun, 1st
    );
    expect(out.copiedTo).toEqual([
      'vipos-bk/weekly/2026-W05.dump',
      'vipos-bk/monthly/2026-02.dump',
    ]);
  });

  it('honours skipUpload even when storage is configured', async () => {
    const storage = makeFakeStorage();
    const out = await dbBackup.processDbBackup(
      { data: { localDir: tmpDir, skipUpload: true } },
      { runPgDump: fakePgDump(), now: () => new Date('2026-05-04T02:00:00Z'), storage }
    );
    expect(out.uploadedKey).toBeNull();
    expect(storage._calls).toEqual([]);
  });

  it('prunes local dumps older than retentionDays', async () => {
    const storage = makeFakeStorage({ enabled: false });
    // Plant 3 stale files + 1 fresh one.
    const oldName1 = path.join(tmpDir, 'vipos-old-1.dump');
    const oldName2 = path.join(tmpDir, 'vipos-old-2.dump');
    const oldName3 = path.join(tmpDir, 'vipos-old-3.dump');
    const fresh = path.join(tmpDir, 'vipos-fresh.dump');
    await fsp.writeFile(oldName1, '');
    await fsp.writeFile(oldName2, '');
    await fsp.writeFile(oldName3, '');
    await fsp.writeFile(fresh, '');
    const longAgo = new Date(Date.now() - 30 * 86400 * 1000);
    for (const p of [oldName1, oldName2, oldName3]) {
      await fsp.utimes(p, longAgo, longAgo);
    }
    const out = await dbBackup.processDbBackup(
      { data: { localDir: tmpDir, localRetentionDays: 14, skipUpload: true } },
      { runPgDump: fakePgDump(), now: () => new Date('2026-05-04T02:00:00Z'), storage }
    );
    expect(out.prunedLocal).toBe(3);
    expect(fs.existsSync(fresh)).toBe(true);
    expect(fs.existsSync(oldName1)).toBe(false);
  });

  it('formatTimestamp emits POSIX-friendly UTC stamps', () => {
    expect(dbBackup.formatTimestamp(new Date('2026-05-04T18:04:20.123Z'))).toBe(
      '2026-05-04T180420Z'
    );
  });

  it('isoWeek matches the ISO 8601 calendar', () => {
    expect(dbBackup.isoWeek(new Date('2026-01-04T00:00:00Z'))).toBe(1);
    expect(dbBackup.isoWeek(new Date('2026-12-28T00:00:00Z'))).toBe(53);
  });
});
