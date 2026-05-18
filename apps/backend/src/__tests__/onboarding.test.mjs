// Integration tests for tenant onboarding/registration (P6-02).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
});

afterAll(async () => {
  await teardownTestEnv();
});

describe('POST /api/v1/onboarding/register', () => {
  it('201 creates tenant + user + returns token', async () => {
    const res = await request(app)
      .post('/api/v1/onboarding/register')
      .send({
        business_name: 'Kopi Nusantara',
        owner_name: 'Budi Santoso',
        email: `test-${Date.now()}@example.com`,
        phone: '+6281234567890',
        password: 'rahasia123',
      });
    expect(res.status).toBe(201);
    expect(res.body.tenant).toBeDefined();
    expect(res.body.tenant.name).toBe('Kopi Nusantara');
    expect(res.body.tenant.tier).toBe('lite');
    expect(res.body.tenant.status).toBe('trial');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.role).toBe('owner');
    expect(res.body.token).toBeDefined();
    expect(res.body.token.length).toBeGreaterThan(10);
  });

  it('409 duplicate email', async () => {
    const email = `dup-${Date.now()}@example.com`;
    await request(app)
      .post('/api/v1/onboarding/register')
      .send({
        business_name: 'First Biz',
        owner_name: 'Owner 1',
        email,
        password: 'rahasia123',
      });

    const res = await request(app)
      .post('/api/v1/onboarding/register')
      .send({
        business_name: 'Second Biz',
        owner_name: 'Owner 2',
        email,
        password: 'rahasia123',
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('sudah terdaftar');
  });

  it('400 missing business_name', async () => {
    const res = await request(app)
      .post('/api/v1/onboarding/register')
      .send({
        owner_name: 'Test',
        email: 'x@x.com',
        password: '123456',
      });
    expect(res.status).toBe(400);
  });

  it('400 short password', async () => {
    const res = await request(app)
      .post('/api/v1/onboarding/register')
      .send({
        business_name: 'Test Biz',
        owner_name: 'Test',
        email: `short-${Date.now()}@x.com`,
        password: '123',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('minimal 6');
  });

  it('400 invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/onboarding/register')
      .send({
        business_name: 'Test Biz',
        owner_name: 'Test',
        email: 'not-an-email',
        password: '123456',
      });
    expect(res.status).toBe(400);
  });

  it('generated token is valid JWT', async () => {
    const res = await request(app)
      .post('/api/v1/onboarding/register')
      .send({
        business_name: 'JWT Test Biz',
        owner_name: 'JWT Owner',
        email: `jwt-${Date.now()}@example.com`,
        password: 'rahasia123',
      });
    // Use the token to access an authenticated endpoint
    const authRes = await request(app)
      .get('/api/v1/products?page=1&per_page=1')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(authRes.status).toBe(200);
  });
});
