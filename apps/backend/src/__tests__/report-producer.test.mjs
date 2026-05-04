// P2-04 PR-C report producer + chained-orchestration tests.
//
// Covers:
//   - Tier gating: lite tenants are 403'd at requireTier('prime')
//   - Sync fallback when REDIS_URL is unset
//   - Round-trip enqueue → process → audit row + downstream email job
//   - parseRecipients unit behaviour
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

const REDIS_URL = process.env.REDIS_URL;

let app;
let queryFn;
let runAsSystem;
let processReport;
let parseRecipients;
let processEmail;

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  ({ query: queryFn, runAsSystem } = require('../db'));
  ({ processReport, parseRecipients } = require('../jobs/report'));
  ({ processEmail } = require('../jobs/email'));
});

afterAll(async () => {
  if (REDIS_URL) {
    const queueLib = require('../lib/queue');
    await queueLib.closeConnection();
  }
  await teardownTestEnv();
});

async function registerTenant(slug, tier = 'prime') {
  const r = await request(app)
    .post('/api/v1/tenant/register')
    .send({
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

async function createSchedule(token, body = {}) {
  const r = await request(app)
    .post('/api/v1/reports/schedule')
    .set('Authorization', `Bearer ${token}`)
    .send({
      report_key: body.report_key || 'sales-summary',
      name: body.name || 'Daily sales summary',
      params_json: body.params_json || null,
      frequency: body.frequency || 'daily',
      recipients: body.recipients || 'ops@example.test',
      format: body.format || 'pdf',
      is_active: body.is_active ?? 1,
    });
  expect(r.status).toBe(201);
  return r.body;
}

describe('POST /api/v1/reports/schedule/:id/run', () => {
  it('401 — unauthenticated request blocked', async () => {
    const res = await request(app).post('/api/v1/reports/schedule/1/run').send({});
    expect(res.status).toBe(401);
  });

  it('403 — lite tier blocked at requireTier(prime)', async () => {
    const t = await registerTenant('report-lite', 'lite');
    // Need to create a schedule first; CRUD for schedules has no tier gate.
    const sched = await createSchedule(t.token);
    const res = await request(app)
      .post(`/api/v1/reports/schedule/${sched.id}/run`)
      .set('Authorization', `Bearer ${t.token}`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ required_tier: 'prime' });
  });

  it('404 — unknown schedule id', async () => {
    const t = await registerTenant('report-404', 'prime');
    const res = await request(app)
      .post('/api/v1/reports/schedule/99999/run')
      .set('Authorization', `Bearer ${t.token}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it(
    REDIS_URL
      ? '202 — enqueues, processor writes audit row + chains downstream email job'
      : '200 — sync fallback when REDIS_URL unset (last_run_at still updated)',
    async () => {
      const t = await registerTenant('report-happy', 'prime');
      const sched = await createSchedule(t.token, {
        report_key: 'sales-summary',
        name: 'Daily summary',
        recipients: 'ops@example.test, finance@example.test ; bad-email ;',
      });
      const res = await request(app)
        .post(`/api/v1/reports/schedule/${sched.id}/run`)
        .set('Authorization', `Bearer ${t.token}`)
        .send({});

      if (!REDIS_URL) {
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ enqueued: false, sync: true });
        expect(res.body.last_run_at).toBeTruthy();
        return;
      }

      expect(res.status).toBe(202);
      expect(res.body).toMatchObject({ enqueued: true, queue: 'report' });
      expect(res.body.job_id).toBeTruthy();

      const queueLib = require('../lib/queue');
      const reportQueue = queueLib.getOrCreateQueue(queueLib.QUEUE_NAMES.REPORT);
      const job = await reportQueue.getJob(res.body.job_id);
      expect(job).toBeTruthy();

      const result = await processReport(job);
      expect(result).toMatchObject({
        ok: true,
        schedule_id: sched.id,
        report_key: 'sales-summary',
        recipient_count: 2, // ops, finance — bad-email dropped, empty after ; dropped
      });
      expect(result.audit_id).toBeTruthy();
      expect(result.email_job_ids).toHaveLength(2);
      expect(result.dropped_recipients).toContain('bad-email');

      // Audit row written.
      const audit = await runAsSystem(() =>
        queryFn(
          `SELECT entity, action, entity_id, after_json FROM audit_logs
           WHERE id = $1 AND tenant_id = $2`,
          [result.audit_id, t.tenantId]
        )
      );
      expect(audit.rows[0]).toMatchObject({
        entity: 'report',
        action: 'generate',
        entity_id: String(sched.id),
      });
      expect(audit.rows[0].after_json).toMatchObject({
        schedule_id: sched.id,
        report_key: 'sales-summary',
        format: 'pdf',
      });

      // Each downstream email job is materialised in the email queue and
      // succeeds end-to-end via the email processor.
      const emailQueue = queueLib.getOrCreateQueue(queueLib.QUEUE_NAMES.EMAIL);
      for (const ejid of result.email_job_ids) {
        const ejob = await emailQueue.getJob(ejid);
        expect(ejob).toBeTruthy();
        expect(ejob.data).toMatchObject({
          tenant_id: t.tenantId,
          subject: expect.stringContaining('Daily summary'),
        });
        const eresult = await processEmail(ejob);
        expect(eresult).toMatchObject({ ok: true });
        expect(eresult.audit_id).toBeTruthy();
      }
    }
  );
});

describe('parseRecipients (unit)', () => {
  it('returns empty for null/undefined', () => {
    expect(parseRecipients(null)).toEqual({ valid: [], dropped: [] });
    expect(parseRecipients(undefined)).toEqual({ valid: [], dropped: [] });
    expect(parseRecipients('')).toEqual({ valid: [], dropped: [] });
  });

  it('splits on , and ;', () => {
    const r = parseRecipients('a@b.co, c@d.co; e@f.co');
    expect(r.valid).toEqual(['a@b.co', 'c@d.co', 'e@f.co']);
    expect(r.dropped).toEqual([]);
  });

  it('drops malformed entries', () => {
    const r = parseRecipients('ok@example.test, not-an-email, bare;');
    expect(r.valid).toEqual(['ok@example.test']);
    expect(r.dropped).toEqual(['not-an-email', 'bare']);
  });

  it('dedupes case-insensitively', () => {
    const r = parseRecipients('A@B.CO; a@b.co , a@b.co');
    expect(r.valid).toHaveLength(1);
    expect(r.valid[0].toLowerCase()).toBe('a@b.co');
  });
});

describe('processReport (unit)', () => {
  it('rejects missing tenant_id', async () => {
    await expect(processReport({ data: { schedule_id: 1, report_key: 'k' } })).rejects.toThrow(
      /tenant_id/
    );
  });

  it('rejects missing schedule_id', async () => {
    await expect(processReport({ data: { tenant_id: 1, report_key: 'k' } })).rejects.toThrow(
      /schedule_id/
    );
  });

  it('rejects unsupported format', async () => {
    await expect(
      processReport({ data: { tenant_id: 1, schedule_id: 1, report_key: 'k', format: 'docx' } })
    ).rejects.toThrow(/format/);
  });
});
