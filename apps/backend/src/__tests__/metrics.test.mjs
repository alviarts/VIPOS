// P2-05 PR-B — `/metrics` route + `lib/metrics` exposition tests.
//
// Boots the real Express app via `buildApp` so the assertions also
// cover the `metricsMiddleware` wiring (any HTTP traffic the test
// generates ends up in the registry just like prod).

import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let metricsLib;

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  metricsLib = require('../lib/metrics');
});

afterAll(async () => {
  await teardownTestEnv();
});

beforeEach(() => {
  metricsLib.resetMetrics();
});

describe('GET /metrics', () => {
  it('returns 200 with the Prometheus text exposition content type', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.headers['content-type']).toMatch(/version=0\.0\.4/);
    expect(res.text).toContain('# HELP');
    expect(res.text).toContain('# TYPE');
  });

  it('exposes the RED counter + histogram after a real request', async () => {
    // Hit a route that 404s — the metrics middleware still records
    // (404 is a valid status code observation).
    await request(app).get('/api/v1/__definitely-not-a-route__');
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('vipos_http_requests_total');
    expect(res.text).toContain('vipos_http_request_duration_seconds_bucket');
    // The /metrics scrape itself must NOT appear in the histogram.
    expect(res.text).not.toMatch(/route="\/metrics"/);
  });

  it('includes default Node process metrics with the vipos_ prefix', async () => {
    const res = await request(app).get('/metrics');
    expect(res.text).toContain('vipos_process_cpu_seconds_total');
    expect(res.text).toContain('vipos_nodejs_heap_size_total_bytes');
  });

  it('returns 401 when METRICS_TOKEN is set and no bearer is provided', async () => {
    const original = process.env.METRICS_TOKEN;
    process.env.METRICS_TOKEN = 'super-secret-scrape-token';
    try {
      const res = await request(app).get('/metrics');
      expect(res.status).toBe(401);
    } finally {
      if (original === undefined) delete process.env.METRICS_TOKEN;
      else process.env.METRICS_TOKEN = original;
    }
  });

  it('returns 200 when METRICS_TOKEN is set and the correct bearer is provided', async () => {
    const original = process.env.METRICS_TOKEN;
    process.env.METRICS_TOKEN = 'super-secret-scrape-token';
    try {
      const res = await request(app)
        .get('/metrics')
        .set('Authorization', 'Bearer super-secret-scrape-token');
      expect(res.status).toBe(200);
      expect(res.text).toContain('vipos_http_requests_total');
    } finally {
      if (original === undefined) delete process.env.METRICS_TOKEN;
      else process.env.METRICS_TOKEN = original;
    }
  });

  it('rejects mismatched bearer with 401', async () => {
    const original = process.env.METRICS_TOKEN;
    process.env.METRICS_TOKEN = 'super-secret-scrape-token';
    try {
      const res = await request(app).get('/metrics').set('Authorization', 'Bearer wrong-token');
      expect(res.status).toBe(401);
    } finally {
      if (original === undefined) delete process.env.METRICS_TOKEN;
      else process.env.METRICS_TOKEN = original;
    }
  });
});

describe('lib/metrics helpers', () => {
  let originalMetrics;

  beforeEach(() => {
    originalMetrics = process.env.METRICS_TOKEN;
    delete process.env.METRICS_TOKEN;
  });

  afterEach(() => {
    if (originalMetrics === undefined) delete process.env.METRICS_TOKEN;
    else process.env.METRICS_TOKEN = originalMetrics;
  });

  it('observeHttp increments counter and histogram with route + tenant labels', async () => {
    const fakeReq = {
      method: 'POST',
      baseUrl: '/api/v1/products',
      route: { path: '/:id' },
      path: '/api/v1/products/123',
      tenantId: 42,
    };
    const fakeRes = { statusCode: 201 };
    metricsLib.observeHttp(fakeReq, fakeRes, 0.123);
    const out = await metricsLib.renderMetrics();
    expect(out).toMatch(
      /vipos_http_requests_total\{[^}]*method="POST"[^}]*route="\/api\/v1\/products\/:id"[^}]*status_code="201"[^}]*tenant_id="42"[^}]*\} 1/
    );
    expect(out).toMatch(/vipos_http_request_duration_seconds_count\{[^}]*\} 1/);
  });

  it('observeBullJob records counter + histogram per (queue, status)', async () => {
    metricsLib.observeBullJob('email', 'completed', 0.42);
    metricsLib.observeBullJob('email', 'failed', 1.5);
    metricsLib.observeBullJob('report', 'completed', 5);
    const out = await metricsLib.renderMetrics();
    expect(out).toMatch(/vipos_bullmq_jobs_total\{queue="email",status="completed"\} 1/);
    expect(out).toMatch(/vipos_bullmq_jobs_total\{queue="email",status="failed"\} 1/);
    expect(out).toMatch(/vipos_bullmq_jobs_total\{queue="report",status="completed"\} 1/);
    expect(out).toMatch(/vipos_bullmq_job_duration_seconds_count\{[^}]*queue="email"[^}]*\}/);
  });
});
