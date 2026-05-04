// P2-03 Audit logging foundation tests.
//
// Covers:
//   - audit_logs row written by login + logout (auth hook).
//   - logAudit + logAuditWithTenant helpers insert correctly + inherit
//     tenant scope.
//   - GET /audit-log returns rows for the current tenant only (RLS).
//   - Filters: user_id, entity, entity_id, action, from, to.
//   - Pagination: limit + offset + total.
//   - CSV export header + escaping.
//   - Tier gating: lite tenant gets 403; advance tenant gets 200.
//   - requireAdmin: cashier role gets 403.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let queryFn;
let runAsSystem;
let runWithTenant;
let logAudit;
let logAuditWithTenant;
let ACTIONS;

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  ({ query: queryFn, runAsSystem, runWithTenant } = require('../db'));
  ({ logAudit, logAuditWithTenant, ACTIONS } = require('../lib/audit'));
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

async function registerTenant(slug, tier = 'advance') {
  const r = await request(app).post('/api/v1/tenant/register').send({
    tenant_slug: slug,
    tenant_name: slug,
    tier,
    admin_username: `${slug}_admin`,
    admin_password: 'rahasia123',
    admin_name: `${slug} Admin`,
  });
  expect(r.status).toBe(201);
  return { tenantId: r.body.tenant.id, userId: r.body.user.id, token: r.body.token };
}

describe('audit_logs table + helpers', () => {
  it('logAuditWithTenant inserts a row with explicit tenant_id', async () => {
    const id = await logAuditWithTenant({
      tenant_id: 1,
      user_id: 1,
      ip: '127.0.0.1',
      user_agent: 'vitest/1.0',
      entity: 'product',
      entity_id: '42',
      action: ACTIONS.CREATE,
      after: { name: 'Coffee', price: 25000 },
    });
    expect(id).toBeTruthy();
    const r = await queryFn(
      `SELECT id, tenant_id, user_id, entity, entity_id, action,
              before_json, after_json, host(ip) AS ip, user_agent
         FROM audit_logs WHERE id = $1`,
      [id]
    );
    expect(r.rows[0]).toMatchObject({
      tenant_id: 1,
      user_id: 1,
      entity: 'product',
      entity_id: '42',
      action: 'create',
      ip: '127.0.0.1',
      user_agent: 'vitest/1.0',
    });
    expect(r.rows[0].after_json).toEqual({ name: 'Coffee', price: 25000 });
    expect(r.rows[0].before_json).toBeNull();
  });

  it('logAudit (req-based) reads user_id + ip + user-agent from req', async () => {
    const fakeReq = {
      user: { id: 1, tenant_id: 1 },
      ip: '10.0.0.1',
      headers: { 'user-agent': 'CurlAgent/2.0' },
    };
    const id = await runWithTenant(1, () =>
      logAudit(fakeReq, {
        entity: 'customer',
        entity_id: '99',
        action: ACTIONS.UPDATE,
        before: { name: 'Old' },
        after: { name: 'New' },
      })
    );
    expect(id).toBeTruthy();
    const r = await queryFn(
      `SELECT user_id, entity, action, before_json, after_json, host(ip) AS ip, user_agent
         FROM audit_logs WHERE id = $1`,
      [id]
    );
    expect(r.rows[0]).toMatchObject({
      user_id: 1,
      entity: 'customer',
      action: 'update',
      ip: '10.0.0.1',
      user_agent: 'CurlAgent/2.0',
    });
    expect(r.rows[0].before_json).toEqual({ name: 'Old' });
    expect(r.rows[0].after_json).toEqual({ name: 'New' });
  });

  it('logAudit strips ::ffff:: IPv4-mapped IPv6 prefix before INSERT', async () => {
    const fakeReq = {
      user: { id: 1 },
      ip: '::ffff:192.168.1.5',
      headers: {},
    };
    const id = await runWithTenant(1, () =>
      logAudit(fakeReq, {
        entity: 'session',
        action: ACTIONS.LOGIN,
      })
    );
    const r = await queryFn(`SELECT host(ip) AS ip FROM audit_logs WHERE id = $1`, [id]);
    expect(r.rows[0].ip).toBe('192.168.1.5');
  });

  it('logAudit throws when entity / action missing', async () => {
    await expect(logAudit({}, { entity: 'foo' })).rejects.toThrow();
    await expect(logAudit({}, { action: 'create' })).rejects.toThrow();
  });
});

