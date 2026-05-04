import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

describe('P2-06 API rate limiter', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Force in-memory store for these tests so each apiRateLimit()
    // call gets a fresh MemoryStore. Otherwise the Redis store
    // (driven by the CI REDIS_URL) shares state across `it` blocks.
    delete process.env.REDIS_URL;
    delete require.cache[require.resolve('../lib/rate-limit.js')];
    const rl = require('../lib/rate-limit.js');
    rl._resetForTests();
  });

  afterEach(() => {
    process.env = originalEnv;
    delete require.cache[require.resolve('../lib/rate-limit.js')];
  });

  function buildHarness({ max = 3, windowMs = 60_000, mountUserMiddleware = false } = {}) {
    const { apiRateLimit } = require('../lib/rate-limit.js');
    const app = express();
    app.set('trust proxy', true);

    if (mountUserMiddleware) {
      // Hand-rolled fake auth middleware that lets the test set the
      // user id via header — exercises the keyGenerator user_id path.
      app.use((req, _res, next) => {
        const userId = req.headers['x-fake-user'];
        if (userId) req.user = { user_id: userId };
        next();
      });
    }

    app.use(apiRateLimit({ max, windowMs }));

    app.get('/api/v1/echo', (_req, res) => res.json({ ok: true }));
    app.get('/health', (_req, res) => res.json({ ok: true }));
    app.get('/metrics', (_req, res) => res.json({ ok: true }));
    return app;
  }

  it('blocks the 4th request when max=3', async () => {
    const app = buildHarness({ max: 3 });

    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).get('/api/v1/echo');
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).get('/api/v1/echo');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({
      error: expect.stringMatching(/rate limit/i),
      retry_after_seconds: expect.any(Number),
    });
  });

  it('skips /metrics and /health unconditionally', async () => {
    const app = buildHarness({ max: 1 });

    // Burn the single request budget on /api/v1/echo …
    const a = await request(app).get('/api/v1/echo');
    expect(a.status).toBe(200);
    const blocked = await request(app).get('/api/v1/echo');
    expect(blocked.status).toBe(429);

    // … but /metrics + /health remain unblocked even though we are
    // over budget.
    for (let i = 0; i < 5; i += 1) {
      const m = await request(app).get('/metrics');
      expect(m.status).toBe(200);
      const h = await request(app).get('/health');
      expect(h.status).toBe(200);
    }
  });

  it('keys per authenticated user — different users get independent budgets', async () => {
    const app = buildHarness({ max: 2, mountUserMiddleware: true });

    // User A burns the 2-request budget.
    const a1 = await request(app).get('/api/v1/echo').set('X-Fake-User', 'A');
    const a2 = await request(app).get('/api/v1/echo').set('X-Fake-User', 'A');
    const a3 = await request(app).get('/api/v1/echo').set('X-Fake-User', 'A');
    expect(a1.status).toBe(200);
    expect(a2.status).toBe(200);
    expect(a3.status).toBe(429);

    // User B is unaffected — their budget is fresh.
    const b1 = await request(app).get('/api/v1/echo').set('X-Fake-User', 'B');
    const b2 = await request(app).get('/api/v1/echo').set('X-Fake-User', 'B');
    expect(b1.status).toBe(200);
    expect(b2.status).toBe(200);
  });

  it('falls back to ip-keyed when no req.user is set', async () => {
    const app = buildHarness({ max: 2, mountUserMiddleware: true });

    const r1 = await request(app).get('/api/v1/echo');
    const r2 = await request(app).get('/api/v1/echo');
    const r3 = await request(app).get('/api/v1/echo');
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
  });

  it('uses the in-memory store when REDIS_URL is unset', () => {
    delete process.env.REDIS_URL;
    const { hasRedis, buildRedisStore } = require('../lib/rate-limit.js');
    expect(hasRedis()).toBe(false);
    expect(buildRedisStore('test')).toBeUndefined();
  });

  it('honours a custom skip function', async () => {
    const { apiRateLimit } = require('../lib/rate-limit.js');
    const app = express();
    app.set('trust proxy', true);
    app.use(
      apiRateLimit({
        max: 1,
        windowMs: 60_000,
        skip: (req) => req.headers['x-skip-rate-limit'] === '1',
      })
    );
    app.get('/test', (_req, res) => res.json({ ok: true }));

    const a = await request(app).get('/test');
    expect(a.status).toBe(200);
    const b = await request(app).get('/test');
    expect(b.status).toBe(429);

    // Skipped requests bypass the limiter entirely.
    for (let i = 0; i < 5; i += 1) {
      const c = await request(app).get('/test').set('X-Skip-Rate-Limit', '1');
      expect(c.status).toBe(200);
    }
  });
});
