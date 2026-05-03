// VIPOS — Auth routes (P1-02 refinement).
//
// Adds: refresh token rotation, forgot/reset/change password (mock email),
// TOTP-based 2FA setup + verify + disable, and login_token intermediate flow
// when 2FA is enabled.
const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const { getDb } = require('../models/database');
const {
  authenticateToken,
  requireAdmin,
} = require('../middleware/auth');
const { validate } = require('../middleware/validate');
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

function issueRefreshToken(db, userId, rememberMe) {
  const raw = generateOpaqueToken();
  const tokenHash = hashToken(raw);
  const expiresAt = refreshExpiry(rememberMe).toISOString();
  db.prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
  ).run(userId, tokenHash, expiresAt);
  return { raw, expiresAt };
}

function buildLoginPayload(db, user, rememberMe) {
  const access = signAccessToken(user);
  const refresh = issueRefreshToken(db, user.id, rememberMe);
  db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  return {
    token: access,
    refresh_token: refresh.raw,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    user: userSummary(user),
  };
}

router.post('/login', validate({ body: LoginRequestSchema }), (req, res) => {
  try {
    const { username, password, remember_me } = req.body;
    const db = getDb();
    const user = db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username);
    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }
    if (user.totp_enabled) {
      return res.json({ requires_2fa: true, login_token: signLogin2faToken(user) });
    }
    res.json(buildLoginPayload(db, user, !!remember_me));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/login/2fa',
  validate({ body: LoginVerify2FARequestSchema }),
  (req, res) => {
    try {
      const { login_token, code, remember_me } = req.body;
      let payload;
      try {
        payload = verifyLogin2faToken(login_token);
      } catch {
        return res.status(401).json({ error: 'Sesi 2FA expired, silakan login ulang' });
      }
      const db = getDb();
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
      if (!user || !user.totp_enabled || !user.totp_secret) {
        return res.status(401).json({ error: '2FA tidak aktif' });
      }
      if (!authenticator.check(code, user.totp_secret)) {
        return res.status(401).json({ error: 'Kode 2FA salah' });
      }
      res.json(buildLoginPayload(db, user, !!remember_me));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.post(
  '/refresh',
  validate({ body: RefreshRequestSchema }),
  (req, res) => {
    try {
      const { refresh_token } = req.body;
      const tokenHash = hashToken(refresh_token);
      const db = getDb();
      const row = db
        .prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?')
        .get(tokenHash);
      if (!row) {
        return res.status(401).json({ error: 'Refresh token tidak valid' });
      }
      if (row.revoked) {
        return res.status(401).json({ error: 'Refresh token sudah di-revoke' });
      }
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return res.status(401).json({ error: 'Refresh token expired' });
      }
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
      if (!user) {
        return res.status(401).json({ error: 'User tidak ditemukan' });
      }
      // Rotate: revoke old, issue new.
      const newRefresh = issueRefreshToken(db, user.id, false);
      const newRow = db
        .prepare('SELECT id FROM refresh_tokens WHERE token_hash = ?')
        .get(hashToken(newRefresh.raw));
      db.prepare(
        'UPDATE refresh_tokens SET revoked = 1, replaced_by = ? WHERE id = ?',
      ).run(newRow.id, row.id);
      res.json({
        token: signAccessToken(user),
        refresh_token: newRefresh.raw,
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        user: userSummary(user),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.post(
  '/logout',
  validate({ body: LogoutRequestSchema }),
  (req, res) => {
    try {
      const { refresh_token } = req.body;
      const tokenHash = hashToken(refresh_token);
      const db = getDb();
      db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(tokenHash);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.post(
  '/forgot-password',
  validate({ body: ForgotPasswordRequestSchema }),
  (req, res) => {
    try {
      const { email_or_username } = req.body;
      const db = getDb();
      const user = db
        .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
        .get(email_or_username, email_or_username);
      // Always return 202 to prevent enumeration. Only do work if user exists.
      if (user) {
        const raw = generateOpaqueToken();
        db.prepare(
          'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        ).run(user.id, hashToken(raw), resetExpiry().toISOString());
        const baseUrl = process.env.VIPOS_PUBLIC_URL || 'http://localhost:5173';
        const link = `${baseUrl}/reset-password?token=${encodeURIComponent(raw)}`;
        // Mock "email" — log to console. Future: SendGrid integration.
        // eslint-disable-next-line no-console
        console.log(`[mock email] reset link for user ${user.username}: ${link}`);
        if (process.env.NODE_ENV !== 'production') {
          return res.status(202).json({ ok: true, dev_reset_link: link });
        }
      }
      res.status(202).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.post(
  '/reset-password',
  validate({ body: ResetPasswordRequestSchema }),
  (req, res) => {
    try {
      const { token, new_password } = req.body;
      const tokenHash = hashToken(token);
      const db = getDb();
      const row = db
        .prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ?')
        .get(tokenHash);
      if (!row || row.used) {
        return res.status(400).json({ error: 'Token tidak valid atau sudah dipakai' });
      }
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return res.status(400).json({ error: 'Token expired' });
      }
      const hashed = bcrypt.hashSync(new_password, 10);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, row.user_id);
      db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(row.id);
      // Invalidate all refresh tokens for the user — force re-login everywhere.
      db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(row.user_id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.post(
  '/change-password',
  authenticateToken,
  validate({ body: ChangePasswordRequestSchema }),
  (req, res) => {
    try {
      const { current_password, new_password } = req.body;
      const db = getDb();
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
      if (!bcrypt.compareSync(current_password, user.password)) {
        return res.status(401).json({ error: 'Password lama salah' });
      }
      const hashed = bcrypt.hashSync(new_password, 10);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, user.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.post('/2fa/setup', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
    const secret = authenticator.generateSecret();
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?').run(
      secret,
      user.id,
    );
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
  (req, res) => {
    try {
      const { code } = req.body;
      const db = getDb();
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      if (!user || !user.totp_secret) {
        return res.status(400).json({ error: 'Setup 2FA dulu sebelum verify' });
      }
      if (!authenticator.check(code, user.totp_secret)) {
        return res.status(401).json({ error: 'Kode 2FA salah' });
      }
      db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(user.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.post(
  '/2fa/disable',
  authenticateToken,
  validate({ body: TwoFactorDisableRequestSchema }),
  (req, res) => {
    try {
      const { password } = req.body;
      const db = getDb();
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
      if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Password salah' });
      }
      db.prepare(
        'UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?',
      ).run(user.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.get('/me', authenticateToken, (req, res) => {
  const db = getDb();
  const user = db
    .prepare(
      'SELECT id, username, name, role, email, totp_enabled FROM users WHERE id = ?',
    )
    .get(req.user.id);
  res.json({ user: user || req.user });
});

router.post(
  '/register',
  authenticateToken,
  requireAdmin,
  validate({ body: RegisterRequestSchema }),
  (req, res) => {
    try {
      const { username, password, name, role } = req.body;
      const db = getDb();
      const existing = db
        .prepare('SELECT id FROM users WHERE username = ?')
        .get(username);
      if (existing) {
        return res.status(400).json({ error: 'Username sudah digunakan' });
      }
      const hashedPassword = bcrypt.hashSync(password, 10);
      const result = db
        .prepare(
          'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
        )
        .run(username, hashedPassword, name, role);
      res.status(201).json({
        message: 'User berhasil dibuat',
        user: { id: result.lastInsertRowid, username, name, role },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.get('/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const users = db
      .prepare('SELECT id, username, name, role, email, totp_enabled, last_login_at, created_at FROM users')
      .all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
