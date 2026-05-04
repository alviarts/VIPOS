// P2-05 PR-B — BullMQ worker → Prometheus counter wiring.
//
// Skipped automatically when REDIS_URL is unset so local dev without
// Redis still passes. CI provides Redis so this assertion runs there.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

const REDIS_URL = process.env.REDIS_URL;
const skipIfNoRedis = REDIS_URL ? describe : describe.skip;

let queueLib;
let metricsLib;
let attachWorkerMetrics;

beforeAll(async () => {
  await setupTestEnv();
  queueLib = require('../lib/queue');
  metricsLib = require('../lib/metrics');
  ({ attachWorkerMetrics } = require('../jobs'));
});

afterAll(async () => {
  if (queueLib) await queueLib.closeConnection();
  await teardownTestEnv();
});

beforeEach(() => {
  metricsLib.resetMetrics();
});

skipIfNoRedis('attachWorkerMetrics (requires REDIS_URL)', () => {
  it('records vipos_bullmq_jobs_total{status="completed"} on success', async () => {
    const queueName = 'bullmq-metrics-success';
    const queue = queueLib.createQueue(queueName);
    const worker = queueLib.createWorker(queueName, async () => ({ ok: true }));
    attachWorkerMetrics(worker, queueName);

    await queue.add('echo', { value: 1 });
    // Wait briefly for the worker to drain the queue.
    await new Promise((resolve) => {
      worker.once('completed', resolve);
    });
    // Yield once more so the counter listener (also on 'completed')
    // has a chance to run alongside the resolver.
    await new Promise((r) => setImmediate(r));

    const out = await metricsLib.renderMetrics();
    expect(out).toMatch(
      new RegExp(`vipos_bullmq_jobs_total\\{queue="${queueName}",status="completed"\\} 1`)
    );
    expect(out).toMatch(
      new RegExp(`vipos_bullmq_job_duration_seconds_count\\{[^}]*queue="${queueName}"[^}]*\\}`)
    );

    await worker.close();
    await queue.close();
  });

  it('records vipos_bullmq_jobs_total{status="failed"} on failure', async () => {
    const queueName = 'bullmq-metrics-failure';
    const queue = queueLib.createQueue(queueName, {
      defaultJobOptions: { attempts: 1, removeOnFail: false },
    });
    const worker = queueLib.createWorker(queueName, async () => {
      throw new Error('intentional failure');
    });
    attachWorkerMetrics(worker, queueName);

    await queue.add('boom', { value: 1 });
    await new Promise((resolve) => {
      worker.once('failed', resolve);
    });
    await new Promise((r) => setImmediate(r));

    const out = await metricsLib.renderMetrics();
    expect(out).toMatch(
      new RegExp(`vipos_bullmq_jobs_total\\{queue="${queueName}",status="failed"\\} 1`)
    );

    await worker.close();
    await queue.close();
  });
});
