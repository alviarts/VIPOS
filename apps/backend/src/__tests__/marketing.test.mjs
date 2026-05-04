import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let adminToken;
let groupVipId;
let tagBirthdayId;
let customerVipId;
let customerTaggedId;
let customerNoPhoneId;

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

  const grpRes = await request(app)
    .post('/api/customer-groups')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'VIP', discount_percent: 10 });
  groupVipId = grpRes.body.id;

  const tagRes = await request(app)
    .post('/api/customer-tags')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Birthday' });
  tagBirthdayId = tagRes.body.id;

  const c1 = await request(app)
    .post('/api/customers')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Andi VIP',
      phone: '08111111111',
      email: 'andi@example.com',
      customer_group_id: groupVipId,
    });
  customerVipId = c1.body.id;

  const c2 = await request(app)
    .post('/api/customers')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Budi Tag', phone: '08222222222' });
  customerTaggedId = c2.body.id;

  await request(app)
    .put(`/api/customers/${customerTaggedId}/tags`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tag_ids: [tagBirthdayId] });

  const c3 = await request(app)
    .post('/api/customers')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Tanpa Phone' });
  customerNoPhoneId = c3.body.id;
  expect(customerNoPhoneId).toBeGreaterThan(0);
});

afterAll(async () => {
  await teardownTestEnv();
});

beforeEach(async () => {
  // Top up generous balance for each test (keeps order independence).
  for (const channel of ['whatsapp', 'sms', 'email']) {
    await request(app)
      .post('/api/marketing/credit/topup')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ channel, amount: 10_000_000, notes: 'test top up' });
  }
});

describe('Marketing templates', () => {
  it('201 create + 200 list + 200 update + 200 delete', async () => {
    const created = await request(app)
      .post('/api/marketing/template')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Promo VIP',
        channel: 'whatsapp',
        body: 'Halo {{name}}, ada promo di {{outlet}}!',
        buttons: [{ type: 'url', label: 'Lihat', value: 'https://vipos.id' }],
      });
    expect(created.status).toBe(201);
    expect(created.body.body).toContain('{{name}}');
    expect(created.body.buttons[0].label).toBe('Lihat');

    const list = await request(app)
      .get('/api/marketing/template?channel=whatsapp')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(1);

    const upd = await request(app)
      .put(`/api/marketing/template/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ body: 'Hai {{nama}}, special VIP!' });
    expect(upd.status).toBe(200);
    expect(upd.body.body).toContain('{{nama}}');

    const del = await request(app)
      .delete(`/api/marketing/template/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);
  });

  it('400 validation when body is empty', async () => {
    const res = await request(app)
      .post('/api/marketing/template')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad', channel: 'sms', body: '' });
    expect(res.status).toBe(400);
  });
});

