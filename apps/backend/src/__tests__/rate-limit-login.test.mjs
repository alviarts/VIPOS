import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

describe('P2-06 login rate limiter', () => {
  let originalEnv;

  beforeEach(async () => {
    await setupTestEnv();
    originalEnv = { ...process.env };
    // Force in-memory store so each test starts with a fresh budget.
    // Without this the Redis-backed limiter inherits keys from the
    // previous test run.
    delete process.env.REDIS_URL;
    delete require.cache[require.resolve('../app.js')];
    delete require.cache[require.resolve('../routes/auth.js')];
    delete require.cache[require.resolve('../lib/rate-limit.js')];
  });

  afterEach(async () => {
    process.env = originalEnv;
    delete require.cache[require.resolve('../app.js')];
    delete require.cache[require.resolve('../routes/auth.js')];
    delete require.cache[require.resolve('../lib/rate-limit.js')];
    await teardownTestEnv();
  });

  it('allows up to 5 requests then 429s on the 6th', async () => {
    process.env.NODE_ENV = 'test';
    process.env.RATE_LIMIT_LOGIN_ENABLED = '1';
    const { buildApp } = require('../app.js');
    const app = buildApp({ morganEnabled: false });

    // First 5 requests: 401 unauthorized (login attempts with bogus
    // credentials), but the limiter keeps them under budget.
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'nope', password: 'nope' });
      expect(res.status).toBe(401);
    }

    // 6th request: limiter returns 429 with the structured body.
    const blocked = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'nope', password: 'nope' });
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({
      error: expect.stringMatching(/too many login/i),
      retry_after_seconds: expect.any(Number),
    });
  });

  it('shares the budget across /login and /login/2fa (per-IP, not per-route)', async () => {
    process.env.NODE_ENV = 'test';
    process.env.RATE_LIMIT_LOGIN_ENABLED = '1';
    const { buildApp } = require('../app.js');
    const app = buildApp({ morganEnabled: false });

    // 3 hits on /login
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'nope', password: 'nope' });
      expect(res.status).toBe(401);
    }
    // 2 hits on /login/2fa
    for (let i = 0; i < 2; i += 1) {
      const res = await request(app)
        .post('/api/v1/auth/login/2fa')
        .send({ login_token: 'bogus', code: '000000' });
      // /login/2fa returns 400/401 for bogus token; either way it
      // counts toward the same per-IP budget.
      expect([400, 401]).toContain(res.status);
    }

    const blocked = await request(app)
      .post('/api/v1/auth/login/2fa')
      .send({ login_token: 'bogus', code: '000000' });
    expect(blocked.status).toBe(429);
  });

  it('emits standardized RateLimit-* headers on accepted requests', async () => {
    process.env.NODE_ENV = 'test';
    process.env.RATE_LIMIT_LOGIN_ENABLED = '1';
    const { buildApp } = require('../app.js');
    const app = buildApp({ morganEnabled: false });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'nope', password: 'nope' });
    expect(res.status).toBe(401);
    // express-rate-limit standardHeaders='draft-7' emits a single
    // combined `RateLimit:` header plus a `RateLimit-Policy:` quota
    // descriptor, e.g. `RateLimit-Policy: 5;w=900`.
    expect(res.headers['ratelimit-policy']).toMatch(/^5;w=\d+$/);
    expect(res.headers['ratelimit']).toMatch(/limit=5/);
    expect(res.headers['ratelimit']).toMatch(/remaining=/);
  });
});
