// VIPOS — Auth routes (P1-02 refinement, P2-01b cutover).
//
// Adds: refresh token rotation, forgot/reset/change password (mock email),
// TOTP-based 2FA setup + verify + disable, and login_token intermediate flow
// when 2FA is enabled.
//
// P2-01b cutover: handlers are async + use the `db/index` async query layer
// instead of better-sqlite3 directly. SQL written with $N placeholders;
// driver translates to ? for sqlite.
const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const { query, tx } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logAuditWithTenant, ACTIONS } = require('../lib/audit');
const {
  LoginRequestSchema,
  LoginVerify2FARequestSchema,
  RefreshRequestSchema,
  LogoutRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
  ChangePasswordRequestSchema,
  TwoFactorVerifyRequestSchema,
  TwoFactorDisableRequestSchema,
  RegisterRequestSchema,
} = require('@vipos/shared');
const {
  ACCESS_TOKEN_TTL_SECONDS,
  generateOpaqueToken,
  hashToken,
  signAccessToken,
  signLogin2faToken,
  verifyLogin2faToken,
  refreshExpiry,
  resetExpiry,
} = require('../utils/tokens');

const router = express.Router();

authenticator.options = { window: 1 }; // allow ±30 s clock skew

function userSummary(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  };
}

async function issueRefreshToken(userId, rememberMe) {
  const raw = generateOpaqueToken();
  const tokenHash = hashToken(raw);
  const expiresAt = refreshExpiry(rememberMe).toISOString();
  const r = await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3) RETURNING id`,
    [userId, tokenHash, expiresAt]
  );
  return { raw, expiresAt, id: r.rows[0].id };
}

async function buildLoginPayload(user, rememberMe, req) {
  const access = signAccessToken(user);
  const refresh = await issueRefreshToken(user.id, rememberMe);
  await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
  if (user.tenant_id != null) {
    await logAuditWithTenant({
      tenant_id: user.tenant_id,
      user_id: user.id,
      ip: req?.ip,
      user_agent: req?.headers?.['user-agent'],
      entity: 'session',
      entity_id: user.id,
      action: ACTIONS.LOGIN,
    });
  }
  return {
    token: access,
    refresh_token: refresh.raw,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    user: userSummary(user),
  };
}

router.post('/login', validate({ body: LoginRequestSchema }), async (req, res) => {
  try {
    const { username, password, remember_me } = req.body;
    const r = await query('SELECT * FROM users WHERE username = $1', [username]);
    const user = r.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }
    if (user.totp_enabled) {
      return res.json({ requires_2fa: true, login_token: signLogin2faToken(user) });
    }
    res.json(await buildLoginPayload(user, !!remember_me, req));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login/2fa', validate({ body: LoginVerify2FARequestSchema }), async (req, res) => {
  try {
    const { login_token, code, remember_me } = req.body;
    let payload;
    try {
      payload = verifyLogin2faToken(login_token);
    } catch {
      return res.status(401).json({ error: 'Sesi 2FA expired, silakan login ulang' });
    }
    const r = await query('SELECT * FROM users WHERE id = $1', [payload.id]);
    const user = r.rows[0];
    if (!user || !user.totp_enabled || !user.totp_secret) {
      return res.status(401).json({ error: '2FA tidak aktif' });
    }
    if (!authenticator.check(code, user.totp_secret)) {
      return res.status(401).json({ error: 'Kode 2FA salah' });
    }
    res.json(await buildLoginPayload(user, !!remember_me, req));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/refresh', validate({ body: RefreshRequestSchema }), async (req, res) => {
  try {
    const { refresh_token } = req.body;
    const tokenHash = hashToken(refresh_token);
    const tokenRow = (
      await query('SELECT * FROM refresh_tokens WHERE token_hash = $1', [tokenHash])
    ).rows[0];
    if (!tokenRow) {
      return res.status(401).json({ error: 'Refresh token tidak valid' });
    }
    if (tokenRow.revoked) {
      return res.status(401).json({ error: 'Refresh token sudah di-revoke' });
    }
    if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    const user = (await query('SELECT * FROM users WHERE id = $1', [tokenRow.user_id])).rows[0];
    if (!user) {
      return res.status(401).json({ error: 'User tidak ditemukan' });
    }
    // Rotate: issue new refresh, revoke old + link via replaced_by.
    const newRefresh = await issueRefreshToken(user.id, false);
    await query('UPDATE refresh_tokens SET revoked = 1, replaced_by = $1 WHERE id = $2', [
      newRefresh.id,
      tokenRow.id,
    ]);
    res.json({
      token: signAccessToken(user),
      refresh_token: newRefresh.raw,
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      user: userSummary(user),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', validate({ body: LogoutRequestSchema }), async (req, res) => {
  try {
    const { refresh_token } = req.body;
    const tokenHash = hashToken(refresh_token);
    // Look up the user behind the refresh token before revoking so the audit
    // row can attribute the logout to the right user + tenant. If the token
    // is unknown we still 204 (idempotent); just skip the audit write.
    const tokenRow = (
      await query(
        `SELECT rt.user_id, u.tenant_id
           FROM refresh_tokens rt
           LEFT JOIN users u ON u.id = rt.user_id
          WHERE rt.token_hash = $1`,
        [tokenHash]
      )
    ).rows[0];
    await query('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = $1', [tokenHash]);
    if (tokenRow?.tenant_id != null) {
      await logAuditWithTenant({
        tenant_id: tokenRow.tenant_id,
        user_id: tokenRow.user_id,
        ip: req.ip,
        user_agent: req.headers?.['user-agent'],
        entity: 'session',
        entity_id: tokenRow.user_id,
        action: ACTIONS.LOGOUT,
      });
    }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/forgot-password',
  validate({ body: ForgotPasswordRequestSchema }),
  async (req, res) => {
    try {
      const { email_or_username } = req.body;
      const user = (
        await query('SELECT * FROM users WHERE username = $1 OR email = $2', [
          email_or_username,
          email_or_username,
        ])
      ).rows[0];
      // Always return 202 to prevent enumeration. Only do work if user exists.
      if (user) {
        const raw = generateOpaqueToken();
        await query(
          `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, $3)`,
          [user.id, hashToken(raw), resetExpiry().toISOString()]
        );
        const baseUrl = process.env.VIPOS_PUBLIC_URL || 'http://localhost:5173';
        const link = `${baseUrl}/reset-password?token=${encodeURIComponent(raw)}`;
        // Mock "email" — log to console. Future: SendGrid integration.
        console.log(`[mock email] reset link for user ${user.username}: ${link}`);
        if (process.env.NODE_ENV !== 'production') {
          return res.status(202).json({ ok: true, dev_reset_link: link });
        }
      }
      res.status(202).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.post('/reset-password', validate({ body: ResetPasswordRequestSchema }), async (req, res) => {
  try {
    const { token, new_password } = req.body;
    const tokenHash = hashToken(token);
    const row = (
      await query('SELECT * FROM password_reset_tokens WHERE token_hash = $1', [tokenHash])
    ).rows[0];
    if (!row || row.used) {
      return res.status(400).json({ error: 'Token tidak valid atau sudah dipakai' });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Token expired' });
    }
    const hashed = bcrypt.hashSync(new_password, 10);
    await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, row.user_id]);
    await query('UPDATE password_reset_tokens SET used = 1 WHERE id = $1', [row.id]);
    // Invalidate all refresh tokens for the user — force re-login everywhere.
    await query('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = $1', [row.user_id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/change-password',
  authenticateToken,
  validate({ body: ChangePasswordRequestSchema }),
  async (req, res) => {
    try {
      const { current_password, new_password } = req.body;
      const user = (await query('SELECT * FROM users WHERE id = $1', [req.user.id])).rows[0];
      if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
      if (!bcrypt.compareSync(current_password, user.password)) {
        return res.status(401).json({ error: 'Password lama salah' });
      }
      const hashed = bcrypt.hashSync(new_password, 10);
      await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, user.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.post('/2fa/setup', authenticateToken, async (req, res) => {
  try {
    const user = (await query('SELECT * FROM users WHERE id = $1', [req.user.id])).rows[0];
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
    const secret = authenticator.generateSecret();
    await query('UPDATE users SET totp_secret = $1, totp_enabled = 0 WHERE id = $2', [
      secret,
      user.id,
    ]);
    const otpauth = authenticator.keyuri(user.username, 'VIPOS', secret);
    res.json({ secret, otpauth_url: otpauth });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/2fa/verify',
  authenticateToken,
  validate({ body: TwoFactorVerifyRequestSchema }),
  async (req, res) => {
    try {
      const { code } = req.body;
      const user = (await query('SELECT * FROM users WHERE id = $1', [req.user.id])).rows[0];
      if (!user || !user.totp_secret) {
        return res.status(400).json({ error: 'Setup 2FA dulu sebelum verify' });
      }
      if (!authenticator.check(code, user.totp_secret)) {
        return res.status(401).json({ error: 'Kode 2FA salah' });
      }
      await query('UPDATE users SET totp_enabled = 1 WHERE id = $1', [user.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.post(
  '/2fa/disable',
  authenticateToken,
  validate({ body: TwoFactorDisableRequestSchema }),
  async (req, res) => {
    try {
      const { password } = req.body;
      const user = (await query('SELECT * FROM users WHERE id = $1', [req.user.id])).rows[0];
      if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
      if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Password salah' });
      }
      await query('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = $1', [user.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = (
      await query('SELECT id, username, name, role, email, totp_enabled FROM users WHERE id = $1', [
        req.user.id,
      ])
    ).rows[0];
    res.json({ user: user || req.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/register',
  authenticateToken,
  requireAdmin,
  validate({ body: RegisterRequestSchema }),
  async (req, res) => {
    try {
      const { username, password, name, role } = req.body;
      const existing = (await query('SELECT id FROM users WHERE username = $1', [username]))
        .rows[0];
      if (existing) {
        return res.status(400).json({ error: 'Username sudah digunakan' });
      }
      const tenantId = req.user.tenant_id;
      const hashedPassword = bcrypt.hashSync(password, 10);
      const result = await tx(async (txQuery) => {
        const insertedUser = await txQuery(
          `INSERT INTO users (username, password, name, role, tenant_id)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [username, hashedPassword, name, role, tenantId]
        );
        const userId = insertedUser.rows[0].id;
        await txQuery(
          `INSERT INTO tenant_users (tenant_id, user_id, role, is_default)
           VALUES ($1, $2, $3, TRUE)
           ON CONFLICT (tenant_id, user_id) DO NOTHING`,
          [tenantId, userId, role]
        );
        return { id: userId };
      });
      res.status(201).json({
        message: 'User berhasil dibuat',
        user: { id: result.id, username, name, role, tenant_id: tenantId },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = (
      await query(
        `SELECT id, username, name, role, email, totp_enabled, last_login_at, created_at, tenant_id
         FROM users WHERE tenant_id = $1`,
        [req.user.tenant_id]
      )
    ).rows;
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
