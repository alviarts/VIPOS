// P2-04 PR-A queue + worker foundation tests.
//
// Strategy:
//   - Tests are skipped automatically if REDIS_URL is not set so local
//     development without Redis still passes.
//   - Each test creates its own queue/worker pair so we never leak state
//     between tests.
//   - We assert on three layers:
//     1. Factory output (queue name, default job options).
//     2. Round-trip enqueue → process via Worker → completed event.
//     3. Audit-retention job actually deletes old rows from `audit_logs`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

const REDIS_URL = process.env.REDIS_URL;
const skipIfNoRedis = REDIS_URL ? describe : describe.skip;

let queueLib;
let processAuditRetention;
let runAsSystem;
let queryFn;
let logAuditWithTenant;

beforeAll(async () => {
  await setupTestEnv();
  queueLib = require('../lib/queue');
  ({ processAuditRetention } = require('../jobs/audit-retention'));
  ({ runAsSystem, query: queryFn } = require('../db'));
  ({ logAuditWithTenant } = require('../lib/audit'));
});

afterAll(async () => {
  // Always close in case a test forgot to.
  if (queueLib) await queueLib.closeConnection();
  await teardownTestEnv();
});

describe('queue factory (no Redis required)', () => {
  it('exports the canonical queue name enum verbatim from the spec', () => {
    expect(queueLib.QUEUE_NAMES).toMatchObject({
      NOTIFICATION: 'notification',
      EMAIL: 'email',
      REPORT: 'report',
      SETTLEMENT: 'settlement',
      MARKETPLACE_WEBHOOK: 'marketplace-webhook',
      IMPORT_EXPORT: 'import-export',
      AUDIT_RETENTION: 'audit-retention',
    });
  });

  it('default job options match the documented retry policy', () => {
    expect(queueLib.DEFAULT_JOB_OPTIONS).toMatchObject({
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
    expect(queueLib.DEFAULT_JOB_OPTIONS.removeOnFail).toBe(false);
  });

  it('isQueueEnabled() reflects REDIS_URL', () => {
    expect(queueLib.isQueueEnabled()).toBe(Boolean(REDIS_URL));
  });

  it('createQueue throws without a name', () => {
    expect(() => queueLib.createQueue('')).toThrow(/name is required/);
  });

  it('createWorker throws without a processor', () => {
    expect(() => queueLib.createWorker('x')).toThrow(/processor must be a function/);
  });

  it('safeEnqueue is a no-op when REDIS_URL is unset', async () => {
    if (REDIS_URL) {
      // We can't simulate an unset URL here without tearing down the
      // module cache, so just sanity-check the contract: with REDIS_URL
      // set, safeEnqueue must accept a Queue instance.
      const q = queueLib.createQueue('x-test-noop');
      const out = await queueLib.safeEnqueue(q, 'any', {});
      expect(out).toBeTruthy();
      await q.close();
    } else {
      const out = await queueLib.safeEnqueue(null, 'any', {});
      expect(out).toBeNull();
    }
  });
});

skipIfNoRedis('queue + worker round-trip (requires REDIS_URL)', () => {
  it('worker processes a job and emits completed event', async () => {
    const { Queue } = require('bullmq');
    const { QueueEvents } = require('bullmq');
    expect(queueLib.createQueue('rt-test')).toBeInstanceOf(Queue);

    let handled = null;
    const queue = queueLib.createQueue('rt-test');
    const events = new QueueEvents('rt-test', { connection: queueLib.getConnection() });
    await events.waitUntilReady();
    const worker = queueLib.createWorker('rt-test', async (job) => {
      handled = job.data;
      return { ok: true, echo: job.data.value };
    });

    const job = await queue.add('echo', { value: 42 });
    const completed = new Promise((resolve, reject) => {
      events.on('completed', ({ jobId, returnvalue }) => {
        if (jobId === job.id) resolve(returnvalue);
      });
      events.on('failed', ({ jobId, failedReason }) => {
        if (jobId === job.id) reject(new Error(failedReason));
      });
    });
    const result = await completed;
    expect(handled).toEqual({ value: 42 });
    // BullMQ may serialize returnvalue to a JSON string when it crosses
    // the redis pubsub boundary; tolerate both shapes.
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    expect(parsed).toEqual({ ok: true, echo: 42 });

    await worker.close();
    await events.close();
    await queue.close();
    // Drain Redis so other tests start clean.
    await queueLib.getConnection().del('bull:rt-test:*');
  });

  it('audit-retention processor deletes rows older than retentionDays', async () => {
    // Seed: 1 row "old" (2 days ago), 1 row "fresh".
    const oldId = await logAuditWithTenant({
      tenant_id: 1,
      user_id: 1,
      entity: 'session',
      action: 'login',
    });
    const freshId = await logAuditWithTenant({
      tenant_id: 1,
      user_id: 1,
      entity: 'session',
      action: 'login',
    });
    await runAsSystem(() =>
      queryFn(`UPDATE audit_logs SET created_at = now() - interval '2 days' WHERE id = $1`, [oldId])
    );

    const result = await processAuditRetention({ data: { retentionDays: 1 } });
    expect(result.retentionDays).toBe(1);
    expect(result.deleted).toBeGreaterThanOrEqual(1);

    const after = await runAsSystem(() =>
      queryFn(`SELECT id FROM audit_logs WHERE id IN ($1, $2)`, [oldId, freshId])
    );
    const survivingIds = after.rows.map((r) => r.id);
    expect(survivingIds).not.toContain(oldId);
    expect(survivingIds).toContain(freshId);
  });

  it('audit-retention processor rejects invalid retentionDays', async () => {
    await expect(processAuditRetention({ data: { retentionDays: 0 } })).rejects.toThrow(
      /Invalid retentionDays/
    );
    await expect(processAuditRetention({ data: { retentionDays: 'abc' } })).rejects.toThrow(
      /Invalid retentionDays/
    );
  });

  it('startWorkers + scheduler upserts the recurring audit-retention job', async () => {
    const { startWorkers, AUDIT_RETENTION_SCHEDULER } = require('../jobs');
    const stop = await startWorkers({ scheduleRecurring: true });
    try {
      const queue = queueLib.createQueue(queueLib.QUEUE_NAMES.AUDIT_RETENTION);
      const schedulers = await queue.getJobSchedulers();
      const ours = schedulers.find((s) => s.key === AUDIT_RETENTION_SCHEDULER);
      expect(ours).toBeTruthy();
      expect(ours.pattern).toBe('15 3 * * *');
      await queue.close();
    } finally {
      await stop();
    }
  });
});
