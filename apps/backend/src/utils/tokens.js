// VIPOS — token helpers for auth flow.
//
// Generates / hashes opaque refresh + password-reset tokens. Refresh tokens are
// random URL-safe strings stored in DB only as SHA-256 hashes; the raw token
// is delivered once to the client.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL_DAYS = 30;
const RESET_TOKEN_TTL_HOURS = 24;
const LOGIN_2FA_TTL_SECONDS = 5 * 60; // 5 minutes window to enter 2FA code

function generateOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function signAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  );
}

function signLogin2faToken(user) {
  // Short-lived intermediate token used to prove the user passed username +
  // password but still needs to enter their 2FA code.
  return jwt.sign(
    { id: user.id, username: user.username, scope: 'login_2fa' },
    JWT_SECRET,
    { expiresIn: LOGIN_2FA_TTL_SECONDS },
  );
}

function verifyLogin2faToken(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  if (payload.scope !== 'login_2fa') {
    const err = new Error('invalid scope');
    err.code = 'invalid_scope';
    throw err;
  }
  return payload;
}

function refreshExpiry(rememberMe = false) {
  const days = rememberMe ? REFRESH_TOKEN_TTL_DAYS : 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function resetExpiry() {
  return new Date(Date.now() + RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000);
}

module.exports = {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
  RESET_TOKEN_TTL_HOURS,
  generateOpaqueToken,
  hashToken,
  signAccessToken,
  signLogin2faToken,
  verifyLogin2faToken,
  refreshExpiry,
  resetExpiry,
};
