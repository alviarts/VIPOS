// Integration tests for analytics event ingestion.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

describe('POST /api/v1/analytics/events', () => {
  it('200 receives batch of events', async () => {
    const res = await request(app)
      .post('/api/v1/analytics/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        events: [
          { name: 'login', properties: { method: 'password' } },
          { name: 'transaction_commit', properties: { amount: '50000' } },
          { name: 'page_view' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(3);
  });

  it('400 when events is empty', async () => {
    const res = await request(app)
      .post('/api/v1/analytics/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ events: [] });
    expect(res.status).toBe(400);
  });

  it('400 when events is missing', async () => {
    const res = await request(app)
      .post('/api/v1/analytics/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('skips events without name', async () => {
    const res = await request(app)
      .post('/api/v1/analytics/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        events: [
          { name: 'valid_event' },
          { properties: { no_name: true } },
          { name: 'another_valid' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(2); // skipped the one without name
  });

  it('401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/analytics/events')
      .send({ events: [{ name: 'test' }] });
    expect(res.status).toBe(401);
  });
});
