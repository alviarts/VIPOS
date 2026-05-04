// P2-07: verify the /api/v1 canonical surface and the /api legacy alias
// behave consistently and that the alias advertises deprecation.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let LEGACY_SUNSET;

beforeAll(() => {
  setupTestEnv();
  ({ LEGACY_SUNSET } = require('../api-version'));
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
});

afterAll(() => {
  teardownTestEnv();
});

async function loginAdmin(prefix) {
  const res = await request(app)
    .post(`${prefix}/auth/login`)
    .send({ username: 'admin', password: 'admin123' });
  expect(res.status).toBe(200);
  return res.body.token;
}

describe('GET /api/v1/health (canonical)', () => {
  it('200 + no deprecation header', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers.deprecation).toBeUndefined();
    expect(res.headers.sunset).toBeUndefined();
  });
});

describe('GET /api/health (legacy alias)', () => {
  it('200 + no deprecation header (utility endpoint excluded from sunset)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    // Per legacyDeprecationMiddleware: /health, /docs, /v1/* are excluded
    // because they are utility endpoints, not deprecated business endpoints.
    expect(res.headers.deprecation).toBeUndefined();
    expect(res.headers.sunset).toBeUndefined();
  });
});

describe('Auth via canonical /api/v1', () => {
  it('POST /api/v1/auth/login → 200 + token + no deprecation header', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.headers.deprecation).toBeUndefined();
    expect(res.headers.sunset).toBeUndefined();
    expect(res.headers.link).toBeUndefined();
  });
});

describe('Auth via legacy /api alias', () => {
  it('POST /api/auth/login → 200 + Deprecation/Sunset/Link headers', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.headers.deprecation).toBe('true');
    expect(res.headers.sunset).toBe(LEGACY_SUNSET);
    expect(res.headers.link).toBe('</api/v1/auth/login>; rel="successor-version"');
  });
});

describe('Customers via both surfaces stay in sync', () => {
  it('GET /api/v1/customers (200) and GET /api/customers (200 + deprecated) return same body', async () => {
    const tokenV1 = await loginAdmin('/api/v1');
    const v1Res = await request(app)
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${tokenV1}`);
    expect(v1Res.status).toBe(200);

    const legacyRes = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${tokenV1}`);
    expect(legacyRes.status).toBe(200);
    expect(legacyRes.headers.deprecation).toBe('true');
    expect(legacyRes.headers.sunset).toBe(LEGACY_SUNSET);
    expect(legacyRes.headers.link).toBe('</api/v1/customers>; rel="successor-version"');

    expect(legacyRes.body).toEqual(v1Res.body);
  });
});

describe('Swagger / OpenAPI docs', () => {
  it('GET /api/docs.json → 200 with /api/v1 paths only', async () => {
    // /api/docs is mounted only when DISABLE_API_DOCS != '1'. Tests opt out
    // of the doc surface for speed; rebuild a separate app instance here so
    // we exercise the doc route without disturbing the shared `app`.
    delete process.env.DISABLE_API_DOCS;
    // Force re-require so module cache picks up the env change.
    const { buildApp } = require('../app');
    const docsApp = buildApp({ morganEnabled: false });
    process.env.DISABLE_API_DOCS = '1';

    const res = await request(docsApp).get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    const paths = Object.keys(res.body.paths || {});
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) {
      expect(p.startsWith('/api/v1/'), `path ${p} should start with /api/v1/`).toBe(true);
    }
  });
});

describe('Unknown endpoint behaviour', () => {
  it('GET /api/v1/__nope 404 (no match)', async () => {
    const res = await request(app).get('/api/v1/__nope');
    expect(res.status).toBe(404);
  });

  it('GET /api/__nope 404 (legacy alias also has no match)', async () => {
    const res = await request(app).get('/api/__nope');
    expect(res.status).toBe(404);
  });
});
