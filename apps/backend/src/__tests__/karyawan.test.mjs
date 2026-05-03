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
  setupTestEnv();
  ({ buildApp: globalThis.__nope__ } = require('../app'));
  const { buildApp } = require('../app');
  app = buildApp();
  token = await login();
});

afterAll(() => {
  teardownTestEnv();
});

describe('P1-14 Employee CRUD', () => {
  it('creates and lists employee', async () => {
    const create = await request(app)
      .post('/api/employee')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Andi Pratama',
        nik_ktp: '3201010101010001',
        npwp: '12.345.678.9-012.000',
        phone: '0811000111',
        email: 'andi@example.com',
        role: 'cashier',
        bank_name: 'BCA',
        bank_account_no: '1234567890',
        base_salary: 5000000,
      });
    expect(create.status).toBe(201);
    expect(create.body.id).toBeTruthy();
    expect(create.body.employee_no).toMatch(/^EMP\d{4}$/);

    const list = await request(app).get('/api/employee').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);
  });

  it('updates employee status', async () => {
    const create = await request(app)
      .post('/api/employee')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Budi', role: 'staff' });
    const id = create.body.id;
    const upd = await request(app)
      .put(`/api/employee/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'on_leave', position: 'Cashier 1' });
    expect(upd.status).toBe(200);
    expect(upd.body.status).toBe('on_leave');
    expect(upd.body.position).toBe('Cashier 1');
  });

  it('soft-deletes employee (resigned)', async () => {
    const create = await request(app)
      .post('/api/employee')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cici', role: 'staff' });
    const id = create.body.id;
    const del = await request(app)
      .delete(`/api/employee/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
    const detail = await request(app)
      .get(`/api/employee/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.status).toBe('resigned');
    expect(detail.body.date_resigned).toBeTruthy();
  });

  it('manages documents and permissions', async () => {
    const emp = await request(app)
      .post('/api/employee')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dedi', role: 'cashier' });
    const id = emp.body.id;
    const doc = await request(app)
      .post(`/api/employee/${id}/document`)
      .set('Authorization', `Bearer ${token}`)
      .send({ doc_type: 'ktp', file_url: '/uploads/ktp-1.pdf' });
    expect(doc.status).toBe(201);
    const detail = await request(app)
      .get(`/api/employee/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.documents.length).toBe(1);

    const perm = await request(app)
      .put(`/api/employee/${id}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        permissions: [
          { permission_key: 'kasir.refund', granted: true },
          { permission_key: 'inventory.write', granted: false },
        ],
      });
    expect(perm.status).toBe(200);
    expect(perm.body.length).toBe(2);
    const list = await request(app)
      .get(`/api/employee/${id}/permissions`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.length).toBe(2);
  });
});

describe('P1-14 Payroll', () => {
  let structureId;
  let runId;

  it('reads + updates settings', async () => {
    const get = await request(app)
      .get('/api/payroll-settings')
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body.period).toBe('monthly');
    const upd = await request(app)
      .put('/api/payroll-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 'biweekly', cutoff_day: 20 });
    expect(upd.status).toBe(200);
    expect(upd.body.period).toBe('biweekly');
    expect(upd.body.cutoff_day).toBe(20);
  });

  it('creates structure', async () => {
    const res = await request(app)
      .post('/api/payroll-structure')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Kasir Reguler',
        basic_salary: 4_500_000,
        allowances: [
          { key: 'transport', label: 'Transport', amount: 300_000 },
          { key: 'makan', label: 'Makan', amount: 500_000 },
        ],
        deductions: [{ key: 'pinjaman', label: 'Pinjaman', amount: 100_000 }],
        overtime_rate: 25_000,
      });
    expect(res.status).toBe(201);
    structureId = res.body.id;
    expect(res.body.allowances.length).toBe(2);
  });

  it('runs payroll cycle and computes payslips', async () => {
    // Create employees attached to the structure.
    await request(app).post('/api/employee').set('Authorization', `Bearer ${token}`).send({
      name: 'Eka',
      role: 'cashier',
      payroll_structure_id: structureId,
      bank_name: 'BCA',
      bank_account_no: '1111111',
    });
    await request(app).post('/api/employee').set('Authorization', `Bearer ${token}`).send({
      name: 'Fani',
      role: 'cashier',
      payroll_structure_id: structureId,
      bank_name: 'BNI',
      bank_account_no: '2222222',
    });
    const create = await request(app)
      .post('/api/payroll-run')
      .set('Authorization', `Bearer ${token}`)
      .send({
        period_start: '2025-04-01',
        period_end: '2025-04-30',
        payment_date: '2025-05-01',
      });
    expect(create.status).toBe(201);
    expect(create.body.status).toBe('DRAFT');
    runId = create.body.id;

    const calc = await request(app)
      .post(`/api/payroll-run/${runId}/calculate`)
      .set('Authorization', `Bearer ${token}`);
    expect(calc.status).toBe(200);
    expect(calc.body.status).toBe('CALCULATED');
    expect(calc.body.payslips.length).toBeGreaterThanOrEqual(2);
    expect(calc.body.total_gross).toBeGreaterThan(0);
    expect(calc.body.total_net).toBeGreaterThan(0);
    const slip = calc.body.payslips[0];
    expect(slip.gross_salary).toBe(
      slip.basic_salary + slip.total_allowances + slip.overtime_amount
    );
    // BPJS Kesehatan 1% (default).
    expect(slip.bpjs_kesehatan).toBeCloseTo(slip.gross_salary * 0.01, 2);
  });

  it('approves + marks paid', async () => {
    const apv = await request(app)
      .post(`/api/payroll-run/${runId}/approve`)
      .set('Authorization', `Bearer ${token}`);
    expect(apv.status).toBe(200);
    expect(apv.body.status).toBe('APPROVED');
    const paid = await request(app)
      .post(`/api/payroll-run/${runId}/paid`)
      .set('Authorization', `Bearer ${token}`);
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('PAID');
  });

  it('downloads bank file CSV', async () => {
    const res = await request(app)
      .get(`/api/payroll-run/${runId}/bank-file`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toMatch(/employee_no,employee_name/);
  });
});

describe('P1-14 Attendance', () => {
  let employeeId;

  it('logs manual check-in', async () => {
    const emp = await request(app)
      .post('/api/employee')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Galih', role: 'cashier' });
    employeeId = emp.body.id;
    const log = await request(app)
      .post('/api/attendance')
      .set('Authorization', `Bearer ${token}`)
      .send({
        employee_id: employeeId,
        log_type: 'check_in',
        method: 'manual',
        note: 'Manual entry by manager',
      });
    expect(log.status).toBe(201);
    expect(log.body.method).toBe('manual');
    const list = await request(app)
      .get(`/api/attendance?employee_id=${employeeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);
    expect(list.body[0].employee_name).toBe('Galih');
  });

  it('upserts geofence', async () => {
    const upsert = await request(app)
      .put('/api/attendance-geofence')
      .set('Authorization', `Bearer ${token}`)
      .send({
        outlet_id: 1,
        outlet_name: 'Pusat',
        latitude: -6.2,
        longitude: 106.8,
        radius_m: 150,
        strict_mode: 1,
      });
    expect(upsert.status).toBe(200);
    expect(upsert.body.radius_m).toBe(150);
    // Update again.
    const upd = await request(app)
      .put('/api/attendance-geofence')
      .set('Authorization', `Bearer ${token}`)
      .send({ outlet_id: 1, radius_m: 200 });
    expect(upd.status).toBe(200);
    expect(upd.body.radius_m).toBe(200);
  });
});

