// P2-08 PR-B — restore-test BullMQ processor.
//
// Mirrors the DI test pattern PR-A locked in for db-backup: pass
// fakes for every external surface (storage, pg_restore runner,
// CREATE/DROP DATABASE executor, sanity-query runner) via the `deps`
// bag. We deliberately do NOT use `vi.mock(...)` because the
// processor module is CJS and `vi.mock` does not intercept
// `require()` calls inside it — see HANDOFF-P2-08-PR-B.md §4.4.
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as restoreTest from '../jobs/restore-test.js';

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIG_ENV };
  // Default: enabled + admin url + a bucket name so the gates pass.
  process.env.BACKUP_RESTORE_TEST_ENABLED = '1';
  process.env.BACKUP_S3_PREFIX = 'vipos-bk';
  process.env.RESTORE_TEST_DATABASE_URL =
    'postgresql://admin:secret@localhost:5432/postgres?sslmode=disable';
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

function makeFakeStorage({
  enabled = true,
  objects = [
    {
      Key: 'vipos-bk/daily/2026/05/vipos-2026-05-04T020000Z.dump',
      Size: 4096,
      LastModified: new Date('2026-05-04T02:00:01Z'),
    },
  ],
} = {}) {
  return {
    isStorageEnabled: () => enabled,
    listObjects: vi.fn(async (_prefix) => objects),
    getObjectStream: vi.fn(async (_key) => Readable.from(Buffer.alloc(4096))),
    putObject: vi.fn(async () => undefined),
    headObject: vi.fn(async () => null),
    deleteObject: vi.fn(async () => undefined),
    getS3Client: () => null,
    _resetForTests: () => undefined,
  };
}

function makeRecordingPsqlExec() {
  const calls = [];
  const fn = vi.fn(async (connectionString, sql) => {
    calls.push({ connectionString, sql });
  });
  fn.calls = calls;
  return fn;
}

