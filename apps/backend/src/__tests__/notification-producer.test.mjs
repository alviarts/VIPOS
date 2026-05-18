// P2-04 PR-B notification producer tests.
//
// Strategy:
//   - When REDIS_URL is unset we still hit the endpoint and assert the
//     `sync: true` fallback shape — guarantees the API contract is
//     stable even on machines without a broker.
//   - When REDIS_URL is set we additionally:
//       1. Enqueue → assert response shape includes `enqueued: true`
//          and a job_id.
//       2. Run the processor inline (NOT via a background Worker) so
//          tests stay deterministic and fast.
//       3. Assert the audit_logs side effect was written.
//   - Validation tests (400 on bad input, 401/403 auth) run regardless
//     of broker state.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

const REDIS_URL = process.env.REDIS_URL;

let app;
let queryFn;
let runAsSystem;
let processNotification;

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  ({ query: queryFn, runAsSystem } = require('../db'));
  ({ processNotification } = require('../jobs/notification'));
});

afterAll(async () => {
  if (REDIS_URL) {
    const queueLib = require('../lib/queue');
    await queueLib.closeConnection();
  }
  await teardownTestEnv();
});

async function registerTenant(slug) {
  const r = await request(app)
    .post('/api/v1/tenant/register')
    .send({
      tenant_slug: slug,
      tenant_name: slug,
      tier: 'advance',
      admin_username: `${slug}_admin`,
      admin_password: 'rahasia123',
      admin_name: `${slug} Admin`,
    });
  expect(r.status).toBe(201);
  return { tenantId: r.body.tenant.id, userId: r.body.user.id, token: r.body.token };
}

describe('POST /api/v1/notifications', () => {
  it('401 — unauthenticated request blocked', async () => {
    const res = await request(app)
      .post('/api/v1/notifications')
      .send({ kind: 'push', recipient: 'u-1' });
    expect(res.status).toBe(401);
  });

  it('403 — cashier role blocked', async () => {
    const t = await registerTenant('notif-cashier');
    await runAsSystem(() => queryFn(`UPDATE users SET role = 'cashier' WHERE id = $1`, [t.userId]));
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'notif-cashier_admin', password: 'rahasia123' });
    expect(login.status).toBe(200);
    const res = await request(app)
      .post('/api/v1/notifications')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ kind: 'push', recipient: 'u-1' });
    expect(res.status).toBe(403);
  });

  it('400 — rejects unsupported kind', async () => {
    const t = await registerTenant('notif-badkind');
    const res = await request(app)
      .post('/api/v1/notifications')
      .set('Authorization', `Bearer ${t.token}`)
      .send({ kind: 'fax', recipient: 'u-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/kind/i);
  });

  it('400 — rejects missing recipient', async () => {
    const t = await registerTenant('notif-norecipient');
    const res = await request(app)
      .post('/api/v1/notifications')
      .set('Authorization', `Bearer ${t.token}`)
      .send({ kind: 'push' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/recipient/i);
  });

  it(
    REDIS_URL
      ? '202 — enqueues a push notification and worker writes audit_logs row'
      : '202 — sync fallback when REDIS_URL unset',
    async () => {
      const t = await registerTenant('notif-happy');
      const res = await request(app)
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${t.token}`)
        .send({
          kind: 'push',
          recipient: 'device-token-abc',
          payload: { title: 'Hi', body: 'Hello world' },
        });
      expect(res.status).toBe(202);

      if (!REDIS_URL) {
        expect(res.body).toMatchObject({ enqueued: false, sync: true });
        return;
      }

      expect(res.body).toMatchObject({
        enqueued: true,
        queue: 'notification',
      });
      expect(res.body.job_id).toBeTruthy();

      // Run the processor inline against the enqueued job. This proves the
      // contract end-to-end without spinning up a background Worker.
      const queueLib = require('../lib/queue');
      const queue = queueLib.getOrCreateQueue(queueLib.QUEUE_NAMES.NOTIFICATION);
      const job = await queue.getJob(res.body.job_id);
      expect(job).toBeTruthy();
      const result = await processNotification(job);
      expect(result).toMatchObject({ ok: true, kind: 'push', recipient: 'device-token-abc' });
      expect(result.audit_id).toBeTruthy();

      // Side effect: an audit_logs row landed for this tenant scoped to
      // entity='notification'.
      const audit = await runAsSystem(() =>
        queryFn(
          `SELECT entity, action, after_json FROM audit_logs
           WHERE id = $1 AND tenant_id = $2`,
          [result.audit_id, t.tenantId]
        )
      );
      expect(audit.rows[0]).toMatchObject({
        entity: 'notification',
        action: 'send',
      });
      expect(audit.rows[0].after_json).toMatchObject({
        kind: 'push',
        recipient: 'device-token-abc',
      });
    }
  );
});

describe('processNotification (unit)', () => {
  it('rejects missing tenant_id', async () => {
    await expect(processNotification({ data: { kind: 'push', recipient: 'x' } })).rejects.toThrow(
      /tenant_id/
    );
  });
  it('rejects unsupported kind', async () => {
    await expect(
      processNotification({ data: { tenant_id: 1, kind: 'fax', recipient: 'x' } })
    ).rejects.toThrow(/kind/);
  });
  it('rejects missing recipient', async () => {
    await expect(processNotification({ data: { tenant_id: 1, kind: 'push' } })).rejects.toThrow(
      /recipient/
    );
  });
});
