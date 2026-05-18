import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let buildApp;

describe('P2-06 helmet middleware', () => {
  let app;
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

  it('emits the standard helmet security headers in dev', async () => {
    process.env.NODE_ENV = 'test';
    ({ buildApp } = require('../app.js'));
    app = buildApp({ morganEnabled: false });

    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-download-options']).toBe('noopen');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=/);
    // CSP is intentionally OFF in non-prod so Vite HMR works.
    expect(res.headers['content-security-policy']).toBeUndefined();
  });

  it('emits a strict CSP when NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production';
    delete require.cache[require.resolve('../app.js')];
    delete require.cache[require.resolve('../lib/security.js')];
    process.env.CORS_ALLOWLIST = 'https://app.vipos.id';
    ({ buildApp } = require('../app.js'));
    app = buildApp({ morganEnabled: false });

    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/script-src 'self'/);
    expect(csp).toMatch(/style-src 'self' 'unsafe-inline'/);
    expect(csp).toMatch(/img-src 'self' data: https:/);
    // upgrade-insecure-requests is intentionally NOT emitted (handled
    // at nginx layer per defaults #7).
    expect(csp).not.toMatch(/upgrade-insecure-requests/);
  });

  it('disables the cross-origin embedder policy so SPA images load', async () => {
    process.env.NODE_ENV = 'test';
    ({ buildApp } = require('../app.js'));
    app = buildApp({ morganEnabled: false });

    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.headers['cross-origin-embedder-policy']).toBeUndefined();
  });
});
