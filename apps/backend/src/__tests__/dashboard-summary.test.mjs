// Integration tests for dashboard summary endpoint (P4-07).
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

describe('GET /api/v1/dashboard/summary', () => {
  it('200 returns dashboard KPIs', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('today_revenue');
    expect(res.body).toHaveProperty('today_transactions');
    expect(res.body).toHaveProperty('today_avg_basket');
    expect(res.body).toHaveProperty('mtd_revenue');
    expect(res.body).toHaveProperty('mtd_transactions');
    expect(res.body).toHaveProperty('low_stock_count');
    expect(res.body).toHaveProperty('pending_approvals');
  });

  it('401 without auth', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary');
    expect(res.status).toBe(401);
  });

  it('returns numeric values', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(typeof res.body.today_revenue).toBe('number');
    expect(typeof res.body.today_transactions).toBe('number');
    expect(typeof res.body.low_stock_count).toBe('number');
  });
});
