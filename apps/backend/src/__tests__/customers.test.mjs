import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let adminToken;

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
  adminToken = await login();
});

afterAll(async () => {
  await teardownTestEnv();
});

describe('GET /api/customer-groups', () => {
  it('401 tanpa token', async () => {
    const res = await request(app).get('/api/customer-groups');
    expect(res.status).toBe(401);
  });

  it('200 array kosong di awal', async () => {
    const res = await request(app)
      .get('/api/customer-groups')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/customer-groups', () => {
  it('201 buat grup VIP', async () => {
    const res = await request(app)
      .post('/api/customer-groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'VIP',
        discount_percent: 10,
        points_multiplier: 2,
        color: '#04C99E',
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'VIP',
      discount_percent: 10,
      points_multiplier: 2,
      color: '#04C99E',
    });
  });

  it('400 nama duplikat', async () => {
    const res = await request(app)
      .post('/api/customer-groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'VIP' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sudah/i);
  });

  it('400 nama kosong', async () => {
    const res = await request(app)
      .post('/api/customer-groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('400 warna bukan hex valid', async () => {
    const res = await request(app)
      .post('/api/customer-groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad Color', color: 'red' });
    expect(res.status).toBe(400);
    expect(res.body.location).toBe('body');
  });
});

describe('GET /api/customer-tags', () => {
  it('200 + count default 0', async () => {
    const res = await request(app)
      .get('/api/customer-tags')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/customer-tags', () => {
  it('201 buat 2 tag berbeda', async () => {
    const r1 = await request(app)
      .post('/api/customer-tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Loyal', color: '#10B981' });
    expect(r1.status).toBe(201);

    const r2 = await request(app)
      .post('/api/customer-tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Penghutang' });
    expect(r2.status).toBe(201);
    expect(r2.body.color).toBeNull();
  });

  it('400 duplikat tag', async () => {
    const res = await request(app)
      .post('/api/customer-tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Loyal' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/customers (extended)', () => {
  it('201 buat pelanggan + assign tag + group', async () => {
    const groups = await request(app)
      .get('/api/customer-groups')
      .set('Authorization', `Bearer ${adminToken}`);
    const vipId = groups.body.find((g) => g.name === 'VIP').id;
    const tags = await request(app)
      .get('/api/customer-tags')
      .set('Authorization', `Bearer ${adminToken}`);
    const loyalId = tags.body.find((t) => t.name === 'Loyal').id;

    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Budi Santoso',
        phone: '081234567890',
        email: 'budi@example.com',
        gender: 'L',
        customer_group_id: vipId,
        npwp: '123456789012345',
        province: 'Jawa Barat',
        city: 'Bandung',
        tag_ids: [loyalId],
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Budi Santoso',
      customer_group_id: vipId,
      npwp: '123456789012345',
    });
    expect(res.body.kode).toMatch(/^PLG\d+$/);
  });

  it('400 email format salah', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad Email', email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.location).toBe('body');
  });
});

describe('GET /api/customers (filters)', () => {
  it('200 list ter-enrich dengan group + tags + total_spent', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    const budi = res.body.find((c) => c.name === 'Budi Santoso');
    expect(budi).toBeDefined();
    expect(budi.customer_group_name).toBe('VIP');
    expect(budi.customer_group_color).toBe('#04C99E');
    expect(Array.isArray(budi.tags)).toBe(true);
    expect(budi.tags[0].name).toBe('Loyal');
    expect(budi.total_spent).toBe(0);
    expect(budi.transaction_count).toBe(0);
    expect(budi.last_visit).toBeNull();
  });

  it('filter by group_id', async () => {
    const groups = await request(app)
      .get('/api/customer-groups')
      .set('Authorization', `Bearer ${adminToken}`);
    const vipId = groups.body.find((g) => g.name === 'VIP').id;
    const res = await request(app)
      .get(`/api/customers?group_id=${vipId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.every((c) => c.customer_group_id === vipId)).toBe(true);
  });

  it('filter by tag_id', async () => {
    const tags = await request(app)
      .get('/api/customer-tags')
      .set('Authorization', `Bearer ${adminToken}`);
    const loyalId = tags.body.find((t) => t.name === 'Loyal').id;
    const res = await request(app)
      .get(`/api/customers?tag_id=${loyalId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Budi Santoso');
  });

  it('search by phone', async () => {
    const res = await request(app)
      .get('/api/customers?search=08123456')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.some((c) => c.name === 'Budi Santoso')).toBe(true);
  });
});

describe('PUT /api/customers/:id/tags', () => {
  it('replace tag pelanggan', async () => {
    const list = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`);
    const budiId = list.body.find((c) => c.name === 'Budi Santoso').id;
    const tags = await request(app)
      .get('/api/customer-tags')
      .set('Authorization', `Bearer ${adminToken}`);
    const debtorId = tags.body.find((t) => t.name === 'Penghutang').id;

    const res = await request(app)
      .put(`/api/customers/${budiId}/tags`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tag_ids: [debtorId] });
    expect(res.status).toBe(200);

    const after = await request(app)
      .get(`/api/customers/${budiId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(after.body.tags).toHaveLength(1);
    expect(after.body.tags[0].name).toBe('Penghutang');
  });

  it('clear semua tag dengan tag_ids: []', async () => {
    const list = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`);
    const id = list.body[0].id;
    const res = await request(app)
      .put(`/api/customers/${id}/tags`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tag_ids: [] });
    expect(res.status).toBe(200);
    const after = await request(app)
      .get(`/api/customers/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(after.body.tags).toEqual([]);
  });
});

describe('PUT /api/customers/:id (partial preserve)', () => {
  it('update phone tidak menghapus npwp', async () => {
    const list = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`);
    const budi = list.body.find((c) => c.name === 'Budi Santoso');
    const res = await request(app)
      .put(`/api/customers/${budi.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: budi.name, phone: '081111111111' });
    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('081111111111');
    expect(res.body.npwp).toBe('123456789012345');
    expect(res.body.customer_group_id).toBeTruthy();
  });
});

describe('DELETE /api/customer-groups/:id', () => {
  it('400 jika masih dipakai', async () => {
    const groups = await request(app)
      .get('/api/customer-groups')
      .set('Authorization', `Bearer ${adminToken}`);
    const vipId = groups.body.find((g) => g.name === 'VIP').id;
    const res = await request(app)
      .delete(`/api/customer-groups/${vipId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/digunakan/i);
  });

  it('200 setelah customer pindah group', async () => {
    const list = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`);
    const budi = list.body.find((c) => c.name === 'Budi Santoso');
    await request(app)
      .put(`/api/customers/${budi.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: budi.name, customer_group_id: null });

    const groups = await request(app)
      .get('/api/customer-groups')
      .set('Authorization', `Bearer ${adminToken}`);
    const vipId = groups.body.find((g) => g.name === 'VIP').id;
    const res = await request(app)
      .delete(`/api/customer-groups/${vipId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/customers/export', () => {
  it('200 CSV dengan BOM + header lengkap', async () => {
    const res = await request(app)
      .get('/api/customers/export')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text.startsWith('\uFEFF')).toBe(true);
    expect(res.text).toMatch(/kode,name,phone/);
    expect(res.text).toMatch(/Budi Santoso/);
  });
});

describe('POST /api/customers/import', () => {
  it('insert + update via match phone', async () => {
    const before = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`);
    const beforeCount = before.body.length;

    const res = await request(app)
      .post('/api/customers/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        rows: [
          { name: 'Andi Baru', phone: '082000000001', email: 'andi@example.com' },
          { name: '', phone: '082000000002' }, // skipped
          { name: 'Budi Updated', phone: '081111111111' }, // matches existing Budi
          { name: 'Citra', phone: '082000000003', group_name: 'VIP' }, // VIP already deleted
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(2);
    expect(res.body.updated).toBe(1);
    expect(res.body.skipped).toBe(1);
    expect(res.body.errors[0].row).toBe(2);

    const after = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(after.body.length).toBe(beforeCount + 2);
    const budi = after.body.find((c) => c.phone === '081111111111');
    expect(budi.name).toBe('Budi Updated');
  });

  it('400 body bukan { rows: [...] }', async () => {
    const res = await request(app)
      .post('/api/customers/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ data: [] });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/customers/:id/transactions', () => {
  it('200 array kosong untuk customer tanpa transaksi', async () => {
    const list = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`);
    const id = list.body[0].id;
    const res = await request(app)
      .get(`/api/customers/${id}/transactions`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('404 customer tidak ada', async () => {
    const res = await request(app)
      .get('/api/customers/99999/transactions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
