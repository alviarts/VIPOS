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
});

afterAll(async () => {
  await teardownTestEnv();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

async function createDept(name, extra = {}) {
  const res = await request(app)
    .post('/api/departments')
    .set(auth())
    .send({ name, ...extra });
  return res;
}

async function createCat(name, department_id, extra = {}) {
  const res = await request(app)
    .post('/api/categories')
    .set(auth())
    .send({ name, department_id, ...extra });
  return res;
}

describe('GET /api/departments', () => {
  it('200 + array (mungkin kosong di DB fresh)', async () => {
    const res = await request(app).get('/api/departments').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('401 tanpa auth', async () => {
    const res = await request(app).get('/api/departments');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/departments', () => {
  it('400 kalau name kosong', async () => {
    const res = await request(app).post('/api/departments').set(auth()).send({});
    expect(res.status).toBe(400);
    const paths = (res.body.details || []).map((d) => d.path);
    expect(paths).toContain('name');
  });

  it('201 + default urutan=0, is_active=1', async () => {
    const res = await createDept('Beverages');
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTypeOf('number');
    expect(res.body.name).toBe('Beverages');
    expect(res.body.urutan).toBe(0);
    expect(res.body.is_active).toBe(1);
  });

  it('400 kalau name duplikat', async () => {
    const r1 = await createDept('Food');
    expect(r1.status).toBe(201);
    const r2 = await createDept('Food');
    expect(r2.status).toBe(400);
    expect(r2.body.error).toMatch(/sudah ada/i);
  });
});

describe('PUT /api/departments/:id', () => {
  it('200 + partial update preserves description', async () => {
    const created = await createDept('Snacks', { description: 'Camilan' });
    const id = created.body.id;
    const res = await request(app).put(`/api/departments/${id}`).set(auth()).send({ urutan: 5 });
    expect(res.status).toBe(200);
    expect(res.body.urutan).toBe(5);
    expect(res.body.description).toBe('Camilan');
  });

  it('404 kalau departemen tidak ada', async () => {
    const res = await request(app).put('/api/departments/999999').set(auth()).send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/departments/reorder', () => {
  it('200 + assign urutan = index', async () => {
    const a = await createDept('Bakery');
    const b = await createDept('Dairy');
    const c = await createDept('Frozen');

    const res = await request(app)
      .post('/api/departments/reorder')
      .set(auth())
      .send({ ids: [c.body.id, a.body.id, b.body.id] });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(3);

    const list = await request(app).get('/api/departments').set(auth());
    const byId = Object.fromEntries(list.body.map((d) => [d.id, d]));
    expect(byId[c.body.id].urutan).toBe(0);
    expect(byId[a.body.id].urutan).toBe(1);
    expect(byId[b.body.id].urutan).toBe(2);
  });

  it('400 kalau ids kosong', async () => {
    const res = await request(app).post('/api/departments/reorder').set(auth()).send({ ids: [] });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/departments/:id', () => {
  it('400 kalau masih dipakai kategori', async () => {
    const dept = await createDept('Drinks-WithCat');
    const cat = await createCat('Coffee-DeleteTest', dept.body.id);
    expect(cat.status).toBe(201);

    const res = await request(app).delete(`/api/departments/${dept.body.id}`).set(auth());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/dipakai/i);
  });

  it('200 kalau departemen kosong', async () => {
    const dept = await createDept('Drinks-Empty');
    const res = await request(app).delete(`/api/departments/${dept.body.id}`).set(auth());
    expect(res.status).toBe(200);
  });
});

describe('POST /api/categories/reorder', () => {
  it('200 + reorder kategori dalam departemen', async () => {
    const dept = await createDept('Reorder-Cat-Dept');
    const c1 = await createCat('Cat-A', dept.body.id);
    const c2 = await createCat('Cat-B', dept.body.id);
    const c3 = await createCat('Cat-C', dept.body.id);

    const res = await request(app)
      .post('/api/categories/reorder')
      .set(auth())
      .send({ ids: [c3.body.id, c1.body.id, c2.body.id] });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(3);

    const list = await request(app).get('/api/categories').set(auth());
    const byId = Object.fromEntries(list.body.map((c) => [c.id, c]));
    expect(byId[c3.body.id].urutan).toBe(0);
    expect(byId[c1.body.id].urutan).toBe(1);
    expect(byId[c2.body.id].urutan).toBe(2);
  });

  it('200 + move kategori ke departemen lain', async () => {
    const deptA = await createDept('Move-From');
    const deptB = await createDept('Move-To');
    const cat = await createCat('Cat-Move', deptA.body.id);

    const res = await request(app)
      .post('/api/categories/reorder')
      .set(auth())
      .send({ ids: [cat.body.id], department_id: deptB.body.id });
    expect(res.status).toBe(200);

    const fetched = await request(app).get(`/api/categories/${cat.body.id}`).set(auth());
    expect(fetched.body.department_id).toBe(deptB.body.id);
  });

  it('200 + move kategori ke "Tanpa Departemen" (department_id=null)', async () => {
    const dept = await createDept('Move-FromOnly');
    const cat = await createCat('Cat-MoveNull', dept.body.id);

    const res = await request(app)
      .post('/api/categories/reorder')
      .set(auth())
      .send({ ids: [cat.body.id], department_id: null });
    expect(res.status).toBe(200);

    const fetched = await request(app).get(`/api/categories/${cat.body.id}`).set(auth());
    expect(fetched.body.department_id).toBeNull();
  });
});

describe('Categories color + icon_url', () => {
  it('201 dengan color hex + icon_url', async () => {
    const dept = await createDept('Color-Dept');
    const res = await createCat('CatWithColor', dept.body.id, {
      color: '#04C99E',
      icon_url: '/uploads/icons/coffee.png',
    });
    expect(res.status).toBe(201);
    expect(res.body.color).toBe('#04C99E');
    expect(res.body.icon_url).toBe('/uploads/icons/coffee.png');
  });

  it('400 kalau color bukan hex', async () => {
    const dept = await createDept('Bad-Color-Dept');
    const res = await createCat('BadColor', dept.body.id, { color: 'red' });
    expect(res.status).toBe(400);
  });

  it('200 kalau update color saja, name preserved', async () => {
    const dept = await createDept('Patch-Color-Dept');
    const cat = await createCat('PatchColor', dept.body.id, { color: '#000000' });
    const res = await request(app)
      .put(`/api/categories/${cat.body.id}`)
      .set(auth())
      .send({ color: '#FFFFFF' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('PatchColor');
    expect(res.body.color).toBe('#FFFFFF');
  });
});
