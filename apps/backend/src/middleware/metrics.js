// P2-05 PR-B — Prometheus HTTP request middleware.
//
// Records request rate + duration via `lib/metrics.observeHttp` once
// the response finishes. Mounted at the top of `app.js` so it sees
// every route's final status code.
//
// Cardinality safety:
//   - Labels use `req.route?.path` (joined with `req.baseUrl`) so
//     dynamic segments collapse to their pattern (`/products/:id`)
//     rather than literal values (`/products/123`, `/products/124`,
//     ...). The metrics module owns this resolution.
//   - `/metrics` and any `/health` path are skipped so the histogram
//     is not skewed by Prometheus scrape traffic and uptime probes.

const { observeHttp } = require('../lib/metrics');

const HEALTH_SUFFIX = '/health';
const METRICS_PATH = '/metrics';

/**
 * Decide whether a request should be excluded from metrics. The path
 * comparison is intentionally loose so all the existing health probe
 * surfaces (`/health`, `/api/health`, `/api/v1/health`) are caught
 * without enumerating each one.
 *
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isExcluded(req) {
  const raw = req.originalUrl || req.url || '';
  const path = raw.split('?', 1)[0];
  if (path === METRICS_PATH) return true;
  if (path === HEALTH_SUFFIX) return true;
  if (path.endsWith(HEALTH_SUFFIX)) return true;
  return false;
}

/**
 * Build the metrics middleware. Returns a no-op for excluded paths
 * (so `/metrics` itself does not feed into its own counters).
 *
 * @returns {import('express').RequestHandler}
 */
function metricsMiddleware() {
  return function metricsMiddleware(req, res, next) {
    if (isExcluded(req)) return next();

    const startNs = process.hrtime.bigint();
    let recorded = false;

    function record() {
      if (recorded) return;
      recorded = true;
      const elapsedNs = process.hrtime.bigint() - startNs;
      const durationSeconds = Number(elapsedNs) / 1e9;
      try {
        observeHttp(req, res, durationSeconds);
      } catch {
        // Observability code must never crash a real request.
      }
    }

    res.on('finish', record);
    // `close` fires when the client disconnects before `finish`. Make
    // sure we still record so dropped requests show up in the rate.
    res.on('close', record);

    next();
  };
}

module.exports = {
  metricsMiddleware,
  isExcluded,
};
