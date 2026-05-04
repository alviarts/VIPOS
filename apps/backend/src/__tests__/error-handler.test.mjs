// P2-05 PR-A — global error handler tests.
//
// We mount a tiny Express app that uses the same middleware stack as
// `buildApp()` (request-id, error handler) and verify a thrown error
// produces a JSON response carrying the request id.

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function buildHarness() {
  const express = require('express');
  const { requestIdMiddleware } = require('../middleware/request-id');
  const { globalErrorHandler } = require('../middleware/error-handler');
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.get('/boom', (_req, _res) => {
    throw new Error('synchronous boom');
  });
  app.get('/async-boom', (_req, _res, next) => {
    Promise.reject(new Error('async boom')).catch(next);
  });
  app.get('/client-boom', (_req, _res, next) => {
    const err = new Error('bad input');
    err.status = 422;
    err.expose = true;
    next(err);
  });
  app.get('/silent-boom', (_req, _res, next) => {
    const err = new Error('internal detail');
    err.status = 500;
    next(err);
  });
  app.use(globalErrorHandler());
  return app;
}

describe('global error handler', () => {
  it('returns JSON with request_id when a route throws synchronously', async () => {
    const app = buildHarness();
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
    expect(res.body.request_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('handles async rejected promises forwarded via next(err)', async () => {
    const app = buildHarness();
    const res = await request(app).get('/async-boom');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
  });

  it('honours err.status + err.expose for safe client errors', async () => {
    const app = buildHarness();
    const res = await request(app).get('/client-boom');
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('bad input');
  });

  it('hides internal error messages without err.expose', async () => {
    const app = buildHarness();
    const res = await request(app).get('/silent-boom');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
    expect(res.body.error).not.toContain('internal detail');
  });

  it('echoes the inbound X-Request-ID into the response body', async () => {
    const app = buildHarness();
    const id = 'req-test-corr-id';
    const res = await request(app).get('/boom').set('X-Request-ID', id);
    expect(res.body.request_id).toBe(id);
  });
});