describe('login + logout audit hooks', () => {
  it('writes a session=login row on successful login', async () => {
    const { user } = await loginAsAdmin();
    const r = await runAsSystem(() =>
      queryFn(
        `SELECT user_id, entity, action FROM audit_logs
          WHERE user_id = $1 AND action = 'login'
          ORDER BY id DESC LIMIT 1`,
        [user.id]
      )
    );
    expect(r.rows[0]).toMatchObject({
      user_id: user.id,
      entity: 'session',
      action: 'login',
    });
  });

  it('writes a session=logout row on successful logout', async () => {
    const login = await loginAsAdmin();
    const before = await runAsSystem(() =>
      queryFn(`SELECT count(*)::int AS c FROM audit_logs WHERE action = 'logout'`)
    );
    const out = await request(app)
      .post('/api/auth/logout')
      .send({ refresh_token: login.refresh_token });
    expect(out.status).toBe(204);
    const after = await runAsSystem(() =>
      queryFn(`SELECT count(*)::int AS c FROM audit_logs WHERE action = 'logout'`)
    );
    expect(after.rows[0].c).toBe(before.rows[0].c + 1);
  });
});

describe('GET /api/v1/audit-log', () => {
  it('200 admin advance tenant — lists audit rows for own tenant only (RLS)', async () => {
    const a = await registerTenant('audit-tenant-a', 'advance');
    const b = await registerTenant('audit-tenant-b', 'advance');

    // Seed 2 rows in tenant A and 1 in tenant B.
    await logAuditWithTenant({
      tenant_id: a.tenantId,
      user_id: a.userId,
      entity: 'product',
      entity_id: 'A1',
      action: 'create',
      after: { name: 'A' },
    });
    await logAuditWithTenant({
      tenant_id: a.tenantId,
      user_id: a.userId,
      entity: 'customer',
      entity_id: 'A2',
      action: 'update',
      before: { name: 'old' },
      after: { name: 'new' },
    });
    await logAuditWithTenant({
      tenant_id: b.tenantId,
      user_id: b.userId,
      entity: 'product',
      entity_id: 'B1',
      action: 'create',
      after: { name: 'B' },
    });

    // Filter to the seeded entity types so the implicit `login` row from
    // tenant registration doesn't pollute the assertion.
    const resA = await request(app)
      .get('/api/v1/audit-log?entity=product')
      .set('Authorization', `Bearer ${a.token}`);
    expect(resA.status).toBe(200);
    expect(Array.isArray(resA.body.rows)).toBe(true);
    expect(resA.body.rows.find((r) => r.entity_id === 'A1')).toBeTruthy();
    // RLS must hide tenant B's row.
    expect(resA.body.rows.find((r) => r.entity_id === 'B1')).toBeFalsy();
    expect(resA.body.total).toBe(1);
  });

  it('filters by entity + action + entity_id', async () => {
    const t = await registerTenant('audit-filter', 'advance');
    await logAuditWithTenant({
      tenant_id: t.tenantId,
      user_id: t.userId,
      entity: 'product',
      entity_id: '7',
      action: 'create',
      after: { x: 1 },
    });
    await logAuditWithTenant({
      tenant_id: t.tenantId,
      user_id: t.userId,
      entity: 'product',
      entity_id: '7',
      action: 'update',
      before: { x: 1 },
      after: { x: 2 },
    });
    await logAuditWithTenant({
      tenant_id: t.tenantId,
      user_id: t.userId,
      entity: 'customer',
      entity_id: '9',
      action: 'create',
    });

    const res = await request(app)
      .get('/api/v1/audit-log?entity=product&action=update&entity_id=7')
      .set('Authorization', `Bearer ${t.token}`);
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0]).toMatchObject({
      entity: 'product',
      entity_id: '7',
      action: 'update',
    });
  });

  it('filters by from/to date range', async () => {
    const t = await registerTenant('audit-date', 'advance');
    await logAuditWithTenant({
      tenant_id: t.tenantId,
      user_id: t.userId,
      entity: 'product',
      entity_id: 'D',
      action: 'create',
    });
    const future = new Date(Date.now() + 24 * 3600_000).toISOString();
    const r = await request(app)
      .get(`/api/v1/audit-log?from=${encodeURIComponent(future)}`)
      .set('Authorization', `Bearer ${t.token}`);
    expect(r.status).toBe(200);
    // No row should be in the future.
    const matching = r.body.rows.filter((x) => x.entity_id === 'D');
    expect(matching).toHaveLength(0);
  });

  it('paginates via limit + offset', async () => {
    const t = await registerTenant('audit-page', 'advance');
    for (let i = 0; i < 5; i += 1) {
      await logAuditWithTenant({
        tenant_id: t.tenantId,
        user_id: t.userId,
        entity: 'product',
        entity_id: `P${i}`,
        action: 'create',
      });
    }
    const page1 = await request(app)
      .get('/api/v1/audit-log?limit=2&offset=0&entity=product')
      .set('Authorization', `Bearer ${t.token}`);
    expect(page1.status).toBe(200);
    expect(page1.body.rows).toHaveLength(2);
    expect(page1.body.total).toBe(5);
    expect(page1.body.limit).toBe(2);
    expect(page1.body.offset).toBe(0);

    const page2 = await request(app)
      .get('/api/v1/audit-log?limit=2&offset=2&entity=product')
      .set('Authorization', `Bearer ${t.token}`);
    expect(page2.body.rows).toHaveLength(2);
    const ids1 = page1.body.rows.map((r) => r.id);
    const ids2 = page2.body.rows.map((r) => r.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  it('caps limit at 500', async () => {
    const t = await registerTenant('audit-cap', 'advance');
    const res = await request(app)
      .get('/api/v1/audit-log?limit=99999')
      .set('Authorization', `Bearer ${t.token}`);
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(500);
  });

  it('403 — lite tenant blocked by tier gate', async () => {
    const t = await registerTenant('audit-lite', 'lite');
    const res = await request(app)
      .get('/api/v1/audit-log')
      .set('Authorization', `Bearer ${t.token}`);
    expect(res.status).toBe(403);
    expect(res.body.required_tier).toBe('advance');
  });

  it('403 — non-admin user blocked by requireAdmin', async () => {
    const t = await registerTenant('audit-nonadmin', 'advance');
    // Demote the tenant admin to cashier and re-login.
    await runAsSystem(() =>
      queryFn(`UPDATE users SET role = 'cashier' WHERE id = $1`, [t.userId])
    );
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'audit-nonadmin_admin', password: 'rahasia123' });
    expect(login.status).toBe(200);
    const res = await request(app)
      .get('/api/v1/audit-log')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/audit-log/export.csv', () => {
  it('returns CSV with header + escaped cells', async () => {
    const t = await registerTenant('audit-csv', 'advance');
    await logAuditWithTenant({
      tenant_id: t.tenantId,
      user_id: t.userId,
      entity: 'product',
      entity_id: 'P1',
      action: 'create',
      after: { name: 'Has, comma "and quote"' },
    });
    const res = await request(app)
      .get('/api/v1/audit-log/export.csv')
      .set('Authorization', `Bearer ${t.token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/audit-log\.csv/);
    const text = res.text;
    expect(text.split('\n')[0]).toBe(
      'id,user_id,entity,entity_id,action,before_json,after_json,ip,user_agent,created_at'
    );
    // The JSON cell must be quoted (because it contains a comma) and the
    // inner double quotes must be doubled per RFC 4180. We only assert the
    // structural pieces — exact JSON serialization is implementation-detail.
    expect(text).toContain('"{');
    expect(text).toContain('}"');
    expect(text).toContain('""'); // doubled-quote escape present
    expect(text).toContain('Has, comma');
  });
});