describe('P1-14 Shift + Schedule + Swap', () => {
  let shiftPagiId;
  let shiftSoreId;
  let empAId;
  let empBId;

  it('creates shifts', async () => {
    const pagi = await request(app)
      .post('/api/shift')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Pagi',
        start_time: '08:00',
        end_time: '16:00',
        break_minutes: 60,
      });
    expect(pagi.status).toBe(201);
    shiftPagiId = pagi.body.id;
    const sore = await request(app)
      .post('/api/shift')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Sore',
        start_time: '14:00',
        end_time: '22:00',
        break_minutes: 60,
      });
    shiftSoreId = sore.body.id;
    expect(shiftSoreId).toBeTruthy();
  });

  it('assigns and swaps schedules', async () => {
    const a = await request(app)
      .post('/api/employee')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hari', role: 'cashier' });
    empAId = a.body.id;
    const b = await request(app)
      .post('/api/employee')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Indra', role: 'cashier' });
    empBId = b.body.id;
    const date = '2025-05-10';

    const assign = await request(app)
      .post('/api/schedule/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({
        assignments: [
          { employee_id: empAId, shift_id: shiftPagiId, schedule_date: date },
          { employee_id: empBId, shift_id: shiftSoreId, schedule_date: date },
        ],
      });
    expect(assign.status).toBe(200);

    const list = await request(app)
      .get(`/api/schedule?from=${date}&to=${date}`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.length).toBe(2);
    const a1 = list.body.find((x) => x.employee_id === empAId);
    const b1 = list.body.find((x) => x.employee_id === empBId);
    expect(a1.shift_id).toBe(shiftPagiId);
    expect(b1.shift_id).toBe(shiftSoreId);

    // Buat swap request: hari A minta tukar dengan hari B.
    const swap = await request(app)
      .post('/api/schedule-swap')
      .set('Authorization', `Bearer ${token}`)
      .send({
        requester_id: empAId,
        requester_assignment_id: a1.id,
        partner_id: empBId,
        partner_assignment_id: b1.id,
        reason: 'Ada keperluan keluarga',
      });
    expect(swap.status).toBe(201);
    expect(swap.body.status).toBe('PENDING');

    const apv = await request(app)
      .post(`/api/schedule-swap/${swap.body.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ decision_note: 'OK' });
    expect(apv.status).toBe(200);
    expect(apv.body.status).toBe('APPROVED');

    // Setelah approve, shift_id antar dua assignment tertukar
    // (employee_id tetap supaya unique(employee_id, schedule_date) konsisten).
    const after = await request(app)
      .get(`/api/schedule?from=${date}&to=${date}`)
      .set('Authorization', `Bearer ${token}`);
    const a2 = after.body.find((x) => x.id === a1.id);
    const b2 = after.body.find((x) => x.id === b1.id);
    expect(a2.shift_id).toBe(shiftSoreId);
    expect(b2.shift_id).toBe(shiftPagiId);
    expect(a2.employee_id).toBe(empAId);
    expect(b2.employee_id).toBe(empBId);
  });

  it('rejects swap', async () => {
    const date = '2025-05-11';
    const assign = await request(app)
      .post('/api/schedule/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({
        assignments: [
          { employee_id: empAId, shift_id: shiftPagiId, schedule_date: date },
          { employee_id: empBId, shift_id: shiftSoreId, schedule_date: date },
        ],
      });
    expect(assign.status).toBe(200);
    const list = await request(app)
      .get(`/api/schedule?from=${date}&to=${date}`)
      .set('Authorization', `Bearer ${token}`);
    const a1 = list.body.find((x) => x.employee_id === empAId);
    const b1 = list.body.find((x) => x.employee_id === empBId);
    const swap = await request(app)
      .post('/api/schedule-swap')
      .set('Authorization', `Bearer ${token}`)
      .send({
        requester_id: empAId,
        requester_assignment_id: a1.id,
        partner_id: empBId,
        partner_assignment_id: b1.id,
      });
    const rej = await request(app)
      .post(`/api/schedule-swap/${swap.body.id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ decision_note: 'Tidak tersedia' });
    expect(rej.status).toBe(200);
    expect(rej.body.status).toBe('REJECTED');
  });
});

describe('P1-14 Approval Chain', () => {
  it('CRUDs chain', async () => {
    const create = await request(app)
      .post('/api/approval-chain')
      .set('Authorization', `Bearer ${token}`)
      .send({
        domain: 'purchase',
        name: 'PO > 5jt',
        threshold_amount: 5_000_000,
        steps: [
          { order: 1, approver_role: 'manager', label: 'Manager' },
          { order: 2, approver_role: 'admin', label: 'Owner' },
        ],
      });
    expect(create.status).toBe(201);
    expect(create.body.steps.length).toBe(2);

    const upd = await request(app)
      .put(`/api/approval-chain/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ threshold_amount: 10_000_000 });
    expect(upd.body.threshold_amount).toBe(10_000_000);

    const list = await request(app)
      .get('/api/approval-chain?domain=purchase')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.length).toBe(1);
  });
});
