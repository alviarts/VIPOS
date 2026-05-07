// VIPOS — backend unit suite for `GET /api/v1/version`.
//
// Codifies the deploy provenance contract that
// `tools/scripts/deploy.sh` (build-stamp injection) and
// `.github/workflows/deploy-vps.yml` (smoke gate) both rely on. If
// either side regresses — e.g. deploy.sh stops exporting
// VIPOS_GIT_SHA, or the route stops echoing it — this suite fails
// before the change ever reaches production.
//
// Why no DB / no auth setup: the route is intentionally public and
// pure (reads two env vars, returns JSON). We avoid touching
// `setupTestEnv` so this suite stays runnable in environments that
// don't have a Postgres test instance.
//
// Risk: green.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

describe('GET /api/v1/version — deploy provenance probe', () => {
  let app;
  let savedEnv;

  beforeEach(() => {
    savedEnv = {
      VIPOS_GIT_SHA: process.env.VIPOS_GIT_SHA,
      VIPOS_BUILT_AT: process.env.VIPOS_BUILT_AT,
      NODE_ENV: process.env.NODE_ENV,
    };
    // Force a fresh require so the route picks up env mutations made
    // inside individual tests.
    delete require.cache[require.resolve('../app.js')];
    delete require.cache[require.resolve('../routes/version.js')];
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    delete require.cache[require.resolve('../app.js')];
    delete require.cache[require.resolve('../routes/version.js')];
  });

  function loadApp() {
    const { buildApp } = require('../app.js');
    return buildApp({ morganEnabled: false });
  }

  it('returns the configured sha + builtAt + env when both env vars are set', async () => {
    process.env.NODE_ENV = 'test';
    process.env.VIPOS_GIT_SHA = '7ff697600000000000000000000000000000beef';
    process.env.VIPOS_BUILT_AT = '2026-05-07T19:08:00Z';
    app = loadApp();

    const res = await request(app).get('/api/v1/version');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sha: '7ff697600000000000000000000000000000beef',
      builtAt: '2026-05-07T19:08:00Z',
      env: 'test',
    });
  });

  it('falls back to "unknown" / null when env vars are unset (local dev)', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.VIPOS_GIT_SHA;
    delete process.env.VIPOS_BUILT_AT;
    app = loadApp();

    const res = await request(app).get('/api/v1/version');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sha: 'unknown', builtAt: null, env: 'test' });
  });

  it('does not require authentication (smoke step has no Bearer token)', async () => {
    process.env.NODE_ENV = 'test';
    process.env.VIPOS_GIT_SHA = 'deadbeef';
    app = loadApp();

    // Note: NO Authorization header.
    const res = await request(app).get('/api/v1/version');
    expect(res.status).toBe(200);
    expect(res.body.sha).toBe('deadbeef');
  });

  it('is mounted on the legacy /api alias as well (/api/version)', async () => {
    process.env.NODE_ENV = 'test';
    process.env.VIPOS_GIT_SHA = 'cafebabe';
    app = loadApp();

    const res = await request(app).get('/api/version');
    expect(res.status).toBe(200);
    expect(res.body.sha).toBe('cafebabe');
    // Legacy alias attaches Deprecation/Sunset headers.
    expect(res.headers.deprecation).toBe('true');
  });
});
