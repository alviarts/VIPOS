// Integration tests for readiness probe endpoint.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let adminToken;

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  adminToken = res.body.token;
});

afterAll(async () => {
  await teardownTestEnv();
});

describe('GET /api/v1/health/ready', () => {
  it('200 when all checks pass', async () => {
    const res = await request(app)
      .get('/api/v1/health/ready')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.database.status).toBe('ok');
    expect(res.body.checks.database_read.status).toBe('ok');
    expect(res.body.checks.disk_write.status).toBe('ok');
    expect(res.body.checks.memory.status).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.uptime_seconds).toBeDefined();
  });

  it('includes latency_ms for database check', async () => {
    const res = await request(app)
      .get('/api/v1/health/ready')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(typeof res.body.checks.database.latency_ms).toBe('number');
    expect(res.body.checks.database.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it('includes tenant_count in database_read', async () => {
    const res = await request(app)
      .get('/api/v1/health/ready')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(typeof res.body.checks.database_read.tenant_count).toBe('number');
  });

  it('includes memory stats', async () => {
    const res = await request(app)
      .get('/api/v1/health/ready')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.checks.memory.heap_used_mb).toBeGreaterThan(0);
    expect(res.body.checks.memory.rss_mb).toBeGreaterThan(0);
  });
});
