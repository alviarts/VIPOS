// VIPOS — P1-03 dashboard endpoints (summary + sales-trend).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let token;

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  token = res.body.token;
});

afterAll(async () => {
  await teardownTestEnv();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('GET /api/dashboard/summary', () => {
  it('returns current MTD summary when no params', async () => {
    const res = await request(app).get('/api/dashboard/summary').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('revenue');
    expect(res.body).toHaveProperty('transactions');
    expect(res.body).toHaveProperty('avg_ticket');
    expect(res.body).toHaveProperty('items_sold');
    expect(res.body.today).toBeDefined();
    expect(res.body.range.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.range.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('honours start + end range', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary?start=2025-01-01&end=2025-01-07')
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.range).toEqual({ start: '2025-01-01', end: '2025-01-07' });
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/dashboard/sales-trend', () => {
  it('fills date gaps and returns one point per day', async () => {
    const res = await request(app)
      .get('/api/dashboard/sales-trend?start=2025-01-01&end=2025-01-05')
      .set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(5);
    for (const point of res.body) {
      expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof point.total).toBe('number');
      expect(typeof point.transactions).toBe('number');
    }
  });

  it('defaults to last 30 days when params are absent', async () => {
    const res = await request(app).get('/api/dashboard/sales-trend').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(30);
  });
});
