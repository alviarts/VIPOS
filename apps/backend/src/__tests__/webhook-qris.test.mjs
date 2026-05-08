// Integration tests for QRIS webhook endpoint.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let adminToken;

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  adminToken = res.body.token;
});

afterAll(async () => {
  await teardownTestEnv();
});

beforeEach(async () => {
  const { query, runAsSystem } = require('../db');
  await runAsSystem(() =>
    query(`DELETE FROM qris_dynamic_invocations`),
  );
});

describe('POST /api/v1/webhook/qris', () => {
  it('200 updates AWAITING to PAID', async () => {
    // Mint a QRIS invocation first
    const mintRes = await request(app)
      .post('/api/v1/payment/qris/dynamic')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 50000 });
    expect(mintRes.status).toBe(201);
    const refId = mintRes.body.ref_id;

    // Webhook callback
    const res = await request(app)
      .post('/api/v1/webhook/qris')
      .send({ ref_id: refId, status: 'PAID' });
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(res.body.action).toBe('updated');

    // Verify status changed
    const pollRes = await request(app)
      .get(`/api/v1/payment/qris/${refId}/status`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pollRes.body.status).toBe('PAID');
  });

  it('200 ignores non-PAID status', async () => {
    const res = await request(app)
      .post('/api/v1/webhook/qris')
      .send({ ref_id: 'QR-test', status: 'PENDING' });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('ignored');
  });

  it('200 no_match for unknown ref_id', async () => {
    const res = await request(app)
      .post('/api/v1/webhook/qris')
      .send({ ref_id: 'QR-nonexistent', status: 'PAID' });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('no_match');
  });

  it('400 when ref_id missing', async () => {
    const res = await request(app)
      .post('/api/v1/webhook/qris')
      .send({ status: 'PAID' });
    expect(res.status).toBe(400);
  });
});
