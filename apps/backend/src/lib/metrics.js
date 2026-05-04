// P2-05 PR-B — Prometheus metrics registry.
//
// Exposes the shared `prom-client` Registry plus the small set of RED
// counters/histograms VIPOS reports on. Helpers (`observeHttp`,
// `observeBullJob`) wrap the metric instances so callers do not need
// to know the metric names or label order.
//
// All metric names use the `vipos_` prefix (matches Sentry's
// `service.name` resource attribute) so a Prometheus scrape across
// multiple services can disambiguate by prefix.
//
// Default Node metrics (CPU, memory, event-loop lag) are registered
// with the same `vipos_` prefix on module load so a scrape always
// returns process-level health alongside the application metrics.

const promClient = require('prom-client');

const METRIC_PREFIX = 'vipos_';

const registry = new promClient.Registry();

// Sensible RED histogram buckets in seconds. Covers fast cache hits
// (~5ms) up to slow report exports (~10s) — anything slower than 10s
// goes into the +Inf bucket.
const HTTP_DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const BULL_DURATION_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300];

promClient.collectDefaultMetrics({
  register: registry,
  prefix: METRIC_PREFIX,
});

const httpRequestsTotal = new promClient.Counter({
  name: `${METRIC_PREFIX}http_requests_total`,
  help: 'Total number of HTTP requests handled, partitioned by method, route, status, and tenant.',
  labelNames: ['method', 'route', 'status_code', 'tenant_id'],
  registers: [registry],
});

const httpRequestDurationSeconds = new promClient.Histogram({
  name: `${METRIC_PREFIX}http_request_duration_seconds`,
  help: 'HTTP request handler latency in seconds.',
  labelNames: ['method', 'route', 'status_code', 'tenant_id'],
  buckets: HTTP_DURATION_BUCKETS,
  registers: [registry],
});

const bullmqJobsTotal = new promClient.Counter({
  name: `${METRIC_PREFIX}bullmq_jobs_total`,
  help: 'Total number of BullMQ jobs processed, partitioned by queue and status.',
  labelNames: ['queue', 'status'],
  registers: [registry],
});

const bullmqJobDurationSeconds = new promClient.Histogram({
  name: `${METRIC_PREFIX}bullmq_job_duration_seconds`,
  help: 'BullMQ job processing latency in seconds.',
  labelNames: ['queue', 'status'],
  buckets: BULL_DURATION_BUCKETS,
  registers: [registry],
});

/**
 * Resolve the route label for a request. Prefer the matched Express
 * route pattern (e.g. `/products/:id`) so high-cardinality dynamic
 * segments are bucketed correctly. Fall back to `req.path` (still
 * static for unmatched/404 paths) when no route was matched.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function resolveRoute(req) {
  const baseUrl = req.baseUrl || '';
  const routePath = req.route?.path;
  if (routePath) {
    if (typeof routePath === 'string') return baseUrl + routePath;
    if (Array.isArray(routePath)) return baseUrl + routePath[0];
  }
  return req.path || req.url || '';
}

/**
 * Resolve the tenant_id label for a request. Empty string when the
 * request was unauthenticated (auth middleware sets `req.tenantId`
 * after JWT validation). Coerce to string so prom-client serialises
 * deterministically.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function resolveTenantId(req) {
  if (req.tenantId == null) return '';
  return String(req.tenantId);
}

/**
 * Record an HTTP request observation. Increments the request counter
 * and records the duration in the latency histogram with identical
 * label sets so RED dashboards can join on (method, route, status).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {number} durationSeconds
 */
function observeHttp(req, res, durationSeconds) {
  const labels = {
    method: req.method,
    route: resolveRoute(req),
    status_code: String(res.statusCode),
    tenant_id: resolveTenantId(req),
  };
  httpRequestsTotal.inc(labels);
  httpRequestDurationSeconds.observe(labels, durationSeconds);
}

/**
 * Record a BullMQ job observation. Called from the worker `completed`
 * and `failed` event listeners wired in `jobs/index.js`.
 *
 * @param {string} queue canonical queue name (e.g. `email`).
 * @param {'completed' | 'failed'} status
 * @param {number} durationSeconds elapsed wall-clock time from
 *   `processedOn` to `finishedOn`. Pass 0 when the job has no
 *   timestamp yet (e.g. failed before processing started).
 */
function observeBullJob(queue, status, durationSeconds) {
  const labels = { queue, status };
  bullmqJobsTotal.inc(labels);
  if (Number.isFinite(durationSeconds) && durationSeconds >= 0) {
    bullmqJobDurationSeconds.observe(labels, durationSeconds);
  }
}

/**
 * Render the full Prometheus exposition format for the shared
 * registry. Returned string is suitable as the body of a `/metrics`
 * HTTP response (caller sets the content-type header).
 *
 * @returns {Promise<string>}
 */
async function renderMetrics() {
  return registry.metrics();
}

/**
 * Reset every metric back to zero. Used by tests to keep counters
 * deterministic across cases — production code never calls this.
 */
function resetMetrics() {
  httpRequestsTotal.reset();
  httpRequestDurationSeconds.reset();
  bullmqJobsTotal.reset();
  bullmqJobDurationSeconds.reset();
}

module.exports = {
  registry,
  contentType: registry.contentType,
  METRIC_PREFIX,
  HTTP_DURATION_BUCKETS,
  BULL_DURATION_BUCKETS,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  bullmqJobsTotal,
  bullmqJobDurationSeconds,
  observeHttp,
  observeBullJob,
  renderMetrics,
  resetMetrics,
  resolveRoute,
  resolveTenantId,
};
