// VIPOS — P1-17 Reports endpoints (smoke test untuk semua kategori).
//
// Memverifikasi setiap endpoint return 200 + struktur dasar (period, rows /
// summary). Menyentuh juga schedule CRUD karena bagian Prime+ perlu safety net.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let token;

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  token = res.body.token;

  // Bump the bootstrap tenant to Prime so the
  // `POST /reports/schedule/:id/run` enqueue path (P2-04 PR-C) is
  // reachable under requireTier('prime'). The schedule CRUD tests are
  // Prime+ feature endpoints regardless, per the file header in
  // routes/reports.js.
  const { runAsSystem, query } = require('../db');
  await runAsSystem(() => query(`UPDATE tenants SET tier = 'prime' WHERE id = 1`));
});

afterAll(async () => {
  await teardownTestEnv();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

const REPORT_ENDPOINTS = [
  '/api/reports/sales-summary',
  '/api/reports/sales-detail',
  '/api/reports/sales-daily',
  '/api/reports/sales-by-outlet',
  '/api/reports/sales-by-category',
  '/api/reports/sales-by-department',
  '/api/reports/sales-by-product',
  '/api/reports/sales-by-cashier',
  '/api/reports/sales-by-payment-method',
  '/api/reports/cash-drawer',
  '/api/reports/shift-close',
  '/api/reports/void',
  '/api/reports/refund',
  '/api/reports/promo',
  '/api/reports/loyalty',
  '/api/reports/coupon',
  '/api/reports/tax',
  '/api/reports/customer',
  '/api/reports/inventory-stock',
  '/api/reports/inventory-movement',
  '/api/reports/inventory-turnover',
  '/api/reports/inventory-value',
  '/api/reports/employee-attendance',
  '/api/reports/employee-shift',
  '/api/reports/employee-commission',
  '/api/reports/financial-pnl',
  '/api/reports/financial-balance-sheet',
  '/api/reports/financial-cashflow',
  '/api/reports/marketing-campaign',
];

describe('GET /api/reports/catalog', () => {
  it('returns grouped report catalog', async () => {
    const res = await request(app).get('/api/reports/catalog').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    for (const group of res.body) {
      expect(group.group).toBeDefined();
      expect(Array.isArray(group.reports)).toBe(true);
    }
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/reports/catalog');
    expect(res.status).toBe(401);
  });
});

describe('Report endpoints smoke (each returns 200)', () => {
  for (const endpoint of REPORT_ENDPOINTS) {
    it(`${endpoint} responds 200 with default range`, async () => {
      const res = await request(app).get(endpoint).set(auth());
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  }

  it('respects from/to filters', async () => {
    const res = await request(app)
      .get('/api/reports/sales-summary?from=2025-01-01&to=2025-01-31')
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.period).toEqual({ from: '2025-01-01', to: '2025-01-31' });
  });

  it('rejects bad date input via Zod validation', async () => {
    const res = await request(app).get('/api/reports/sales-summary?from=garbage').set(auth());
    // 400 from validate middleware OR 200 if Zod kept it optional. The schema
    // marks `from` as a strict YYYY-MM-DD, so it must be 400.
    expect(res.status).toBe(400);
  });
});

describe('Report schedule CRUD (Prime+ feature)', () => {
  let createdId;

  it('lists empty by default', async () => {
    const res = await request(app).get('/api/reports/schedule').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('creates a schedule', async () => {
    const res = await request(app).post('/api/reports/schedule').set(auth()).send({
      report_key: 'sales-summary',
      name: 'Daily summary owner',
      frequency: 'daily',
      recipients: 'owner@example.com',
      format: 'pdf',
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.report_key).toBe('sales-summary');
    createdId = res.body.id;
  });

  it('updates a schedule', async () => {
    const res = await request(app)
      .put(`/api/reports/schedule/${createdId}`)
      .set(auth())
      .send({ frequency: 'weekly', is_active: 0 });
    expect(res.status).toBe(200);
    expect(res.body.frequency).toBe('weekly');
    expect(res.body.is_active).toBe(0);
  });

  it('triggers manual run', async () => {
    // P2-04 PR-C: enqueue path returns 202 when REDIS_URL is configured,
    // 200 sync-fallback otherwise. Either way `last_run_at` is updated.
    const res = await request(app).post(`/api/reports/schedule/${createdId}/run`).set(auth());
    expect([200, 202]).toContain(res.status);
    expect(res.body.last_run_at).toBeDefined();
  });

  it('deletes a schedule', async () => {
    const res = await request(app).delete(`/api/reports/schedule/${createdId}`).set(auth());
    expect(res.status).toBe(204);
  });

  it('rejects invalid frequency', async () => {
    const res = await request(app).post('/api/reports/schedule').set(auth()).send({
      report_key: 'sales-summary',
      name: 'Bad',
      frequency: 'every-second',
    });
    expect(res.status).toBe(400);
  });
});
