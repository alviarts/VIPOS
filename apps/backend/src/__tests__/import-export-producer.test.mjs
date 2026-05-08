// P2-04 PR-C import-export async producer tests.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

const REDIS_URL = process.env.REDIS_URL;

let app;
let queryFn;
let runAsSystem;
let runWithTenant;
let processImportExport;

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  ({ query: queryFn, runAsSystem, runWithTenant } = require('../db'));
  ({ processImportExport } = require('../jobs/import-export'));
});

afterAll(async () => {
  if (REDIS_URL) {
    const queueLib = require('../lib/queue');
    await queueLib.closeConnection();
  }
  await teardownTestEnv();
});

async function registerTenant(slug) {
  const r = await request(app)
    .post('/api/v1/tenant/register')
    .send({
      tenant_slug: slug,
      tenant_name: slug,
      tier: 'advance',
      admin_username: `${slug}_admin`,
      admin_password: 'rahasia123',
      admin_name: `${slug} Admin`,
    });
  expect(r.status).toBe(201);
  return { tenantId: r.body.tenant.id, userId: r.body.user.id, token: r.body.token };
}

describe('POST /api/v1/import-export/import/:entity/async', () => {
  // Guard against stale data from async processor race conditions
  // across test files (singleFork mode). The processor from a
  // previous file's job may fire after this file's TRUNCATE.
  beforeEach(async () => {
    try {
      await runAsSystem(() =>
        queryFn(`DELETE FROM customers WHERE phone LIKE '+62811%'`)
      );
    } catch (_) { /* ignore if table doesn't exist yet */ }
  });

  it('401 — unauthenticated request blocked', async () => {
    const res = await request(app)
      .post('/api/v1/import-export/import/customers/async')
      .send({ rows: [] });
    expect(res.status).toBe(401);
  });

  it('403 — cashier role blocked', async () => {
    const t = await registerTenant('import-cashier');
    await runAsSystem(() => queryFn(`UPDATE users SET role = 'cashier' WHERE id = $1`, [t.userId]));
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'import-cashier_admin', password: 'rahasia123' });
    expect(login.status).toBe(200);
    const res = await request(app)
      .post('/api/v1/import-export/import/customers/async')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ rows: [{ name: 'X' }] });
    expect(res.status).toBe(403);
  });

  it('400 — unknown entity', async () => {
    const t = await registerTenant('import-badentity');
    const res = await request(app)
      .post('/api/v1/import-export/import/widgets/async')
      .set('Authorization', `Bearer ${t.token}`)
      .send({ rows: [{ a: 1 }] });
    expect(res.status).toBe(400);
  });

  it('202 — empty rows is a no-op', async () => {
    const t = await registerTenant('import-empty');
    const res = await request(app)
      .post('/api/v1/import-export/import/customers/async')
      .set('Authorization', `Bearer ${t.token}`)
      .send({ rows: [] });
    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ total: 0 });
  });

  it(
    REDIS_URL
      ? '202 — enqueues + processor inserts rows + writes audit row'
      : '202 — sync fallback when REDIS_URL unset',
    async () => {
      const t = await registerTenant('import-happy');
      const customers = [
        { name: 'Alpha Corp', phone: '+62811000001' },
        { name: 'Bravo Co', phone: '+62811000002' },
        { name: 'Charlie Ltd', phone: '+62811000003' },
      ];
      const res = await request(app)
        .post('/api/v1/import-export/import/customers/async')
        .set('Authorization', `Bearer ${t.token}`)
        .send({ rows: customers });
      expect(res.status).toBe(202);

      if (!REDIS_URL) {
        expect(res.body).toMatchObject({ enqueued: false, sync: true, total: 3 });
        return;
      }
      expect(res.body).toMatchObject({
        enqueued: true,
        queue: 'import-export',
        total: 3,
      });

      const queueLib = require('../lib/queue');
      const queue = queueLib.getOrCreateQueue(queueLib.QUEUE_NAMES.IMPORT_EXPORT);
      const job = await queue.getJob(res.body.job_id);
      expect(job).toBeTruthy();
      // Clean any stale rows before processing to avoid count mismatch.
      await runAsSystem(() =>
        queryFn(`DELETE FROM customers WHERE tenant_id = $1`, [t.tenantId])
      );
      const result = await processImportExport(job);
      expect(result).toMatchObject({
        ok: true,
        entity: 'customers',
        total: 3,
        inserted: 3,
      });
      expect(result.errors).toEqual([]);
      expect(result.audit_id).toBeTruthy();

      // Rows landed on the customers table — scoped to tenant via RLS.
      // Use tenant-scoped query to only count THIS test's rows.
      const inserted = await runWithTenant(t.tenantId, () =>
        queryFn(`SELECT name, phone FROM customers WHERE phone LIKE '+62811000%' AND tenant_id = $1 ORDER BY phone`, [t.tenantId])
      );
      expect(inserted.rows).toHaveLength(3);
      expect(inserted.rows.map((r) => r.name).sort()).toEqual([
        'Alpha Corp',
        'Bravo Co',
        'Charlie Ltd',
      ]);

      const audit = await runAsSystem(() =>
        queryFn(
          `SELECT entity, action, entity_id, after_json FROM audit_logs
           WHERE id = $1 AND tenant_id = $2`,
          [result.audit_id, t.tenantId]
        )
      );
      expect(audit.rows[0]).toMatchObject({
        entity: 'import-export',
        action: 'import',
        entity_id: 'customers',
      });
      expect(audit.rows[0].after_json).toMatchObject({
        entity: 'customers',
        total: 3,
        inserted: 3,
      });
    }
  );
});

describe('processImportExport (unit)', () => {
  it('rejects missing tenant_id', async () => {
    await expect(processImportExport({ data: { entity: 'customers', rows: [] } })).rejects.toThrow(
      /tenant_id/
    );
  });
  it('rejects unsupported entity', async () => {
    await expect(
      processImportExport({ data: { tenant_id: 1, entity: 'widgets', rows: [] } })
    ).rejects.toThrow(/entity/);
  });
  it('rejects non-array rows', async () => {
    await expect(
      processImportExport({ data: { tenant_id: 1, entity: 'customers', rows: 'oops' } })
    ).rejects.toThrow(/array/);
  });
});
