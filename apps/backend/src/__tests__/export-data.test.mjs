// Integration tests for data export endpoints.
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

describe('GET /api/v1/export/transactions', () => {
  it('200 returns JSON by default', async () => {
    const res = await request(app)
      .get('/api/v1/export/transactions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('count');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('200 returns CSV when format=csv', async () => {
    const res = await request(app)
      .get('/api/v1/export/transactions?format=csv')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  it('401 without auth', async () => {
    const res = await request(app)
      .get('/api/v1/export/transactions');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/export/products', () => {
  it('200 returns product list', async () => {
    const res = await request(app)
      .get('/api/v1/export/products')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/v1/export/customers', () => {
  it('200 returns customer list', async () => {
    const res = await request(app)
      .get('/api/v1/export/customers')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
