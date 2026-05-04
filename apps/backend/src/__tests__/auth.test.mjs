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

describe('POST /api/auth/login', () => {
  it('200 dengan credentials yang benar (default admin/admin123)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({ username: 'admin', role: 'admin' });
  });

  it('401 dengan password salah', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/salah/i);
  });

  it('401 dengan user tidak ada', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nope', password: 'whatever' });
    expect(res.status).toBe(401);
  });

  it('400 + Zod details kalau username kosong', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: '', password: 'admin123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.location).toBe('body');
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details[0].path).toBe('username');
  });

  it('400 + Zod details kalau body kosong', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThanOrEqual(2);
  });
});

describe('GET /api/auth/me', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    token = res.body.token;
  });

  it('200 dengan Bearer token yang valid', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('admin');
  });

  it('401 tanpa Authorization header', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('401/403 dengan token sembarangan', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt');
    expect([401, 403]).toContain(res.status);
  });
});

describe('GET /api/health', () => {
  it('200 ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