describe('P2-08 PR-B restore-test', () => {
  it('happy path: streams the latest daily dump, restores into a fresh sandbox, runs sanity queries, drops the sandbox', async () => {
    const storage = makeFakeStorage();
    const psqlExec = makeRecordingPsqlExec();
    const runPgRestore = vi.fn(async () => undefined);
    const runSanityQueries = vi.fn(async (sandboxUrl) => ({
      users: 12,
      tenants: 3,
      audit_logs: 410,
      _prisma_migrations: 27,
      audit_logs_max_created_at: '2026-05-03T23:59:59.000Z',
      _capturedUrl: sandboxUrl,
    }));

    const out = await restoreTest.processRestoreTest(
      { data: {} },
      {
        storage,
        runPgRestore,
        psqlExec,
        runSanityQueries,
        now: () => new Date('2026-05-04T04:00:00Z'),
        randomSuffix: () => 'abc123',
      }
    );

    expect(out.dumpKey).toBe('vipos-bk/daily/2026/05/vipos-2026-05-04T020000Z.dump');
    expect(out.dumpSizeBytes).toBe(4096);
    expect(out.sandbox).toBe('vipos_restore_test_20260504T040000Z_abc123');
    expect(out.counts.users).toBe(12);
    expect(out.counts.audit_logs).toBe(410);
    expect(out.counts._prisma_migrations).toBe(27);
    expect(out.counts.audit_logs_max_created_at).toBe('2026-05-03T23:59:59.000Z');

    // listObjects targeted the daily prefix derived from BACKUP_S3_PREFIX.
    expect(storage.listObjects).toHaveBeenCalledWith('vipos-bk/daily/');
    // pg_restore was invoked against a URL pointing at the sandbox DB
    // (not the admin DB) and pointed at the streamed tmp file.
    expect(runPgRestore).toHaveBeenCalledTimes(1);
    const [restoreUrl, restorePath] = runPgRestore.mock.calls[0];
    expect(restoreUrl).toMatch(/\/vipos_restore_test_20260504T040000Z_abc123/);
    expect(restorePath).toMatch(/dump\.dump$/);
    // CREATE then DROP — and DROP is the *last* psqlExec call so we
    // never leave the sandbox behind.
    const createIdx = psqlExec.calls.findIndex((c) =>
      c.sql.startsWith('CREATE DATABASE "vipos_restore_test_')
    );
    const dropIdx = psqlExec.calls.findIndex((c) =>
      c.sql.startsWith('DROP DATABASE IF EXISTS "vipos_restore_test_')
    );
    expect(createIdx).toBeGreaterThanOrEqual(0);
    expect(dropIdx).toBeGreaterThan(createIdx);
    expect(dropIdx).toBe(psqlExec.calls.length - 1);
    // The CREATE/DROP commands ran against the admin URL, not the
    // sandbox URL — otherwise we'd be trying to drop the DB we're
    // currently connected to.
    expect(psqlExec.calls[createIdx].connectionString).toContain('/postgres');
    expect(psqlExec.calls[dropIdx].connectionString).toContain('/postgres');
  });

  it('idempotency: running the processor twice in a row leaves no dangling sandbox state', async () => {
    const storage = makeFakeStorage();
    const psqlExec = makeRecordingPsqlExec();
    const runPgRestore = vi.fn(async () => undefined);
    const runSanityQueries = vi.fn(async () => ({
      users: 1,
      tenants: 1,
      audit_logs: 0,
      _prisma_migrations: 1,
      audit_logs_max_created_at: null,
    }));

    let counter = 0;
    const deps = {
      storage,
      runPgRestore,
      psqlExec,
      runSanityQueries,
      // Two different timestamps + suffixes so each run picks a unique
      // sandbox name even when invoked back-to-back.
      now: () => new Date('2026-05-04T04:00:00Z'),
      randomSuffix: () => `r${++counter}`,
    };

    const first = await restoreTest.processRestoreTest({ data: {} }, deps);
    const second = await restoreTest.processRestoreTest({ data: {} }, deps);

    expect(first.sandbox).not.toBe(second.sandbox);
    expect(first.sandbox).toBe('vipos_restore_test_20260504T040000Z_r1');
    expect(second.sandbox).toBe('vipos_restore_test_20260504T040000Z_r2');

    // Each run should issue exactly one CREATE + one DROP for its own
    // sandbox. That gives 4 psql calls total — no leaks, no overlap.
    const creates = psqlExec.calls.filter((c) => c.sql.startsWith('CREATE DATABASE'));
    const drops = psqlExec.calls.filter((c) => c.sql.startsWith('DROP DATABASE IF EXISTS'));
    expect(creates).toHaveLength(2);
    expect(drops).toHaveLength(2);
    expect(creates[0].sql).toContain('"vipos_restore_test_20260504T040000Z_r1"');
    expect(creates[1].sql).toContain('"vipos_restore_test_20260504T040000Z_r2"');
    expect(drops[0].sql).toContain('"vipos_restore_test_20260504T040000Z_r1"');
    expect(drops[1].sql).toContain('"vipos_restore_test_20260504T040000Z_r2"');
  });

  it('failure path: pg_restore reject bubbles up so BullMQ marks the job failed (and sandbox is still dropped)', async () => {
    const storage = makeFakeStorage();
    const psqlExec = makeRecordingPsqlExec();
    const runPgRestore = vi.fn(async () => {
      throw new Error('pg_restore exited with code 1: corrupt dump');
    });
    const runSanityQueries = vi.fn(async () => ({}));

    await expect(
      restoreTest.processRestoreTest(
        { data: {} },
        {
          storage,
          runPgRestore,
          psqlExec,
          runSanityQueries,
          now: () => new Date('2026-05-04T04:00:00Z'),
          randomSuffix: () => 'fail01',
        }
      )
    ).rejects.toThrow(/pg_restore exited with code 1: corrupt dump/);

    // Even on failure, the sandbox must be dropped — otherwise the
    // staging Postgres accumulates orphan databases over time.
    const drops = psqlExec.calls.filter((c) => c.sql.startsWith('DROP DATABASE IF EXISTS'));
    expect(drops).toHaveLength(1);
    expect(drops[0].sql).toContain('"vipos_restore_test_20260504T040000Z_fail01"');
    // Sanity queries should never have run because pg_restore failed
    // first.
    expect(runSanityQueries).not.toHaveBeenCalled();
  });

  it('skipped: returns { skipped: "disabled" } and never touches storage when BACKUP_RESTORE_TEST_ENABLED is unset', async () => {
    delete process.env.BACKUP_RESTORE_TEST_ENABLED;
    const storage = makeFakeStorage();
    const psqlExec = makeRecordingPsqlExec();
    const runPgRestore = vi.fn(async () => undefined);
    const runSanityQueries = vi.fn(async () => ({}));

    const out = await restoreTest.processRestoreTest(
      { data: {} },
      { storage, runPgRestore, psqlExec, runSanityQueries }
    );

    expect(out).toEqual({ skipped: 'disabled' });
    expect(storage.listObjects).not.toHaveBeenCalled();
    expect(storage.getObjectStream).not.toHaveBeenCalled();
    expect(runPgRestore).not.toHaveBeenCalled();
    expect(psqlExec.calls).toHaveLength(0);
  });

  it('skipped: returns { skipped: "no-storage" } when storage is not configured even with the env flag set', async () => {
    const storage = makeFakeStorage({ enabled: false });
    const out = await restoreTest.processRestoreTest(
      { data: {} },
      {
        storage,
        runPgRestore: vi.fn(),
        psqlExec: makeRecordingPsqlExec(),
        runSanityQueries: vi.fn(),
      }
    );
    expect(out).toEqual({ skipped: 'no-storage' });
  });

  it('skipped: returns { skipped: "no-admin-url" } when RESTORE_TEST_DATABASE_URL is unset', async () => {
    delete process.env.RESTORE_TEST_DATABASE_URL;
    const storage = makeFakeStorage();
    const out = await restoreTest.processRestoreTest(
      { data: {} },
      {
        storage,
        runPgRestore: vi.fn(),
        psqlExec: makeRecordingPsqlExec(),
        runSanityQueries: vi.fn(),
      }
    );
    expect(out).toEqual({ skipped: 'no-admin-url' });
  });

  it('throws when no daily dump exists yet (so on-call sees the alert before they assume a clean restore)', async () => {
    const storage = makeFakeStorage({ objects: [] });
    await expect(
      restoreTest.processRestoreTest(
        { data: {} },
        {
          storage,
          runPgRestore: vi.fn(),
          psqlExec: makeRecordingPsqlExec(),
          runSanityQueries: vi.fn(),
          now: () => new Date('2026-05-04T04:00:00Z'),
          randomSuffix: () => 'noop00',
        }
      )
    ).rejects.toThrow(/no daily dumps found under "vipos-bk\/daily\/"/);
  });

  it('picks the freshest daily dump by LastModified even when listObjects returns them out of order', async () => {
    const storage = makeFakeStorage({
      objects: [
        {
          Key: 'vipos-bk/daily/2026/05/old.dump',
          Size: 1,
          LastModified: new Date('2026-04-01T00:00:00Z'),
        },
        {
          Key: 'vipos-bk/daily/2026/05/newest.dump',
          Size: 99,
          LastModified: new Date('2026-05-04T02:00:01Z'),
        },
        {
          Key: 'vipos-bk/daily/2026/05/middle.dump',
          Size: 50,
          LastModified: new Date('2026-05-01T02:00:00Z'),
        },
      ],
    });
    const out = await restoreTest.processRestoreTest(
      { data: {} },
      {
        storage,
        runPgRestore: vi.fn(async () => undefined),
        psqlExec: makeRecordingPsqlExec(),
        runSanityQueries: vi.fn(async () => ({})),
        now: () => new Date('2026-05-04T04:00:00Z'),
        randomSuffix: () => 'pick01',
      }
    );
    expect(out.dumpKey).toBe('vipos-bk/daily/2026/05/newest.dump');
  });
});

