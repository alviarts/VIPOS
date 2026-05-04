// P2-05 PR-B — middleware/metrics behaviour tests.
//
// Mounts the metrics middleware on a tiny disposable Express app so
// we can fire crafted requests (success / 4xx / 5xx) without needing
// the rest of the VIPOS routing surface. We then read the registry
// directly to assert the observations landed.

import { beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const { metricsMiddleware, isExcluded } = require('../middleware/metrics');
const metricsLib = require('../lib/metrics');

function buildHarness() {
  const app = express();
  app.use(metricsMiddleware());
  app.get('/api/v1/products/:id', (req, res) => {
    res.status(200).json({ id: req.params.id });
  });
  app.post('/api/v1/products', (_req, res) => {
    res.status(201).json({ ok: true });
  });
  app.get('/api/v1/boom', (_req, res) => {
    res.status(500).json({ error: 'boom' });
  });
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  app.get('/metrics', (_req, res) => {
    res.status(200).type('text/plain').send('mocked');
  });
  return app;
}

beforeEach(() => {
  metricsLib.resetMetrics();
});

describe('isExcluded()', () => {
  it('excludes /metrics, top-level /health, and /api/v1/health', () => {
    expect(isExcluded({ originalUrl: '/metrics' })).toBe(true);
    expect(isExcluded({ originalUrl: '/health' })).toBe(true);
    expect(isExcluded({ originalUrl: '/api/health' })).toBe(true);
    expect(isExcluded({ originalUrl: '/api/v1/health' })).toBe(true);
    // Query strings should not change the decision.
    expect(isExcluded({ originalUrl: '/metrics?format=text' })).toBe(true);
    expect(isExcluded({ originalUrl: '/health?probe=1' })).toBe(true);
  });

  it('does not exclude regular API routes', () => {
    expect(isExcluded({ originalUrl: '/api/v1/products' })).toBe(false);
    expect(isExcluded({ originalUrl: '/api/v1/healthcheck' })).toBe(false);
    expect(isExcluded({ originalUrl: '/' })).toBe(false);
  });
});

describe('metricsMiddleware', () => {
  it('increments counter per (method, route, status) triple', async () => {
    const app = buildHarness();
    await request(app).get('/api/v1/products/1');
    await request(app).get('/api/v1/products/2');
    await request(app).get('/api/v1/products/3');
    await request(app).post('/api/v1/products').send({});

    const out = await metricsLib.renderMetrics();
    expect(out).toMatch(
      /vipos_http_requests_total\{[^}]*method="GET"[^}]*route="\/api\/v1\/products\/:id"[^}]*status_code="200"[^}]*\} 3/
    );
    expect(out).toMatch(
      /vipos_http_requests_total\{[^}]*method="POST"[^}]*route="\/api\/v1\/products"[^}]*status_code="201"[^}]*\} 1/
    );
  });

  it('records 5xx responses', async () => {
    const app = buildHarness();
    await request(app).get('/api/v1/boom');
    const out = await metricsLib.renderMetrics();
    expect(out).toMatch(/status_code="500"/);
    expect(out).toMatch(
      /vipos_http_request_duration_seconds_count\{[^}]*route="\/api\/v1\/boom"[^}]*\} 1/
    );
  });

  it('does NOT record /metrics or /health requests', async () => {
    const app = buildHarness();
    await request(app).get('/health');
    await request(app).get('/metrics');
    const out = await metricsLib.renderMetrics();
    expect(out).not.toMatch(/route="\/health"/);
    expect(out).not.toMatch(/route="\/metrics"/);
    // The total counter must remain at 0 for these excluded paths.
    expect(out).not.toMatch(/vipos_http_requests_total\{[^}]*route="\/health"/);
  });

  it('observed durations are non-negative seconds in the histogram', async () => {
    const app = buildHarness();
    await request(app).get('/api/v1/products/abc');
    const out = await metricsLib.renderMetrics();
    // Sum should always be ≥ 0 for at least one labelled time series.
    const sumLine = out
      .split('\n')
      .find(
        (l) =>
          l.startsWith('vipos_http_request_duration_seconds_sum') &&
          l.includes('/api/v1/products/:id')
      );
    expect(sumLine).toBeDefined();
    const value = Number(sumLine.split(/\s+/).pop());
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  });
});
