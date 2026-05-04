// P2-04 PR-B marketplace-webhook ingress tests.
//
// Covers:
//   - 400 unsupported provider.
//   - 400 missing event_id.
//   - 404 unknown tenant_slug.
//   - 401 invalid HMAC signature when MARKETPLACE_WEBHOOK_SECRET set.
//   - 202 enqueue path + idempotency: same event_id twice resolves to
//     the same BullMQ jobId, and a second worker run does not duplicate
//     the audit row.
//   - Worker dedupe: if two distinct jobs somehow land for the same
//     fingerprint, the second processor call returns `duplicate: true`
//     and reuses the original audit_id.
import crypto from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

const REDIS_URL = process.env.REDIS_URL;

let app;
let queryFn;
let runAsSystem;
let processMarketplaceWebhook;
let fingerprint;

beforeAll(async () => {
  await setupTestEnv();
  delete process.env.MARKETPLACE_WEBHOOK_SECRET;
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  ({ query: queryFn, runAsSystem } = require('../db'));
  ({ processMarketplaceWebhook, fingerprint } = require('../jobs/marketplace-webhook'));
});

afterAll(async () => {
  if (REDIS_URL) {
    const queueLib = require('../lib/queue');
    await queueLib.closeConnection();
  }
  delete process.env.MARKETPLACE_WEBHOOK_SECRET;
  await teardownTestEnv();
});

beforeEach(() => {
  // Default: no signature verification. Individual tests opt in.
  delete process.env.MARKETPLACE_WEBHOOK_SECRET;
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

describe('POST /api/v1/marketplace-webhook/:tenant_slug/:provider', () => {
  it('400 — unsupported provider', async () => {
    const t = await registerTenant('mw-provider');
    const res = await request(app)
      .post(`/api/v1/marketplace-webhook/mw-provider/uberfood`)
      .send({ event_id: 'evt-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/provider/i);
    void t;
  });

  it('404 — unknown tenant_slug', async () => {
    const res = await request(app)
      .post('/api/v1/marketplace-webhook/does-not-exist/gofood')
      .send({ event_id: 'evt-1' });
    expect(res.status).toBe(404);
  });

  it('400 — missing event_id', async () => {
    const t = await registerTenant('mw-noeventid');
    const res = await request(app)
      .post(`/api/v1/marketplace-webhook/mw-noeventid/gofood`)
      .send({ event_type: 'order.created' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/event_id/i);
    void t;
  });

  it('401 — invalid HMAC signature when secret configured', async () => {
    process.env.MARKETPLACE_WEBHOOK_SECRET = 'topsecret';
    const t = await registerTenant('mw-badhmac');
    const res = await request(app)
      .post(`/api/v1/marketplace-webhook/mw-badhmac/gofood`)
      .set('X-Marketplace-Signature', 'sha256=deadbeef')
      .send({ event_id: 'evt-1' });
    expect(res.status).toBe(401);
    void t;
  });

  it('202 — accepts request with valid HMAC signature', async () => {
    process.env.MARKETPLACE_WEBHOOK_SECRET = 'topsecret';
    const t = await registerTenant('mw-goodhmac');
    const body = { event_id: 'evt-hmac-1', event_type: 'order.created', data: {} };
    const sig = crypto.createHmac('sha256', 'topsecret').update(JSON.stringify(body)).digest('hex');
    const res = await request(app)
      .post(`/api/v1/marketplace-webhook/mw-goodhmac/gofood`)
      .set('X-Marketplace-Signature', `sha256=${sig}`)
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res.status).toBe(202);
    if (REDIS_URL) {
      expect(res.body).toMatchObject({ enqueued: true, queue: 'marketplace-webhook' });
    } else {
      expect(res.body).toMatchObject({ enqueued: false, sync: true });
    }
    void t;
  });

  it(
    REDIS_URL
      ? '202 — enqueues + idempotent: same event_id twice → identical jobId; processor side-effect runs once'
      : '202 — sync fallback when REDIS_URL unset',
    async () => {
      const t = await registerTenant('mw-happy');
      const payload = {
        event_id: 'evt-9000',
        event_type: 'order.created',
        data: { order_id: 'ORDR-1', total: 50000 },
      };

      const r1 = await request(app)
        .post(`/api/v1/marketplace-webhook/mw-happy/gofood`)
        .send(payload);
      expect(r1.status).toBe(202);

      if (!REDIS_URL) {
        expect(r1.body).toMatchObject({ enqueued: false, sync: true });
        return;
      }

      const expectedJobId = `${t.tenantId}:${fingerprint('gofood', 'evt-9000')}`;
      expect(r1.body).toMatchObject({
        enqueued: true,
        job_id: expectedJobId,
        queue: 'marketplace-webhook',
      });

      // Send again — BullMQ should dedupe by jobId at the broker level.
      const r2 = await request(app)
        .post(`/api/v1/marketplace-webhook/mw-happy/gofood`)
        .send(payload);
      expect(r2.status).toBe(202);
      expect(r2.body.job_id).toBe(expectedJobId);

      // Run the processor inline against the job and verify the audit row.
      const queueLib = require('../lib/queue');
      const queue = queueLib.getOrCreateQueue(queueLib.QUEUE_NAMES.MARKETPLACE_WEBHOOK);
      const job = await queue.getJob(expectedJobId);
      expect(job).toBeTruthy();
      const result1 = await processMarketplaceWebhook(job);
      expect(result1).toMatchObject({
        ok: true,
        provider: 'gofood',
        event_id: 'evt-9000',
        duplicate: false,
      });
      expect(result1.audit_id).toBeTruthy();

      // Re-running the processor on the same job (replay scenario) must
      // detect the duplicate and reuse the original audit_id.
      const result2 = await processMarketplaceWebhook(job);
      expect(result2).toMatchObject({
        ok: true,
        provider: 'gofood',
        event_id: 'evt-9000',
        duplicate: true,
        audit_id: result1.audit_id,
      });

      // Exactly one audit row exists for the (provider, event_id) pair.
      const audit = await runAsSystem(() =>
        queryFn(
          `SELECT id FROM audit_logs
             WHERE entity = 'marketplace-webhook'
               AND entity_id = $1`,
          [fingerprint('gofood', 'evt-9000')]
        )
      );
      expect(audit.rows.length).toBe(1);
    }
  );
});

describe('processMarketplaceWebhook (unit)', () => {
  it('rejects missing provider', async () => {
    await expect(processMarketplaceWebhook({ data: { event_id: 'evt-1' } })).rejects.toThrow(
      /provider/
    );
  });
  it('rejects missing event_id', async () => {
    await expect(processMarketplaceWebhook({ data: { provider: 'gofood' } })).rejects.toThrow(
      /event_id/
    );
  });
});
