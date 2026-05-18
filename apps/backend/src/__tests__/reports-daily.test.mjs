// Integration tests for daily sales summary report.
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

describe('GET /api/v1/reports/daily-summary', () => {
  it('200 returns daily summary', async () => {
    const res = await request(app)
      .get('/api/v1/reports/daily-summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('date');
    expect(res.body).toHaveProperty('revenue');
    expect(res.body).toHaveProperty('transactions');
    expect(res.body).toHaveProperty('avg_basket');
    expect(res.body).toHaveProperty('payment_breakdown');
    expect(res.body).toHaveProperty('top_products');
    expect(res.body).toHaveProperty('hourly_breakdown');
    expect(Array.isArray(res.body.payment_breakdown)).toBe(true);
    expect(Array.isArray(res.body.top_products)).toBe(true);
    expect(Array.isArray(res.body.hourly_breakdown)).toBe(true);
  });

  it('accepts date parameter', async () => {
    const res = await request(app)
      .get('/api/v1/reports/daily-summary?date=2026-05-08')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-05-08');
  });

  it('returns numeric values', async () => {
    const res = await request(app)
      .get('/api/v1/reports/daily-summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(typeof res.body.revenue).toBe('number');
    expect(typeof res.body.transactions).toBe('number');
    expect(typeof res.body.avg_basket).toBe('number');
  });

  it('401 without auth', async () => {
    const res = await request(app)
      .get('/api/v1/reports/daily-summary');
    expect(res.status).toBe(401);
  });
});
