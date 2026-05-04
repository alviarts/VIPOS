import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let adminToken;
let staffId;
let resourceId;
let customerId;

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

  const staff = await request(app)
    .post('/api/staff')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Therapist Aldi',
      phone: '081200001111',
      role: 'therapist',
      color: '#10B981',
    });
  staffId = staff.body.id;

  const res = await request(app)
    .post('/api/appointment-resource')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Treatment Room A', resource_type: 'room' });
  resourceId = res.body.id;

  const cust = await request(app)
    .post('/api/customers')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Pelanggan Test', phone: '081299998888' });
  customerId = cust.body.id;
});

afterAll(async () => {
  await teardownTestEnv();
});

describe('Staff CRUD', () => {
  it('lists staff', async () => {
    const res = await request(app).get('/api/staff').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.find((s) => s.id === staffId).name).toBe('Therapist Aldi');
  });

  it('updates staff', async () => {
    const res = await request(app)
      .put(`/api/staff/${staffId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'senior-therapist' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('senior-therapist');
  });
});

describe('Appointment resource CRUD', () => {
  it('lists resources', async () => {
    const res = await request(app)
      .get('/api/appointment-resource')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Appointment CRUD + state machine', () => {
  let appointmentId;

  it('creates appointment with services + computes totals', async () => {
    const res = await request(app)
      .post('/api/appointment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customer_id: customerId,
        customer_name: 'Pelanggan Test',
        customer_phone: '081299998888',
        staff_id: staffId,
        resource_id: resourceId,
        start_at: '2030-01-15T10:00:00Z',
        services: [
          { service_name: 'Hair Cut', qty: 1, price: 80000, duration_minutes: 30 },
          { service_name: 'Hair Wash', qty: 1, price: 30000, duration_minutes: 15 },
        ],
        deposit_amount: 50000,
      });
    expect(res.status).toBe(201);
    expect(res.body.ref_no).toMatch(/^APT/);
    expect(res.body.total).toBe(110000);
    expect(res.body.duration_minutes).toBe(45);
    expect(res.body.services.length).toBe(2);
    expect(res.body.staff_name).toBe('Therapist Aldi');
    expect(res.body.resource_name).toBe('Treatment Room A');
    expect(res.body.status).toBe('PENDING');
    appointmentId = res.body.id;
  });

  it('rejects double-booking on same staff overlap', async () => {
    const res = await request(app)
      .post('/api/appointment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customer_name: 'Bentrok Test',
        staff_id: staffId,
        start_at: '2030-01-15T10:15:00Z',
        services: [{ service_name: 'Massage', qty: 1, price: 100000, duration_minutes: 30 }],
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/staff/i);
  });

  it('lists appointments with date filter', async () => {
    const res = await request(app)
      .get('/api/appointment?from=2030-01-01&to=2030-01-31')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('transitions PENDING → CONFIRMED', async () => {
    const res = await request(app)
      .post(`/api/appointment/${appointmentId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONFIRMED');
  });

  it('transitions CONFIRMED → IN_PROGRESS via checkin', async () => {
    const res = await request(app)
      .post(`/api/appointment/${appointmentId}/checkin`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
    expect(res.body.checked_in_at).toBeTruthy();
  });

  it('transitions IN_PROGRESS → COMPLETED', async () => {
    const res = await request(app)
      .post(`/api/appointment/${appointmentId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.completed_at).toBeTruthy();
  });

  it('rejects invalid transition (COMPLETED → CANCELLED)', async () => {
    const res = await request(app)
      .post(`/api/appointment/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'too late' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid transition/i);
  });
});

describe('Reschedule + reminders + cancel + convert', () => {
  let appointmentId;

  it('seeds appointment for reschedule', async () => {
    const res = await request(app)
      .post('/api/appointment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customer_name: 'Reschedule Test',
        staff_id: staffId,
        start_at: '2030-02-01T10:00:00Z',
        services: [{ service_name: 'Manicure', qty: 1, price: 50000, duration_minutes: 30 }],
      });
    appointmentId = res.body.id;
  });

  it('reschedules to a new time', async () => {
    const res = await request(app)
      .post(`/api/appointment/${appointmentId}/reschedule`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ start_at: '2030-02-01T15:00:00Z', duration_minutes: 30 });
    expect(res.status).toBe(200);
    expect(res.body.start_at).toMatch(/2030-02-01T15:00/);
  });

  it('rejects reschedule that conflicts with another appointment', async () => {
    const blocker = await request(app)
      .post('/api/appointment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customer_name: 'Blocker',
        staff_id: staffId,
        start_at: '2030-02-01T11:00:00Z',
        services: [{ service_name: 'Pedicure', qty: 1, price: 60000, duration_minutes: 30 }],
      });
    expect(blocker.status).toBe(201);

    const res = await request(app)
      .post(`/api/appointment/${appointmentId}/reschedule`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ start_at: '2030-02-01T11:15:00Z' });
    expect(res.status).toBe(409);
  });

  it('marks reminder 24h sent', async () => {
    const res = await request(app)
      .post(`/api/appointment/${appointmentId}/send-reminder`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ window: '24h' });
    expect(res.status).toBe(200);
    expect(res.body.reminder_24h_sent_at).toBeTruthy();
  });

  it('cancels with reason', async () => {
    const res = await request(app)
      .post(`/api/appointment/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'customer batal' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.cancel_reason).toBe('customer batal');
  });

  it('convert returns cart prefill from completed appointment', async () => {
    const create = await request(app)
      .post('/api/appointment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customer_id: customerId,
        customer_name: 'Convert Test',
        start_at: '2030-03-10T09:00:00Z',
        services: [{ service_name: 'Spa Massage', qty: 1, price: 250000, duration_minutes: 60 }],
      });
    const id = create.body.id;
    await request(app)
      .post(`/api/appointment/${id}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`);
    await request(app)
      .post(`/api/appointment/${id}/checkin`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .post(`/api/appointment/${id}/convert`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.cart_prefill).toBeTruthy();
    expect(res.body.cart_prefill.items.length).toBe(1);
    expect(res.body.cart_prefill.items[0].price).toBe(250000);
  });
});

describe('Calendar', () => {
  it('returns appointments + staff + resources for date range', async () => {
    const res = await request(app)
      .get('/api/calendar?from=2030-01-01&to=2030-12-31')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.appointments)).toBe(true);
    expect(res.body.appointments.length).toBeGreaterThanOrEqual(1);
    expect(res.body.staff.length).toBeGreaterThanOrEqual(1);
    expect(res.body.resources.length).toBeGreaterThanOrEqual(1);
    const sample = res.body.appointments[0];
    expect(sample).toHaveProperty('service_summary');
  });

  it('filters by staff_id', async () => {
    const res = await request(app)
      .get(`/api/calendar?from=2030-01-01&to=2030-12-31&staff_id=${staffId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const apt of res.body.appointments) {
      expect(apt.staff_id).toBe(staffId);
    }
  });
});
