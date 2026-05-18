import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let token;

async function login() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  return res.body.token;
}

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  token = await login();
});

afterAll(async () => {
  await teardownTestEnv();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('P1-16 Outlet', () => {
  it('seeds default outlet OUT-001', async () => {
    const r = await request(app).get('/api/outlet').set(auth());
    expect(r.status).toBe(200);
    expect(r.body.find((o) => o.code === 'OUT-001')).toBeTruthy();
  });

  it('creates new outlet with auto-code', async () => {
    const r = await request(app).post('/api/outlet').set(auth()).send({
      name: 'Outlet Bandung',
      city: 'Bandung',
    });
    expect(r.status).toBe(201);
    expect(r.body.id).toBeTruthy();
  });

  it('manages floor plan for outlet', async () => {
    const get = await request(app).get('/api/outlet/1/floor-plan').set(auth());
    expect(get.status).toBe(200);
    expect(get.body.tables).toEqual([]);

    const upd = await request(app)
      .put('/api/outlet/1/floor-plan')
      .set(auth())
      .send({
        name: 'Lantai 1',
        width: 1200,
        height: 800,
        tables: [
          { id: 't1', x: 100, y: 100, w: 80, h: 80, label: 'M1' },
          { id: 't2', x: 200, y: 100, w: 80, h: 80, label: 'M2' },
        ],
      });
    expect(upd.status).toBe(200);

    const get2 = await request(app).get('/api/outlet/1/floor-plan').set(auth());
    expect(get2.body.tables.length).toBe(2);
    expect(get2.body.width).toBe(1200);
  });
});

describe('P1-16 Terminal', () => {
  it('creates and lists terminals', async () => {
    const c = await request(app).post('/api/terminal').set(auth()).send({
      name: 'Kasir 1',
      type: 'cashier',
      outlet_id: 1,
      ip_address: '192.168.1.10',
    });
    expect(c.status).toBe(201);

    const l = await request(app).get('/api/terminal').set(auth());
    expect(l.body.find((t) => t.name === 'Kasir 1')).toBeTruthy();
  });

  it('records terminal heartbeat', async () => {
    const list = await request(app).get('/api/terminal').set(auth());
    const t = list.body[0];
    const r = await request(app).post(`/api/terminal/${t.id}/heartbeat`).set(auth());
    expect(r.status).toBe(200);
  });
});

describe('P1-16 App Settings (key-value)', () => {
  it('upserts and retrieves settings by category', async () => {
    const upd = await request(app)
      .put('/api/setting')
      .set(auth())
      .send({
        category: 'receipt',
        key: 'header',
        value: { line1: 'VIPOS', line2: 'Outlet Pusat' },
      });
    expect([200, 201]).toContain(upd.status);

    const get = await request(app).get('/api/setting?category=receipt').set(auth());
    const item = get.body.find((s) => s.key === 'header');
    expect(item.value.line1).toBe('VIPOS');
  });

  it('updates existing setting', async () => {
    const upd1 = await request(app)
      .put('/api/setting')
      .set(auth())
      .send({ category: 'cashier', key: 'open_balance', value: 100000 });
    expect([200, 201]).toContain(upd1.status);

    const upd2 = await request(app)
      .put('/api/setting')
      .set(auth())
      .send({ category: 'cashier', key: 'open_balance', value: 200000 });
    expect(upd2.status).toBe(200);

    const get = await request(app).get('/api/setting?category=cashier').set(auth());
    expect(get.body[0].value).toBe(200000);
  });
});

describe('P1-16 Notification Preferences', () => {
  it('upserts user notification preferences', async () => {
    const r = await request(app).put('/api/notification-pref').set(auth()).send({
      event_key: 'low_stock',
      via_push: true,
      via_email: true,
      via_wa: false,
      via_sms: false,
    });
    expect(r.status).toBe(200);

    const list = await request(app).get('/api/notification-pref').set(auth());
    const pref = list.body.find((p) => p.event_key === 'low_stock');
    expect(pref.via_push).toBe(1);
    expect(pref.via_email).toBe(1);
  });
});

describe('P1-16 Payment Methods + Tax + UoM seed', () => {
  it('seeds default payment methods (CASH/QRIS/etc)', async () => {
    const r = await request(app).get('/api/payment-method').set(auth());
    expect(r.body.find((p) => p.code === 'CASH')).toBeTruthy();
    expect(r.body.find((p) => p.code === 'QRIS')).toBeTruthy();
  });

  it('seeds default tax rates (PPN/SVC/PB1)', async () => {
    const r = await request(app).get('/api/tax-rate').set(auth());
    expect(r.body.find((t) => t.code === 'PPN').rate).toBe(11);
    expect(r.body.find((t) => t.code === 'PB1').rate).toBe(10);
  });

  it('creates custom UoM', async () => {
    const r = await request(app).post('/api/uom').set(auth()).send({
      code: 'DOZ',
      name: 'Dozen',
      symbol: 'doz',
      conversion_factor: 12,
    });
    expect(r.status).toBe(201);
    const list = await request(app).get('/api/uom').set(auth());
    expect(list.body.find((u) => u.code === 'DOZ')).toBeTruthy();
  });
});

describe('P1-16 Support Access Grants', () => {
  it('creates and revokes support access grant', async () => {
    const c = await request(app)
      .post('/api/support-access')
      .set(auth())
      .send({
        grantee_email: 'support@vipos.id',
        reason: 'Debug payroll bug',
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      });
    expect(c.status).toBe(201);

    const r = await request(app).post(`/api/support-access/${c.body.id}/revoke`).set(auth());
    expect(r.status).toBe(200);

    const list = await request(app).get('/api/support-access').set(auth());
    const g = list.body.find((x) => x.id === c.body.id);
    expect(g.revoked_at).toBeTruthy();
  });
});

describe('P1-16 Account Profile + Change Password', () => {
  it('reads and updates current user profile', async () => {
    const r = await request(app).get('/api/account-profile').set(auth());
    expect(r.body.username).toBe('admin');
    const u = await request(app).put('/api/account-profile').set(auth()).send({
      phone: '08123456789',
      photo_url: 'https://example.com/avatar.png',
    });
    expect(u.status).toBe(200);
    const after = await request(app).get('/api/account-profile').set(auth());
    expect(after.body.phone).toBe('08123456789');
  });

  it('rejects wrong current password', async () => {
    const r = await request(app)
      .post('/api/account-profile/change-password')
      .set(auth())
      .send({ current_password: 'wrong', new_password: 'newpass1' });
    expect(r.status).toBe(400);
  });

  it('changes password successfully', async () => {
    const r = await request(app)
      .post('/api/account-profile/change-password')
      .set(auth())
      .send({ current_password: 'admin123', new_password: 'admin123x' });
    expect(r.status).toBe(200);

    // Restore for downstream tests.
    const r2 = await request(app)
      .post('/api/account-profile/change-password')
      .set(auth())
      .send({ current_password: 'admin123x', new_password: 'admin123' });
    expect(r2.status).toBe(200);
  });
});

describe('P1-16 Import/Export', () => {
  it('lists available entities', async () => {
    const r = await request(app).get('/api/import-export/entities').set(auth());
    expect(r.body.length).toBeGreaterThanOrEqual(3);
  });

  it('exports gl_accounts as CSV', async () => {
    const r = await request(app)
      .get('/api/import-export/export/gl_accounts?format=csv')
      .set(auth());
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/csv/);
    expect(r.text.split('\n').length).toBeGreaterThan(1);
  });

  it('rejects unknown entity', async () => {
    const r = await request(app)
      .get('/api/import-export/export/unknown_table?format=csv')
      .set(auth());
    expect(r.status).toBe(400);
  });
});
