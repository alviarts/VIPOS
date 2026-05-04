// VIPOS — onboarding template HTTP integration tests (PR-4).
//
// Hits POST /api/v1/tenant/onboarding/seed-template with a logged-in admin
// via the real express app + setup-test-db.mjs harness. Pure unit tests
// (no DB) live in onboarding-templates-lib.test.mjs.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let queryFn;

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  queryFn = require('../db').query;
});

afterAll(async () => {
  await teardownTestEnv();
});

async function loginAsAdmin() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  expect(res.status).toBe(200);
  return res.body;
}

describe('GET /api/v1/tenant/onboarding/templates', () => {
  it('200 — returns all 3 presets with preview metadata for an authed user', async () => {
    const { token } = await loginAsAdmin();
    const res = await request(app)
      .get('/api/v1/tenant/onboarding/templates')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.templates).toHaveLength(3);
    const ids = res.body.templates.map((t) => t.id).sort();
    expect(ids).toEqual(['fnb', 'retail', 'salon']);
  });

  it('401 — without a bearer token', async () => {
    const res = await request(app).get('/api/v1/tenant/onboarding/templates');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/tenant/onboarding/seed-template', () => {
  it('400 — unknown template id', async () => {
    const { token } = await loginAsAdmin();
    const res = await request(app)
      .post('/api/v1/tenant/onboarding/seed-template')
      .set('Authorization', `Bearer ${token}`)
      .send({ template: 'mystery-meat' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tidak dikenali/);
  });

  it('401 — without bearer token', async () => {
    const res = await request(app)
      .post('/api/v1/tenant/onboarding/seed-template')
      .send({ template: 'fnb' });
    expect(res.status).toBe(401);
  });

  it('201 — seeds template into a fresh tenant, idempotent on re-run', async () => {
    // Register a brand-new tenant via the public endpoint to keep the seed
    // count deterministic (no pre-existing categories / products).
    const reg = await request(app).post('/api/v1/tenant/register').send({
      tenant_slug: 'merchant-seed-fnb',
      tenant_name: 'Seed FnB',
      tier: 'lite',
      admin_username: 'seed_fnb_admin',
      admin_password: 'rahasia123',
      admin_name: 'Seed FnB Admin',
    });
    expect(reg.status).toBe(201);
    const adminToken = reg.body.token;

    const first = await request(app)
      .post('/api/v1/tenant/onboarding/seed-template')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ template: 'fnb' });
    expect(first.status).toBe(201);
    expect(first.body.template).toBe('fnb');
    expect(first.body.categories.added).toBeGreaterThanOrEqual(4);
    expect(first.body.products.added).toBeGreaterThanOrEqual(8);
    expect(first.body.products.skipped).toBe(0);

    const second = await request(app)
      .post('/api/v1/tenant/onboarding/seed-template')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ template: 'fnb' });
    expect(second.status).toBe(201);
    expect(second.body.categories.added).toBe(0);
    expect(second.body.products.added).toBe(0);
    expect(second.body.products.skipped).toBeGreaterThanOrEqual(8);

    // Confirm the rows actually landed under the new tenant_id.
    const tenantId = reg.body.tenant.id;
    const cats = await queryFn(`SELECT name FROM categories WHERE tenant_id = $1 ORDER BY name`, [
      tenantId,
    ]);
    const prods = await queryFn(`SELECT sku FROM products WHERE tenant_id = $1 ORDER BY sku`, [
      tenantId,
    ]);
    expect(cats.rows.length).toBeGreaterThanOrEqual(4);
    expect(prods.rows.length).toBeGreaterThanOrEqual(8);
    expect(prods.rows.map((r) => r.sku)).toContain('FNB-001');
  });

  it('201 — different presets seed different SKU prefixes into separate tenants', async () => {
    const reg = await request(app).post('/api/v1/tenant/register').send({
      tenant_slug: 'merchant-seed-retail',
      tenant_name: 'Seed Retail',
      tier: 'lite',
      admin_username: 'seed_retail_admin',
      admin_password: 'rahasia123',
      admin_name: 'Seed Retail Admin',
    });
    expect(reg.status).toBe(201);
    const adminToken = reg.body.token;

    const seeded = await request(app)
      .post('/api/v1/tenant/onboarding/seed-template')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ template: 'retail' });
    expect(seeded.status).toBe(201);
    expect(seeded.body.products.added).toBeGreaterThanOrEqual(8);

    const tenantId = reg.body.tenant.id;
    const prods = await queryFn(`SELECT sku FROM products WHERE tenant_id = $1 ORDER BY sku`, [
      tenantId,
    ]);
    expect(prods.rows.every((r) => r.sku.startsWith('RTL-'))).toBe(true);
  });
});