describe('Marketing campaigns — audience resolver', () => {
  it('201 audience_type=group resolves only members of that group', async () => {
    const res = await request(app)
      .post('/api/marketing/campaign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Promo VIP via WA',
        channel: 'whatsapp',
        audience_type: 'group',
        audience_group_ids: [groupVipId],
        template_snapshot: {
          body: 'Hi {{name}}, promo VIP di {{outlet}}.',
          buttons: [],
        },
        schedule_type: 'now',
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft');
    expect(res.body.audience_type).toBe('group');

    const recipients = await request(app)
      .get(`/api/marketing/campaign/${res.body.id}/recipients`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(recipients.status).toBe(200);
    expect(recipients.body.total).toBe(1);
    expect(recipients.body.items[0].customer_id).toBe(customerVipId);
    expect(recipients.body.items[0].rendered_message).toContain('Hi Andi VIP');
  });

  it('201 audience_type=tag resolves only customers with tag', async () => {
    const res = await request(app)
      .post('/api/marketing/campaign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Birthday SMS',
        channel: 'sms',
        audience_type: 'tag',
        audience_tag_ids: [tagBirthdayId],
        template_snapshot: { body: 'Selamat ulang tahun {{name}}', buttons: [] },
      });
    expect(res.status).toBe(201);
    const recipients = await request(app)
      .get(`/api/marketing/campaign/${res.body.id}/recipients`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(recipients.body.total).toBe(1);
    expect(recipients.body.items[0].customer_id).toBe(customerTaggedId);
  });

  it('201 audience_type=all skips customers without phone (channel=whatsapp)', async () => {
    const res = await request(app)
      .post('/api/marketing/campaign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Blast All WA',
        channel: 'whatsapp',
        audience_type: 'all',
        template_snapshot: { body: 'Hi {{name}}', buttons: [] },
      });
    expect(res.status).toBe(201);
    const recipients = await request(app)
      .get(`/api/marketing/campaign/${res.body.id}/recipients`)
      .set('Authorization', `Bearer ${adminToken}`);
    // Andi VIP + Budi Tag (both have phones); Tanpa Phone is skipped.
    expect(recipients.body.total).toBe(2);
  });

  it('201 audience_type=all uses email contact when channel=email', async () => {
    const res = await request(app)
      .post('/api/marketing/campaign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Email Blast',
        channel: 'email',
        audience_type: 'all',
        template_snapshot: { subject: 'Hai', body: 'Email body', buttons: [] },
      });
    expect(res.status).toBe(201);
    const recipients = await request(app)
      .get(`/api/marketing/campaign/${res.body.id}/recipients`)
      .set('Authorization', `Bearer ${adminToken}`);
    // Only Andi VIP has email.
    expect(recipients.body.total).toBe(1);
    expect(recipients.body.items[0].contact).toBe('andi@example.com');
  });

  it('201 audience_type=custom uses provided list', async () => {
    const res = await request(app)
      .post('/api/marketing/campaign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Custom Blast',
        channel: 'whatsapp',
        audience_type: 'custom',
        audience_custom_recipients: [
          { contact: '08311111111', label: 'Tester 1' },
          { contact: '08311111112', label: 'Tester 2' },
        ],
        template_snapshot: { body: 'Halo {{name}}', buttons: [] },
      });
    expect(res.status).toBe(201);
    const recipients = await request(app)
      .get(`/api/marketing/campaign/${res.body.id}/recipients`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(recipients.body.total).toBe(2);
    expect(recipients.body.items[0].rendered_message).toContain('Halo Tester 1');
  });

  it('400 audience_type=custom without recipients', async () => {
    const res = await request(app)
      .post('/api/marketing/campaign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Empty',
        channel: 'whatsapp',
        audience_type: 'custom',
        template_snapshot: { body: 'Halo', buttons: [] },
      });
    expect(res.status).toBe(400);
  });

  it('400 audience_type=group with empty group_ids returns audience kosong', async () => {
    const res = await request(app)
      .post('/api/marketing/campaign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Empty group',
        channel: 'whatsapp',
        audience_type: 'group',
        audience_group_ids: [],
        template_snapshot: { body: 'Halo', buttons: [] },
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Audience kosong');
  });

  it('400 schedule_type=scheduled tanpa scheduled_at', async () => {
    const res = await request(app)
      .post('/api/marketing/campaign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Bad schedule',
        channel: 'whatsapp',
        audience_type: 'all',
        template_snapshot: { body: 'Hi', buttons: [] },
        schedule_type: 'scheduled',
      });
    expect(res.status).toBe(400);
  });
});

