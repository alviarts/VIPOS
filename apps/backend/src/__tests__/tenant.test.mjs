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

describe('POST /api/v1/tenant/register', () => {
  it('201 — membuat tenant + admin user pertama dan mengembalikan token', async () => {
    const res = await request(app).post('/api/v1/tenant/register').send({
      tenant_slug: 'merchant-acme',
      tenant_name: 'Merchant Acme',
      tier: 'starter',
      admin_username: 'acme_admin',
      admin_password: 'rahasia123',
      admin_name: 'Acme Admin',
      admin_email: 'admin@acme.test',
    });
    expect(res.status).toBe(201);
    expect(res.body.tenant).toMatchObject({
      slug: 'merchant-acme',
      name: 'Merchant Acme',
      tier: 'starter',
      status: 'active',
    });
    expect(res.body.user).toMatchObject({
      username: 'acme_admin',
      role: 'admin',
      email: 'admin@acme.test',
    });
    expect(res.body.user.tenant_id).toBe(res.body.tenant.id);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.refresh_token).toBeTypeOf('string');

    // tenant_users mapping inserted
    const r = await queryFn(
      'SELECT role, is_default FROM tenant_users WHERE tenant_id = $1 AND user_id = $2',
      [res.body.tenant.id, res.body.user.id]
    );
    expect(r.rows[0]).toMatchObject({ role: 'admin', is_default: true });
  });

  it('409 — slug duplikat', async () => {
    await request(app).post('/api/v1/tenant/register').send({
      tenant_slug: 'merchant-dup',
      tenant_name: 'Dup 1',
      tier: 'lite',
      admin_username: 'dup1_admin',
      admin_password: 'rahasia123',
      admin_name: 'Dup 1',
    });
    const res = await request(app).post('/api/v1/tenant/register').send({
      tenant_slug: 'merchant-dup',
      tenant_name: 'Dup 2',
      tier: 'lite',
      admin_username: 'dup2_admin',
      admin_password: 'rahasia123',
      admin_name: 'Dup 2',
    });
    expect(res.status).toBe(409);
  });

  it('400 — slug invalid (uppercase)', async () => {
    const res = await request(app).post('/api/v1/tenant/register').send({
      tenant_slug: 'BAD-SLUG',
      tenant_name: 'Bad',
      admin_username: 'bad_admin',
      admin_password: 'rahasia123',
      admin_name: 'Bad',
    });
    expect(res.status).toBe(400);
  });

  it('400 — password terlalu pendek', async () => {
    const res = await request(app).post('/api/v1/tenant/register').send({
      tenant_slug: 'merchant-pw',
      tenant_name: 'PW',
      admin_username: 'pw_admin',
      admin_password: '123',
      admin_name: 'PW',
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/tenant/me', () => {
  it('200 — mengembalikan tenant default untuk admin login', async () => {
    const { token } = await loginAsAdmin();
    const res = await request(app).get('/api/v1/tenant/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 1,
      slug: 'default',
      name: 'Default Tenant',
      tier: 'advance',
      status: 'active',
    });
  });

  it('401 tanpa token', async () => {
    const res = await request(app).get('/api/v1/tenant/me');
    expect(res.status).toBe(401);
  });
});

describe('JWT payload includes tenant_id', () => {
  it('login admin → JWT decode menghasilkan tenant_id', async () => {
    const { token } = await loginAsAdmin();
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.tenant_id).toBe(1);
    expect(decoded.role).toBe('admin');
  });
});

describe('Admin tenant endpoints (super_admin only)', () => {
  async function loginAsSuperAdmin() {
    // Promote admin to super_admin for this test.
    await queryFn("UPDATE users SET role = 'super_admin' WHERE username = 'admin'");
    return loginAsAdmin();
  }

  async function loginAsRegularAdmin() {
    await queryFn("UPDATE users SET role = 'admin' WHERE username = 'admin'");
    return loginAsAdmin();
  }

  it('403 — admin biasa tidak bisa list', async () => {
    const { token } = await loginAsRegularAdmin();
    const res = await request(app).get('/api/admin/tenant').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('200 — super_admin dapat list semua tenant', async () => {
    const { token } = await loginAsSuperAdmin();
    const res = await request(app).get('/api/admin/tenant').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.find((t) => t.slug === 'default')).toBeTruthy();
  });

  it('PATCH update tier + status', async () => {
    const { token } = await loginAsSuperAdmin();
    // Create a tenant first
    const created = await request(app)
      .post('/api/admin/tenant')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'patch-target', name: 'Patch Target', tier: 'lite' });
    expect(created.status).toBe(201);
    const id = created.body.id;
    const patched = await request(app)
      .patch(`/api/admin/tenant/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tier: 'prime', status: 'suspended' });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ id, tier: 'prime', status: 'suspended' });
  });

  it('DELETE archives tenant (sets status=archived) but blocks default tenant', async () => {
    const { token } = await loginAsSuperAdmin();
    const blocked = await request(app)
      .delete('/api/admin/tenant/1')
      .set('Authorization', `Bearer ${token}`);
    expect(blocked.status).toBe(400);

    const created = await request(app)
      .post('/api/admin/tenant')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'to-archive', name: 'To Archive' });
    const archived = await request(app)
      .delete(`/api/admin/tenant/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(archived.status).toBe(200);
    const fetched = await request(app)
      .get(`/api/admin/tenant/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(fetched.body.status).toBe('archived');
  });
});

describe('Cross-tenant isolation (smoke — /api/auth/users + /register)', () => {
  it('admin tenant A hanya melihat user-nya sendiri di /api/auth/users', async () => {
    // Bikin tenant baru via /register endpoint
    const tenantA = await request(app).post('/api/v1/tenant/register').send({
      tenant_slug: 'iso-tenant-a',
      tenant_name: 'Iso A',
      tier: 'starter',
      admin_username: 'iso_a_admin',
      admin_password: 'rahasia123',
      admin_name: 'Iso A',
    });
    expect(tenantA.status).toBe(201);
    const tenantB = await request(app).post('/api/v1/tenant/register').send({
      tenant_slug: 'iso-tenant-b',
      tenant_name: 'Iso B',
      tier: 'starter',
      admin_username: 'iso_b_admin',
      admin_password: 'rahasia123',
      admin_name: 'Iso B',
    });
    expect(tenantB.status).toBe(201);

    // Login as tenant A and create a second user in tenant A
    const loginA = await request(app).post('/api/auth/login').send({
      username: 'iso_a_admin',
      password: 'rahasia123',
    });
    const tokenA = loginA.body.token;
    await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ username: 'iso_a_staff', password: 'rahasia123', name: 'A Staff', role: 'cashier' });

    // Login as tenant B and create a second user in tenant B
    const loginB = await request(app).post('/api/auth/login').send({
      username: 'iso_b_admin',
      password: 'rahasia123',
    });
    const tokenB = loginB.body.token;
    await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ username: 'iso_b_staff', password: 'rahasia123', name: 'B Staff', role: 'cashier' });

    // Tenant A admin /api/auth/users should NOT list tenant B users
    const usersA = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(usersA.status).toBe(200);
    const usernamesA = usersA.body.map((u) => u.username);
    expect(usernamesA).toContain('iso_a_admin');
    expect(usernamesA).toContain('iso_a_staff');
    expect(usernamesA).not.toContain('iso_b_admin');
    expect(usernamesA).not.toContain('iso_b_staff');

    const usersB = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(usersB.status).toBe(200);
    const usernamesB = usersB.body.map((u) => u.username);
    expect(usernamesB).toContain('iso_b_admin');
    expect(usernamesB).not.toContain('iso_a_admin');
  });
});

describe('requireTier middleware', () => {
  it('blocks request when tenant tier rank < required', async () => {
    const { requireTier } = require('../middleware/tier');
    const next = (() => {
      let called = false;
      const fn = () => {
        called = true;
      };
      fn.wasCalled = () => called;
      return fn;
    })();

    // Prepare a low-tier tenant
    await queryFn("UPDATE tenants SET tier = 'lite' WHERE id = 1");

    const status = { code: 200 };
    const res = {
      status(code) {
        status.code = code;
        return this;
      },
      json() {
        return this;
      },
    };
    const guard = requireTier('prime');
    await guard({ tenantId: 1 }, res, next);
    expect(status.code).toBe(403);
    expect(next.wasCalled()).toBe(false);
  });

  it('allows request when tenant tier rank >= required', async () => {
    const { requireTier } = require('../middleware/tier');
    let called = false;
    const next = () => {
      called = true;
    };
    await queryFn("UPDATE tenants SET tier = 'prime' WHERE id = 1");
    const res = {
      status() {
        return this;
      },
      json() {
        return this;
      },
    };
    const guard = requireTier('starter');
    await guard({ tenantId: 1 }, res, next);
    expect(called).toBe(true);
  });

  it('rejects unknown tenant', async () => {
    const { requireTier } = require('../middleware/tier');
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };
    const captured = { code: 0 };
    const res = {
      status(c) {
        captured.code = c;
        return this;
      },
      json() {
        return this;
      },
    };
    const guard = requireTier('lite');
    await guard({ tenantId: 999999 }, res, next);
    expect(captured.code).toBe(403);
    expect(nextCalled).toBe(false);
  });
});
