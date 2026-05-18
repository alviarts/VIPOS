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

describe('Cross-tenant isolation (RLS — products, categories, customers, transactions)', () => {
  // Two fully isolated tenants share the same backend; each writes its own
  // products/customers/transactions and we assert they cannot see each other's
  // rows even though we are not adding `WHERE tenant_id = ?` to the route SQL —
  // it is enforced purely by Postgres RLS policies driven by the
  // `app.current_tenant` GUC set by the auth middleware.
  let tokenC;
  let tokenD;

  beforeAll(async () => {
    const tenantC = await request(app).post('/api/v1/tenant/register').send({
      tenant_slug: 'rls-tenant-c',
      tenant_name: 'RLS C',
      tier: 'advance',
      admin_username: 'rls_c_admin',
      admin_password: 'rahasia123',
      admin_name: 'RLS C',
    });
    expect(tenantC.status).toBe(201);
    tokenC = tenantC.body.access_token || tenantC.body.token;

    const tenantD = await request(app).post('/api/v1/tenant/register').send({
      tenant_slug: 'rls-tenant-d',
      tenant_name: 'RLS D',
      tier: 'advance',
      admin_username: 'rls_d_admin',
      admin_password: 'rahasia123',
      admin_name: 'RLS D',
    });
    expect(tenantD.status).toBe(201);
    tokenD = tenantD.body.access_token || tenantD.body.token;

    if (!tokenC) {
      const loginC = await request(app)
        .post('/api/auth/login')
        .send({ username: 'rls_c_admin', password: 'rahasia123' });
      tokenC = loginC.body.token;
    }
    if (!tokenD) {
      const loginD = await request(app)
        .post('/api/auth/login')
        .send({ username: 'rls_d_admin', password: 'rahasia123' });
      tokenD = loginD.body.token;
    }
  });

  it('products: tenant C tidak dapat melihat produk tenant D', async () => {
    const catC = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ name: 'Cat C' });
    expect(catC.status).toBe(201);

    const catD = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${tokenD}`)
      .send({ name: 'Cat D' });
    expect(catD.status).toBe(201);

    const prodC = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({
        name: 'Kopi Tenant C',
        sku: 'C-COFFEE',
        price: 25000,
        stock: 100,
        category_id: catC.body.id,
      });
    expect(prodC.status).toBe(201);

    const prodD = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${tokenD}`)
      .send({
        name: 'Kopi Tenant D',
        sku: 'D-COFFEE',
        price: 28000,
        stock: 100,
        category_id: catD.body.id,
      });
    expect(prodD.status).toBe(201);

    const listC = await request(app).get('/api/products').set('Authorization', `Bearer ${tokenC}`);
    expect(listC.status).toBe(200);
    const namesC = listC.body.map((p) => p.name);
    expect(namesC).toContain('Kopi Tenant C');
    expect(namesC).not.toContain('Kopi Tenant D');

    const listD = await request(app).get('/api/products').set('Authorization', `Bearer ${tokenD}`);
    expect(listD.status).toBe(200);
    const namesD = listD.body.map((p) => p.name);
    expect(namesD).toContain('Kopi Tenant D');
    expect(namesD).not.toContain('Kopi Tenant C');

    // Attempting to fetch tenant D's product by id from tenant C's session
    // returns 404 (RLS hides the row from the SELECT entirely).
    const cross = await request(app)
      .get(`/api/products/${prodD.body.id}`)
      .set('Authorization', `Bearer ${tokenC}`);
    expect([403, 404]).toContain(cross.status);
  });

  it('categories: tenant C tidak dapat melihat kategori tenant D', async () => {
    const listC = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${tokenC}`);
    const listD = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${tokenD}`);
    const namesC = listC.body.map((c) => c.name);
    const namesD = listD.body.map((c) => c.name);
    expect(namesC).toContain('Cat C');
    expect(namesC).not.toContain('Cat D');
    expect(namesD).toContain('Cat D');
    expect(namesD).not.toContain('Cat C');
  });

  it('customers: tenant C tidak dapat melihat pelanggan tenant D', async () => {
    const custC = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ name: 'Pelanggan C', phone: '081200000001' });
    expect(custC.status).toBe(201);

    const custD = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${tokenD}`)
      .send({ name: 'Pelanggan D', phone: '081200000002' });
    expect(custD.status).toBe(201);

    const listC = await request(app).get('/api/customers').set('Authorization', `Bearer ${tokenC}`);
    expect(listC.status).toBe(200);
    const rowsC = Array.isArray(listC.body) ? listC.body : listC.body.customers || listC.body.data;
    const namesC = rowsC.map((c) => c.name);
    expect(namesC).toContain('Pelanggan C');
    expect(namesC).not.toContain('Pelanggan D');

    const listD = await request(app).get('/api/customers').set('Authorization', `Bearer ${tokenD}`);
    expect(listD.status).toBe(200);
    const rowsD = Array.isArray(listD.body) ? listD.body : listD.body.customers || listD.body.data;
    const namesD = rowsD.map((c) => c.name);
    expect(namesD).toContain('Pelanggan D');
    expect(namesD).not.toContain('Pelanggan C');
  });

  it('transactions: tenant C tidak dapat melihat transaksi tenant D', async () => {
    // POST /api/transactions creates a transaction.
    const prodList = (
      await request(app).get('/api/products').set('Authorization', `Bearer ${tokenC}`)
    ).body;
    const oneProd = prodList[0];
    expect(oneProd).toBeTruthy();
    const txnC = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({
        items: [{ product_id: oneProd.id, quantity: 1, price: oneProd.price }],
        payment_amount: oneProd.price,
      });
    expect([200, 201]).toContain(txnC.status);

    const prodListD = (
      await request(app).get('/api/products').set('Authorization', `Bearer ${tokenD}`)
    ).body;
    const oneProdD = prodListD[0];
    const txnD = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${tokenD}`)
      .send({
        items: [{ product_id: oneProdD.id, quantity: 1, price: oneProdD.price }],
        payment_amount: oneProdD.price,
      });
    expect([200, 201]).toContain(txnD.status);

    const listC = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${tokenC}`);
    expect(listC.status).toBe(200);
    const rowsC = Array.isArray(listC.body)
      ? listC.body
      : listC.body.data || listC.body.rows || listC.body.transactions || [];
    expect(rowsC.length).toBeGreaterThanOrEqual(1);
    // Every row visible to tenant C must reference tenant C's product (oneProd.id).
    for (const row of rowsC) {
      if (row.id === txnD.body?.id) {
        throw new Error('tenant C should not see transaction from tenant D');
      }
    }

    const listD = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${tokenD}`);
    const rowsD = Array.isArray(listD.body)
      ? listD.body
      : listD.body.data || listD.body.rows || listD.body.transactions || [];
    expect(rowsD.length).toBeGreaterThanOrEqual(1);
    for (const row of rowsD) {
      if (row.id === txnC.body?.id) {
        throw new Error('tenant D should not see transaction from tenant C');
      }
    }
  });

  it('cross-tenant write blocked: tenant C cannot mutate tenant D resource', async () => {
    // First, fetch a tenant-D-owned category from tenant D's session.
    const listD = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${tokenD}`);
    const catD = listD.body.find((c) => c.name === 'Cat D');
    expect(catD).toBeTruthy();

    // From tenant C, try to UPDATE/DELETE that id. RLS makes the row invisible,
    // so the route returns 404 (or 403). Either way the row stays untouched.
    const upd = await request(app)
      .put(`/api/categories/${catD.id}`)
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ name: 'Hijacked' });
    expect([403, 404]).toContain(upd.status);

    // Verify from tenant D that the row is still 'Cat D'.
    const refetch = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${tokenD}`);
    const stillCatD = refetch.body.find((c) => c.id === catD.id);
    expect(stillCatD.name).toBe('Cat D');
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

describe('Tier gating end-to-end on /api/v1 routes', () => {
  // We register a fresh `lite` tenant and prove an Advance-only feature is
  // 403'd at the HTTP boundary, not just at the middleware unit-test level.
  it('lite tenant cannot access /api/v1/marketing (requires advance)', async () => {
    const reg = await request(app).post('/api/v1/tenant/register').send({
      tenant_slug: 'tier-lite-x',
      tenant_name: 'Tier Lite X',
      tier: 'lite',
      admin_username: 'tier_lite_admin',
      admin_password: 'rahasia123',
      admin_name: 'Tier Lite Admin',
    });
    expect(reg.status).toBe(201);
    const liteToken = reg.body.access_token || reg.body.token;
    const login = liteToken
      ? null
      : await request(app)
          .post('/api/auth/login')
          .send({ username: 'tier_lite_admin', password: 'rahasia123' });
    const token = liteToken || login.body.token;

    const res = await request(app)
      .get('/api/v1/marketing/campaign')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.required_tier).toBe('advance');
    expect(res.body.current_tier).toBe('lite');
  });

  it('advance tenant can access /api/v1/marketing/campaign', async () => {
    const reg = await request(app).post('/api/v1/tenant/register').send({
      tenant_slug: 'tier-adv-y',
      tenant_name: 'Tier Advance Y',
      tier: 'advance',
      admin_username: 'tier_adv_admin',
      admin_password: 'rahasia123',
      admin_name: 'Tier Advance Admin',
    });
    expect(reg.status).toBe(201);
    const token =
      reg.body.access_token ||
      reg.body.token ||
      (
        await request(app)
          .post('/api/auth/login')
          .send({ username: 'tier_adv_admin', password: 'rahasia123' })
      ).body.token;

    const res = await request(app)
      .get('/api/v1/marketing/campaign')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