describe('Marketing campaigns — send + events + report', () => {
  let campaignId;

  it('201 create scheduled campaign + 200 update reschedule', async () => {
    const create = await request(app)
      .post('/api/marketing/campaign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Send test',
        channel: 'whatsapp',
        audience_type: 'group',
        audience_group_ids: [groupVipId],
        template_snapshot: { body: 'Hi {{name}}', buttons: [] },
        schedule_type: 'scheduled',
        scheduled_at: '2099-01-01T08:00:00Z',
      });
    expect(create.status).toBe(201);
    expect(create.body.status).toBe('scheduled');
    campaignId = create.body.id;

    const upd = await request(app)
      .put(`/api/marketing/campaign/${campaignId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scheduled_at: '2099-02-01T08:00:00Z', cost_per_message: 400 });
    expect(upd.status).toBe(200);
    expect(upd.body.cost_per_message).toBe(400);
    expect(upd.body.total_cost).toBe(400);
  });

  it('200 send mock campaign delivers immediately + deducts ledger', async () => {
    const balanceBefore = await request(app)
      .get('/api/marketing/credit/balance')
      .set('Authorization', `Bearer ${adminToken}`);
    const before = balanceBefore.body.whatsapp;

    const send = await request(app)
      .post(`/api/marketing/campaign/${campaignId}/send`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(send.status).toBe(200);
    expect(send.body.status).toBe('sent');
    expect(send.body.sent_count).toBe(1);
    expect(send.body.delivered_count).toBe(1);

    const balanceAfter = await request(app)
      .get('/api/marketing/credit/balance')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(balanceAfter.body.whatsapp).toBe(before - 400);
  });

  it('400 sending an already-sent campaign', async () => {
    const send = await request(app)
      .post(`/api/marketing/campaign/${campaignId}/send`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(send.status).toBe(400);
  });

  it('200 mark recipient opened + clicked event', async () => {
    const recipients = await request(app)
      .get(`/api/marketing/campaign/${campaignId}/recipients`)
      .set('Authorization', `Bearer ${adminToken}`);
    const rid = recipients.body.items[0].id;

    const opened = await request(app)
      .post(`/api/marketing/campaign/${campaignId}/recipient/${rid}/event`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ event: 'opened' });
    expect(opened.status).toBe(200);
    expect(opened.body.status).toBe('opened');

    const clicked = await request(app)
      .post(`/api/marketing/campaign/${campaignId}/recipient/${rid}/event`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ event: 'clicked' });
    expect(clicked.status).toBe(200);
    expect(clicked.body.status).toBe('clicked');

    const report = await request(app)
      .get(`/api/marketing/campaign/${campaignId}/report`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(report.status).toBe(200);
    expect(report.body.opened).toBe(1);
    expect(report.body.clicked).toBe(1);
    expect(report.body.delivery_rate).toBeGreaterThan(0);
  });

  it('400 send when balance < total_cost', async () => {
    // Brand new test DB has no balance left after we drained it. Create new
    // campaign + try to send without enough credit by topping a tiny
    // balance.
    const expensive = await request(app)
      .post('/api/marketing/campaign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Too expensive',
        channel: 'sms',
        audience_type: 'all',
        template_snapshot: { body: 'Halo', buttons: [] },
        cost_per_message: 999_999_999,
      });
    expect(expensive.status).toBe(201);

    const send = await request(app)
      .post(`/api/marketing/campaign/${expensive.body.id}/send`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(send.status).toBe(400);
    expect(send.body.error).toContain('Saldo');
  });
});

describe('Marketing — test send', () => {
  it('200 test send returns rendered preview without deducting', async () => {
    const create = await request(app)
      .post('/api/marketing/campaign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test send',
        channel: 'sms',
        audience_type: 'group',
        audience_group_ids: [groupVipId],
        template_snapshot: { body: 'Hi {{name}}, test {{outlet}}', buttons: [] },
      });
    expect(create.status).toBe(201);

    const balanceBefore = await request(app)
      .get('/api/marketing/credit/balance')
      .set('Authorization', `Bearer ${adminToken}`);

    const test = await request(app)
      .post(`/api/marketing/campaign/${create.body.id}/test-send`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ contact: '08123456789', contact_label: 'Tester X' });
    expect(test.status).toBe(200);
    expect(test.body.rendered_message).toContain('Hi Tester X');
    expect(test.body.provider).toBe('mock');

    const balanceAfter = await request(app)
      .get('/api/marketing/credit/balance')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(balanceAfter.body.sms).toBe(balanceBefore.body.sms);
  });
});

describe('Marketing — credit ledger', () => {
  it('200 topup increments balance + appears in ledger', async () => {
    const before = await request(app)
      .get('/api/marketing/credit/balance')
      .set('Authorization', `Bearer ${adminToken}`);

    const topup = await request(app)
      .post('/api/marketing/credit/topup')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ channel: 'whatsapp', amount: 25_000, notes: 'Manual topup' });
    expect(topup.status).toBe(200);
    expect(topup.body.balance).toBe(before.body.whatsapp + 25_000);

    const ledger = await request(app)
      .get('/api/marketing/credit/ledger?channel=whatsapp')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ledger.status).toBe(200);
    expect(ledger.body.items[0].type).toBe('topup');
    expect(ledger.body.items[0].notes).toBe('Manual topup');
  });
});
