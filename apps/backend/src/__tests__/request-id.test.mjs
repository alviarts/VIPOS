// P2-05 PR-A — request id middleware tests.
//
// Verify the X-Request-ID middleware echoes a valid header back, drops
// unsafe values, and generates a UUIDv4 when absent.

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

describe('request-id middleware', () => {
  it('echoes a sane X-Request-ID header back to the caller', async () => {
    const id = 'req-abcdef123';
    const res = await request(app).get('/api/v1/health').set('X-Request-ID', id);
    expect(res.headers['x-request-id']).toBe(id);
  });

  it('generates a UUID-shaped id when the header is absent', async () => {
    const res = await request(app).get('/api/v1/health');
    const id = res.headers['x-request-id'];
    expect(id).toBeTruthy();
    // UUIDv4 shape: 8-4-4-4-12 hex digits.
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('drops unsafe X-Request-ID values and substitutes a fresh UUID', () => {
    // Node's HTTP layer would reject a CR/LF-bearing header before it
    // hits the wire, so we exercise the middleware directly here. This
    // verifies the *substitution* path: anything that fails the strict
    // SAFE_RE check is replaced with a fresh UUID even if the runtime
    // somehow accepted it.
    const { requestIdMiddleware } = require('../middleware/request-id');
    const headers = {};
    const reqEvil = { headers: { 'x-request-id': 'foo bar (with spaces)' } };
    const reqQuote = { headers: { 'x-request-id': '"quoted-id"' } };
    const reqArr = { headers: { 'x-request-id': ['a', 'b'] } };
    const res = {
      setHeader(k, v) {
        headers[k] = v;
      },
    };
    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };
    for (const r of [reqEvil, reqQuote, reqArr]) {
      requestIdMiddleware(r, res, next);
      expect(r.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    }
    expect(nextCalls).toBe(3);
  });

  it('drops over-long X-Request-ID values', async () => {
    const long = 'x'.repeat(200);
    const res = await request(app).get('/api/v1/health').set('X-Request-ID', long);
    expect(res.headers['x-request-id']).not.toBe(long);
  });

  it('accepts conventional id shapes (UUID, ULID-like, slug)', async () => {
    const cases = [
      '123e4567-e89b-12d3-a456-426614174000',
      '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      'svc.api-2026-05-04T12_00_00',
    ];
    for (const id of cases) {
      const res = await request(app).get('/api/v1/health').set('X-Request-ID', id);
      expect(res.headers['x-request-id']).toBe(id);
    }
  });
});
