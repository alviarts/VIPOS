// P2-04 PR-B email producer tests. Same shape as notification-producer.test.mjs.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

const REDIS_URL = process.env.REDIS_URL;

let app;
let queryFn;
let runAsSystem;
let processEmail;

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  ({ query: queryFn, runAsSystem } = require('../db'));
  ({ processEmail } = require('../jobs/email'));
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

describe('POST /api/v1/email/send', () => {
  it('401 — unauthenticated request blocked', async () => {
    const res = await request(app)
      .post('/api/v1/email/send')
      .send({ to: 'a@b.co', subject: 's', body: 'b' });
    expect(res.status).toBe(401);
  });

  it('403 — cashier role blocked', async () => {
    const t = await registerTenant('email-cashier');
    await runAsSystem(() => queryFn(`UPDATE users SET role = 'cashier' WHERE id = $1`, [t.userId]));
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'email-cashier_admin', password: 'rahasia123' });
    expect(login.status).toBe(200);
    const res = await request(app)
      .post('/api/v1/email/send')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ to: 'a@b.co', subject: 's', body: 'b' });
    expect(res.status).toBe(403);
  });

  it('400 — rejects malformed email address', async () => {
    const t = await registerTenant('email-bademail');
    const res = await request(app)
      .post('/api/v1/email/send')
      .set('Authorization', `Bearer ${t.token}`)
      .send({ to: 'not-an-email', subject: 's', body: 'b' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('400 — rejects missing subject', async () => {
    const t = await registerTenant('email-nosubject');
    const res = await request(app)
      .post('/api/v1/email/send')
      .set('Authorization', `Bearer ${t.token}`)
      .send({ to: 'a@b.co', body: 'b' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/subject/i);
  });

  it(
    REDIS_URL
      ? '202 — enqueues an email and worker writes audit_logs row'
      : '202 — sync fallback when REDIS_URL unset',
    async () => {
      const t = await registerTenant('email-happy');
      const res = await request(app)
        .post('/api/v1/email/send')
        .set('Authorization', `Bearer ${t.token}`)
        .send({
          to: 'recipient@example.test',
          subject: 'Welcome',
          body: 'Hello!',
          metadata: { template_id: 'welcome', locale: 'id-ID' },
        });
      expect(res.status).toBe(202);

      if (!REDIS_URL) {
        expect(res.body).toMatchObject({ enqueued: false, sync: true });
        return;
      }

      expect(res.body).toMatchObject({ enqueued: true, queue: 'email' });
      expect(res.body.job_id).toBeTruthy();

      const queueLib = require('../lib/queue');
      const queue = queueLib.getOrCreateQueue(queueLib.QUEUE_NAMES.EMAIL);
      const job = await queue.getJob(res.body.job_id);
      expect(job).toBeTruthy();
      const result = await processEmail(job);
      expect(result).toMatchObject({ ok: true, to: 'recipient@example.test', subject: 'Welcome' });
      expect(result.audit_id).toBeTruthy();

      const audit = await runAsSystem(() =>
        queryFn(
          `SELECT entity, action, after_json FROM audit_logs
           WHERE id = $1 AND tenant_id = $2`,
          [result.audit_id, t.tenantId]
        )
      );
      expect(audit.rows[0]).toMatchObject({
        entity: 'email',
        action: 'send',
      });
      expect(audit.rows[0].after_json).toMatchObject({
        to: 'recipient@example.test',
        subject: 'Welcome',
      });
    }
  );
});

describe('processEmail (unit)', () => {
  it('rejects missing tenant_id', async () => {
    await expect(processEmail({ data: { to: 'a@b.co', subject: 's', body: 'b' } })).rejects.toThrow(
      /tenant_id/
    );
  });
  it('rejects malformed email', async () => {
    await expect(
      processEmail({ data: { tenant_id: 1, to: 'invalid', subject: 's', body: 'b' } })
    ).rejects.toThrow(/email/);
  });
  it('rejects non-string body', async () => {
    await expect(
      processEmail({ data: { tenant_id: 1, to: 'a@b.co', subject: 's', body: 123 } })
    ).rejects.toThrow(/body/);
  });
});
