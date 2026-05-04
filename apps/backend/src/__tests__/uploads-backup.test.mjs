// P2-08 — uploads-backup BullMQ processor.
//
// Drives the processor with a fake storage module via `deps.storage`
// so the diff logic is exercised without hitting S3 / MinIO. Verifies:
//   - skips files that match remote size
//   - re-uploads files whose remote size differs
//   - uploads files missing from remote
//   - is a no-op when storage is disabled
//   - tolerates a missing local uploads/ dir
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as uploadsBackup from '../jobs/uploads-backup.js';

let tmpDir;
const ORIG_ENV = { ...process.env };

beforeEach(async () => {
  process.env = { ...ORIG_ENV };
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'vipos-up-'));
});

afterEach(async () => {
  process.env = { ...ORIG_ENV };
  if (tmpDir) await fsp.rm(tmpDir, { recursive: true, force: true });
});

async function seed(layout) {
  for (const [rel, contents] of Object.entries(layout)) {
    const abs = path.join(tmpDir, rel);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, contents);
  }
}

function makeFakeStorage({ enabled = true, remote = [] } = {}) {
  const calls = [];
  return {
    isStorageEnabled: () => enabled,
    putObject: async (key, body, opts) => {
      calls.push({ key, opts });
    },
    listObjects: async () => remote,
    headObject: async () => null,
    getObjectStream: async () => null,
    deleteObject: async () => undefined,
    getS3Client: () => null,
    _resetForTests: () => undefined,
    _calls: calls,
  };
}

describe('P2-08 uploads-backup', () => {
  it('uploads every file when remote is empty', async () => {
    const storage = makeFakeStorage();
    await seed({
      'products/a.png': 'aaaa',
      'products/b.png': 'bbbb',
      'category-icons/c.png': 'cc',
    });
    const out = await uploadsBackup.processUploadsBackup(
      { data: { localDir: tmpDir, s3Prefix: 'vipos-bk' } },
      { storage }
    );
    expect(out.scanned).toBe(3);
    expect(out.uploaded).toBe(3);
    expect(out.skipped).toBe(0);
    expect(out.totalBytes).toBe(10);
    const keys = storage._calls.map((c) => c.key).sort();
    expect(keys).toEqual([
      'vipos-bk/uploads/category-icons/c.png',
      'vipos-bk/uploads/products/a.png',
      'vipos-bk/uploads/products/b.png',
    ]);
  });

  it('skips files that match remote size', async () => {
    const storage = makeFakeStorage({
      remote: [
        { Key: 'vipos-bk/uploads/products/a.png', Size: 4, LastModified: new Date() },
        { Key: 'vipos-bk/uploads/products/b.png', Size: 4, LastModified: new Date() },
      ],
    });
    await seed({
      'products/a.png': 'aaaa',
      'products/b.png': 'BBBB',
      'products/c.png': 'cccc',
    });
    const out = await uploadsBackup.processUploadsBackup(
      { data: { localDir: tmpDir, s3Prefix: 'vipos-bk' } },
      { storage }
    );
    expect(out.scanned).toBe(3);
    expect(out.uploaded).toBe(1);
    expect(out.skipped).toBe(2);
    expect(storage._calls[0].key).toBe('vipos-bk/uploads/products/c.png');
  });

  it('re-uploads when local size differs from remote', async () => {
    const storage = makeFakeStorage({
      remote: [{ Key: 'vipos-bk/uploads/products/a.png', Size: 4, LastModified: new Date() }],
    });
    await seed({ 'products/a.png': 'aaaaaaa' });
    const out = await uploadsBackup.processUploadsBackup(
      { data: { localDir: tmpDir, s3Prefix: 'vipos-bk' } },
      { storage }
    );
    expect(out.scanned).toBe(1);
    expect(out.uploaded).toBe(1);
    expect(out.skipped).toBe(0);
  });

  it('returns zeroes and never calls putObject when storage is disabled', async () => {
    const storage = makeFakeStorage({ enabled: false });
    await seed({ 'products/a.png': 'aaaa' });
    const out = await uploadsBackup.processUploadsBackup(
      { data: { localDir: tmpDir, s3Prefix: 'vipos-bk' } },
      { storage }
    );
    expect(out).toEqual({ scanned: 0, uploaded: 0, skipped: 0, totalBytes: 0 });
    expect(storage._calls).toEqual([]);
  });

  it('tolerates a missing local uploads dir as a no-op', async () => {
    const storage = makeFakeStorage();
    const ghostDir = path.join(tmpDir, 'does-not-exist');
    const out = await uploadsBackup.processUploadsBackup(
      { data: { localDir: ghostDir, s3Prefix: 'vipos-bk' } },
      { storage }
    );
    expect(out).toEqual({ scanned: 0, uploaded: 0, skipped: 0, totalBytes: 0 });
    expect(storage._calls).toEqual([]);
  });

  it('walk() yields nested files using POSIX separators', async () => {
    await seed({
      'a/b/c.txt': 'x',
      'top.txt': 'y',
    });
    const out = [];
    for await (const rel of uploadsBackup.walk(tmpDir)) {
      out.push(rel);
    }
    out.sort();
    expect(out).toEqual(['a/b/c.txt', 'top.txt']);
  });
});
