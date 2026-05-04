import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

describe('P2-06 CORS allowlist', () => {
  let originalEnv;

  beforeEach(async () => {
    await setupTestEnv();
    originalEnv = { ...process.env };
    delete require.cache[require.resolve('../app.js')];
    delete require.cache[require.resolve('../lib/security.js')];
  });

  afterEach(async () => {
    process.env = originalEnv;
    delete require.cache[require.resolve('../app.js')];
    delete require.cache[require.resolve('../lib/security.js')];
    await teardownTestEnv();
  });

  function loadApp() {
    const { buildApp } = require('../app.js');
    return buildApp({ morganEnabled: false });
  }

  it('honours an explicit allowlist from CORS_ALLOWLIST', async () => {
    process.env.NODE_ENV = 'test';
    process.env.CORS_ALLOWLIST = 'https://app.vipos.id,https://merchant.example.com';
    const app = loadApp();

    const ok = await request(app).get('/api/v1/health').set('Origin', 'https://app.vipos.id');
    expect(ok.status).toBe(200);
    expect(ok.headers['access-control-allow-origin']).toBe('https://app.vipos.id');
  });

  it('rejects origins not on the list with the express error handler', async () => {
    process.env.NODE_ENV = 'test';
    process.env.CORS_ALLOWLIST = 'https://app.vipos.id';
    const app = loadApp();

    const blocked = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://evil.example.com');
    // CORS error path returns 500 by default in express because the
    // CORS middleware passes an Error to next(). The important
    // assertion is that the Allow-Origin header is NOT echoed back.
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('falls back to dev defaults when CORS_ALLOWLIST is unset and NODE_ENV != production', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.CORS_ALLOWLIST;
    const app = loadApp();

    const ok = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:5173');
    expect(ok.status).toBe(200);
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('throws at construction time when production starts without CORS_ALLOWLIST', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ALLOWLIST;
    expect(() => loadApp()).toThrow(/CORS_ALLOWLIST/);
  });

  it('echoes Vary: Origin so caches do not collapse responses across origins', async () => {
    process.env.NODE_ENV = 'test';
    process.env.CORS_ALLOWLIST = 'https://app.vipos.id';
    const app = loadApp();

    const res = await request(app).get('/api/v1/health').set('Origin', 'https://app.vipos.id');
    expect(res.headers.vary).toMatch(/Origin/i);
  });

  it('allows server-to-server (no Origin header) requests through', async () => {
    process.env.NODE_ENV = 'test';
    process.env.CORS_ALLOWLIST = 'https://app.vipos.id';
    const app = loadApp();

    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('parseAllowlist trims and dedupes entries', async () => {
    const { parseAllowlist } = require('../lib/security.js');
    expect(parseAllowlist('  a , b ,a, ,c')).toEqual(['a', 'b', 'c']);
    expect(parseAllowlist('')).toEqual([]);
    expect(parseAllowlist(undefined)).toEqual([]);
  });
});
