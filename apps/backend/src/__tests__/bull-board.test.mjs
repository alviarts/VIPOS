// P2-04 PR-B Bull Board mount tests.
//
// Covers:
//   - 401 unauthenticated request blocked at `authenticateToken`.
//   - 403 cashier role blocked at `requireAdmin`.
//   - 200 admin (or super_admin) gets the Bull Board UI.
//   - When REDIS_URL is unset the route still authenticates but returns
//     503 ("Bull Board disabled") to stay 404-free.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

const REDIS_URL = process.env.REDIS_URL;

let app;
let queryFn;
let runAsSystem;

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  ({ query: queryFn, runAsSystem } = require('../db'));
});

afterAll(async () => {
  if (REDIS_URL) {
    const queueLib = require('../lib/queue');
    await queueLib.closeConnection();
  }
  await teardownTestEnv();
});

async function registerTenant(slug, tier = 'advance') {
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

describe('Bull Board /api/admin/queues', () => {
  it('401 — unauthenticated request blocked', async () => {
    const res = await request(app).get('/api/admin/queues');
    expect(res.status).toBe(401);
  });

  it('403 — cashier role blocked by requireAdmin', async () => {
    const t = await registerTenant('bb-cashier', 'advance');
    await runAsSystem(() => queryFn(`UPDATE users SET role = 'cashier' WHERE id = $1`, [t.userId]));
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bb-cashier_admin', password: 'rahasia123' });
    expect(login.status).toBe(200);
    const res = await request(app)
      .get('/api/admin/queues')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(403);
  });

  it(
    REDIS_URL ? '200 — admin gets Bull Board UI' : '503 — Bull Board disabled when REDIS_URL unset',
    async () => {
      const t = await registerTenant('bb-admin', 'advance');
      const res = await request(app)
        .get('/api/admin/queues')
        .set('Authorization', `Bearer ${t.token}`);
      if (REDIS_URL) {
        // Bull Board returns either the UI HTML (with 200) or a redirect
        // (302/301) to the trailing-slash variant — both are valid here.
        expect([200, 301, 302]).toContain(res.status);
      } else {
        expect(res.status).toBe(503);
        expect(res.body.error).toMatch(/Bull Board disabled/i);
      }
    }
  );

  it('Bull Board route is *not* exposed under the legacy /api alias', async () => {
    // The legacy alias only mounts the versioned routes — admin surface
    // (tenant, queues) must remain on /api/admin/* directly. Hitting
    // /api/queues should 404 because there is no such mount.
    const res = await request(app).get('/api/queues');
    // Either 404 (preferred) or 401 (if some auth middleware catches
    // first). Anything other than a real Bull Board response is fine —
    // we just want to assert the mount isn't accidentally dual.
    expect([401, 404]).toContain(res.status);
  });
});
