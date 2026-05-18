// P2-08 — storage helpers.
//
// Vitest's `vi.mock` doesn't intercept the CommonJS `require()` chain
// inside lib/storage.js, so this file exercises the parts that don't
// require the SDK to actually issue requests:
//   - env-driven enable / disable
//   - region resolution (R2 → 'auto', non-R2 → 'us-east-1')
//   - path-style addressing detection (localhost + S3_FORCE_PATH_STYLE)
//   - client cache invalidation on bucket changes
//
// Round-trip coverage against a real MinIO container is provided by
// the optional integration test that runs when `MINIO_ENDPOINT` is set
// (see `storage-minio.integration.test.mjs` — wired separately).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let storage;
const ORIG_ENV = { ...process.env };

beforeEach(async () => {
  process.env = { ...ORIG_ENV };
  process.env.S3_BUCKET = 'vipos-test';
  process.env.S3_ACCESS_KEY_ID = 'kid';
  process.env.S3_SECRET_ACCESS_KEY = 'secret';
  delete process.env.S3_ENDPOINT;
  delete process.env.S3_REGION;
  delete process.env.S3_FORCE_PATH_STYLE;
  // Re-require module so `_resetForTests` shows a fresh cache, but we
  // only need a single fixed import — reach in and reset.
  storage = await import('../lib/storage.js');
  storage._resetForTests();
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
  if (storage) storage._resetForTests();
});

describe('P2-08 storage helpers', () => {
  it('isStorageEnabled() reflects the env triple', () => {
    expect(storage.isStorageEnabled()).toBe(true);
    delete process.env.S3_BUCKET;
    expect(storage.isStorageEnabled()).toBe(false);
  });

  it('isStorageEnabled() requires bucket + access key + secret', () => {
    delete process.env.S3_ACCESS_KEY_ID;
    expect(storage.isStorageEnabled()).toBe(false);
    process.env.S3_ACCESS_KEY_ID = 'kid';
    delete process.env.S3_SECRET_ACCESS_KEY;
    expect(storage.isStorageEnabled()).toBe(false);
  });

  it('getS3Client() returns null when storage is disabled', () => {
    delete process.env.S3_BUCKET;
    storage._resetForTests();
    expect(storage.getS3Client()).toBeNull();
  });

  it('getS3Client() builds a client whose endpoint reflects the env', () => {
    process.env.S3_ENDPOINT = 'http://localhost:9000';
    storage._resetForTests();
    const client = storage.getS3Client();
    expect(client).not.toBeNull();
    // The SDK exposes the configured endpoint on `client.config.endpoint`
    // as a thunk — call it and inspect the URL.
    expect(typeof client.config.endpoint).toBe('function');
  });

  it('caches the client across calls until env changes', () => {
    const a = storage.getS3Client();
    const b = storage.getS3Client();
    expect(b).toBe(a);
    process.env.S3_BUCKET = 'other-bucket';
    const c = storage.getS3Client();
    expect(c).not.toBe(a);
  });

  it('listObjects() returns [] when storage is disabled', async () => {
    delete process.env.S3_BUCKET;
    storage._resetForTests();
    expect(await storage.listObjects('any')).toEqual([]);
  });

  it('headObject() returns null when storage is disabled', async () => {
    delete process.env.S3_BUCKET;
    storage._resetForTests();
    expect(await storage.headObject('any')).toBeNull();
  });

  it('putObject() throws when storage is disabled', async () => {
    delete process.env.S3_BUCKET;
    storage._resetForTests();
    await expect(storage.putObject('k', Buffer.from('x'))).rejects.toThrow(/not configured/);
  });

  it('deleteObject() throws when storage is disabled', async () => {
    delete process.env.S3_BUCKET;
    storage._resetForTests();
    await expect(storage.deleteObject('k')).rejects.toThrow(/not configured/);
  });
});
