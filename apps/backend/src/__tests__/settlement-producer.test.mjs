// P2-04 PR-C settlement reconcile producer tests.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

const REDIS_URL = process.env.REDIS_URL;

let app;
let queryFn;
let runAsSystem;
let processSettlement;
let normaliseProviders;

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  ({ query: queryFn, runAsSystem } = require('../db'));
  ({ processSettlement, normaliseProviders } = require('../jobs/settlement'));
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

describe('POST /api/v1/marketplace/settlement/reconcile', () => {
  it('401 — unauthenticated request blocked', async () => {
    const res = await request(app).post('/api/v1/marketplace/settlement/reconcile').send({});
    expect(res.status).toBe(401);
  });

  it('403 — cashier role blocked', async () => {
    const t = await registerTenant('settle-cashier');
    await runAsSystem(() => queryFn(`UPDATE users SET role = 'cashier' WHERE id = $1`, [t.userId]));
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'settle-cashier_admin', password: 'rahasia123' });
    expect(login.status).toBe(200);
    const res = await request(app)
      .post('/api/v1/marketplace/settlement/reconcile')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('400 — invalid date format', async () => {
    const t = await registerTenant('settle-baddate');
    const res = await request(app)
      .post('/api/v1/marketplace/settlement/reconcile')
      .set('Authorization', `Bearer ${t.token}`)
      .send({ from: '2025/01/01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/from/i);
  });

  it('400 — unsupported provider', async () => {
    const t = await registerTenant('settle-badprov');
    const res = await request(app)
      .post('/api/v1/marketplace/settlement/reconcile')
      .set('Authorization', `Bearer ${t.token}`)
      .send({ providers: ['ubereats'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/provider tidak didukung/i);
  });

  it(
    REDIS_URL
      ? '202 — enqueues + idempotent on same range; processor writes audit row'
      : '202 — sync fallback when REDIS_URL unset',
    async () => {
      const t = await registerTenant('settle-happy');
      const body = { from: '2025-01-01', to: '2025-01-31', providers: ['gofood', 'grabfood'] };
      const res1 = await request(app)
        .post('/api/v1/marketplace/settlement/reconcile')
        .set('Authorization', `Bearer ${t.token}`)
        .send(body);
      expect(res1.status).toBe(202);

      if (!REDIS_URL) {
        expect(res1.body).toMatchObject({ enqueued: false, sync: true });
        return;
      }
      expect(res1.body).toMatchObject({ enqueued: true, queue: 'settlement' });

      // Second call with the same range/providers should dedupe at the
      // BullMQ jobId level — same job_id reported back.
      const res2 = await request(app)
        .post('/api/v1/marketplace/settlement/reconcile')
        .set('Authorization', `Bearer ${t.token}`)
        .send(body);
      expect(res2.status).toBe(202);
      expect(res2.body.job_id).toBe(res1.body.job_id);

      // Process the job inline.
      const queueLib = require('../lib/queue');
      const queue = queueLib.getOrCreateQueue(queueLib.QUEUE_NAMES.SETTLEMENT);
      const job = await queue.getJob(res1.body.job_id);
      expect(job).toBeTruthy();
      const result = await processSettlement(job);
      expect(result).toMatchObject({
        ok: true,
        external_diff: 0,
      });
      expect(result.audit_id).toBeTruthy();
      expect(result.totals).toMatchObject({
        gross: expect.any(Number),
        mdr: expect.any(Number),
        net: expect.any(Number),
      });

      const audit = await runAsSystem(() =>
        queryFn(
          `SELECT entity, action, after_json FROM audit_logs
           WHERE id = $1 AND tenant_id = $2`,
          [result.audit_id, t.tenantId]
        )
      );
      expect(audit.rows[0]).toMatchObject({
        entity: 'settlement',
        action: 'reconcile',
      });
      expect(audit.rows[0].after_json).toMatchObject({
        from: '2025-01-01',
        to: '2025-01-31',
        providers: ['gofood', 'grabfood'],
      });
    }
  );
});

describe('normaliseProviders (unit)', () => {
  it('null → null (means all providers)', () => {
    expect(normaliseProviders(null)).toBeNull();
    expect(normaliseProviders(undefined)).toBeNull();
  });
  it('throws on non-array', () => {
    expect(() => normaliseProviders('gofood')).toThrow(/array/i);
  });
  it('throws on unknown provider', () => {
    expect(() => normaliseProviders(['ubereats'])).toThrow(/unsupported/i);
  });
  it('dedupes + sorts', () => {
    expect(normaliseProviders(['grabfood', 'gofood', 'gofood'])).toEqual(['gofood', 'grabfood']);
  });
});

describe('processSettlement (unit)', () => {
  it('rejects missing tenant_id', async () => {
    await expect(processSettlement({ data: {} })).rejects.toThrow(/tenant_id/);
  });
});
