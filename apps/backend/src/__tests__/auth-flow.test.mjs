// VIPOS — P1-02 auth flow tests (refresh, forgot/reset, change password,
// 2FA setup + verify + disable).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { authenticator } from 'otplib';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;

beforeAll(() => {
  setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
});

afterAll(() => {
  teardownTestEnv();
});

async function login(username = 'admin', password = 'admin123') {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password });
  return res;
}

describe('POST /api/auth/login (P1-02)', () => {
  it('returns access + refresh + expires_in on success', async () => {
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.refresh_token).toBeTypeOf('string');
    expect(res.body.expires_in).toBe(15 * 60);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates the refresh token and revokes the old one', async () => {
    const loginRes = await login();
    const oldRefresh = loginRes.body.refresh_token;

    const refreshed = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: oldRefresh });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.token).toBeTypeOf('string');
    expect(refreshed.body.refresh_token).toBeTypeOf('string');
    expect(refreshed.body.refresh_token).not.toBe(oldRefresh);

    // Old refresh token must now be rejected.
    const replay = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: oldRefresh });
    expect(replay.status).toBe(401);
  });

  it('rejects invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: 'not-a-real-token' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the refresh token', async () => {
    const loginRes = await login();
    const refresh = loginRes.body.refresh_token;
    const out = await request(app)
      .post('/api/auth/logout')
      .send({ refresh_token: refresh });
    expect(out.status).toBe(204);
    const after = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: refresh });
    expect(after.status).toBe(401);
  });
});

describe('POST /api/auth/forgot-password + reset-password', () => {
  it('issues a dev_reset_link in non-prod and resets password', async () => {
    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email_or_username: 'admin' });
    expect(forgot.status).toBe(202);
    expect(forgot.body.dev_reset_link).toMatch(/token=/);

    const tokenMatch = forgot.body.dev_reset_link.match(/token=([^&]+)/);
    expect(tokenMatch).toBeTruthy();
    const token = decodeURIComponent(tokenMatch[1]);

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, new_password: 'admin124' });
    expect(reset.status).toBe(200);

    // Old password rejected, new accepted.
    const oldLogin = await login('admin', 'admin123');
    expect(oldLogin.status).toBe(401);
    const newLogin = await login('admin', 'admin124');
    expect(newLogin.status).toBe(200);

    // Cannot reuse the same reset token.
    const replay = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, new_password: 'admin125' });
    expect(replay.status).toBe(400);

    // Reset back so other tests stay valid.
    const f2 = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email_or_username: 'admin' });
    const t2 = decodeURIComponent(f2.body.dev_reset_link.match(/token=([^&]+)/)[1]);
    await request(app)
      .post('/api/auth/reset-password')
      .send({ token: t2, new_password: 'admin123' });
  });

  it('always returns 202 even for unknown user (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email_or_username: 'does-not-exist' });
    expect(res.status).toBe(202);
    expect(res.body.dev_reset_link).toBeUndefined();
  });
});

describe('POST /api/auth/change-password', () => {
  it('rejects wrong current password', async () => {
    const loginRes = await login();
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({ current_password: 'wrong', new_password: 'admin999' });
    expect(res.status).toBe(401);
  });

  it('updates password when current is correct', async () => {
    const loginRes = await login();
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({ current_password: 'admin123', new_password: 'admin999' });
    expect(res.status).toBe(200);

    const after = await login('admin', 'admin999');
    expect(after.status).toBe(200);

    // Restore.
    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${after.body.token}`)
      .send({ current_password: 'admin999', new_password: 'admin123' });
  });
});

describe('2FA flow', () => {
  let token;
  beforeEach(async () => {
    const loginRes = await login();
    token = loginRes.body.token;
  });

  it('setup → verify enables totp_enabled + login becomes 2-step', async () => {
    const setup = await request(app)
      .post('/api/auth/2fa/setup')
      .set('Authorization', `Bearer ${token}`);
    expect(setup.status).toBe(200);
    expect(setup.body.secret).toBeTypeOf('string');
    expect(setup.body.otpauth_url).toMatch(/^otpauth:\/\/totp\//);

    const code = authenticator.generate(setup.body.secret);
    const verify = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code });
    expect(verify.status).toBe(200);

    // Now /login should require 2FA step.
    const lg = await login();
    expect(lg.body.requires_2fa).toBe(true);
    expect(lg.body.login_token).toBeTypeOf('string');
    expect(lg.body.token).toBeUndefined();

    const code2 = authenticator.generate(setup.body.secret);
    const verifyLogin = await request(app)
      .post('/api/auth/login/2fa')
      .send({ login_token: lg.body.login_token, code: code2 });
    expect(verifyLogin.status).toBe(200);
    expect(verifyLogin.body.token).toBeTypeOf('string');
    expect(verifyLogin.body.refresh_token).toBeTypeOf('string');

    // Disable to keep other tests simple.
    const disable = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${verifyLogin.body.token}`)
      .send({ password: 'admin123' });
    expect(disable.status).toBe(200);
  });

  it('rejects /login/2fa with wrong code', async () => {
    const setup = await request(app)
      .post('/api/auth/2fa/setup')
      .set('Authorization', `Bearer ${token}`);
    const code = authenticator.generate(setup.body.secret);
    await request(app)
      .post('/api/auth/2fa/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code });

    const lg = await login();
    const wrong = await request(app)
      .post('/api/auth/login/2fa')
      .send({ login_token: lg.body.login_token, code: '000000' });
    expect(wrong.status).toBe(401);

    // Cleanup.
    const recovered = authenticator.generate(setup.body.secret);
    const ok = await request(app)
      .post('/api/auth/login/2fa')
      .send({ login_token: lg.body.login_token, code: recovered });
    await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${ok.body.token}`)
      .send({ password: 'admin123' });
  });
});
