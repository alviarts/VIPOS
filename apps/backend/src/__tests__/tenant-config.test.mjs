// Integration tests for tenant config endpoint.
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

describe('GET /api/v1/config', () => {
  it('200 returns config object', async () => {
    const res = await request(app)
      .get('/api/v1/config')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('config');
    expect(typeof res.body.config).toBe('object');
  });

  it('401 without auth', async () => {
    const res = await request(app).get('/api/v1/config');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/config', () => {
  it('200 upserts config keys', async () => {
    const res = await request(app)
      .put('/api/v1/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ receipt_header: 'My Store', tax_rate: '11' });
    expect(res.status).toBe(200);
    expect(res.body.updated).toContain('receipt_header');
    expect(res.body.updated).toContain('tax_rate');
  });

  it('reads back written config', async () => {
    await request(app)
      .put('/api/v1/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ test_key: 'test_value_123' });

    const res = await request(app)
      .get('/api/v1/config')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.config.test_key).toBe('test_value_123');
  });

  it('400 when body is empty', async () => {
    const res = await request(app)
      .put('/api/v1/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