describe('P2-08 PR-B restore-test helpers', () => {
  it('formatTimestamp + buildSandboxName produce a safe Postgres identifier', () => {
    const name = restoreTest.buildSandboxName(new Date('2026-05-04T04:00:00Z'), () => 'abc123');
    expect(name).toBe('vipos_restore_test_20260504T040000Z_abc123');
    expect(() => restoreTest.assertSafeDbName(name)).not.toThrow();
  });

  it('swapDbName preserves query string + auth + port', () => {
    const swapped = restoreTest.swapDbName(
      'postgresql://admin:secret@db.staging.example.com:5432/postgres?sslmode=require',
      'vipos_restore_test_x'
    );
    const url = new URL(swapped);
    expect(url.pathname).toBe('/vipos_restore_test_x');
    expect(url.searchParams.get('sslmode')).toBe('require');
    expect(url.username).toBe('admin');
    expect(url.hostname).toBe('db.staging.example.com');
    expect(url.port).toBe('5432');
  });

  it('assertSafeDbName rejects names with quotes or semicolons', () => {
    expect(() => restoreTest.assertSafeDbName('ok_name_1')).not.toThrow();
    expect(() => restoreTest.assertSafeDbName('bad"name')).toThrow();
    expect(() => restoreTest.assertSafeDbName('drop;table')).toThrow();
    expect(() => restoreTest.assertSafeDbName('')).toThrow();
    expect(() => restoreTest.assertSafeDbName('1starts_with_digit')).toThrow();
  });
});
