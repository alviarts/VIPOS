// P2-05 PR-A — Sentry SDK init (gated on SENTRY_DSN).
//
// Sentry initialisation is opt-in via the `SENTRY_DSN` environment
// variable. When unset (the default for local dev, CI, and any
// environment that hasn't been provisioned a DSN) all helpers below are
// no-ops, so the app boots and tests run without ever touching the
// Sentry network surface.
//
// Express integration:
//   - The official @sentry/node v8 SDK auto-instruments Express via
//     OpenTelemetry once `init()` runs *before* express is required.
//     We import this module from the very top of `app.js` so init runs
//     early enough to hook the Express prototype.
//   - Errors are reported via `Sentry.setupExpressErrorHandler(app)`,
//     which the global error-handler middleware delegates to.
//
// User context:
//   - `attachSentryUserMiddleware()` sets per-request user context
//     (id, tenant_id) via Sentry.setUser() inside an isolation scope so
//     concurrent requests do not bleed into each other.

const Sentry = require('@sentry/node');
const { logger } = require('./logger');

let initialized = false;

function isEnabled() {
  return Boolean(process.env.SENTRY_DSN);
}

/**
 * Initialise Sentry. Safe to call multiple times — subsequent calls
 * after the first are no-ops.
 *
 * @param {object} [opts]
 * @param {string} [opts.dsn]      override SENTRY_DSN
 * @param {string} [opts.env]      override SENTRY_ENV / NODE_ENV
 * @param {string} [opts.release]  override SENTRY_RELEASE
 * @returns {boolean} true if Sentry was initialised, false otherwise.
 */
function initSentry(opts = {}) {
  if (initialized) return true;
  const dsn = opts.dsn ?? process.env.SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: opts.env ?? process.env.SENTRY_ENV ?? process.env.NODE_ENV ?? 'development',
    release: opts.release ?? process.env.SENTRY_RELEASE,
    // Conservative default — sample 10% of traces. Override via env.
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
      ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
      : 0.1,
  });
  initialized = true;
  logger.info({ component: 'sentry' }, 'Sentry initialised');
  return true;
}

/**
 * Attach req.user / req.tenantId to the active Sentry scope so
 * subsequent error events include who/what context. No-op when Sentry
 * is not initialised.
 */
function attachSentryUserMiddleware() {
  return function attachSentryUser(req, _res, next) {
    if (!initialized) return next();
    Sentry.withIsolationScope((scope) => {
      const user = req.user;
      if (user) {
        scope.setUser({
          id: user.user_id ?? user.id,
          username: user.username,
        });
      }
      if (req.tenantId != null) {
        scope.setTag('tenant_id', String(req.tenantId));
      }
      if (req.id) {
        scope.setTag('request_id', req.id);
      }
      next();
    });
  };
}

/**
 * Mount the Sentry Express error handler. No-op when Sentry is not
 * initialised — the global error-handler middleware will still log via
 * Pino in that case.
 *
 * @param {import('express').Express} app
 */
function attachSentryErrorHandler(app) {
  if (!initialized) return;
  Sentry.setupExpressErrorHandler(app);
}

module.exports = {
  initSentry,
  attachSentryUserMiddleware,
  attachSentryErrorHandler,
  isEnabled,
  // Re-exported so callers can capture custom errors without
  // re-importing the SDK.
  Sentry,
};
