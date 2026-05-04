// P2-05 PR-B — OpenTelemetry SDK init (gated on OTEL_EXPORTER_OTLP_ENDPOINT).
//
// Mirrors the Sentry init pattern in `lib/sentry.js`: when no
// exporter is configured the call is a no-op so tests + local dev
// boot with zero tracing overhead. When enabled, the SDK is started
// **before** `require('express')` so OTel's auto-instrumentations
// can patch the prototypes for HTTP, Express, pg, ioredis, and
// bullmq.
//
// Exporters:
//   - `OTEL_EXPORTER=console` → ConsoleSpanExporter (dev-friendly).
//   - default → OTLP/HTTP exporter targeting
//     `OTEL_EXPORTER_OTLP_ENDPOINT` (or
//     `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` when set).
//
// Resource attributes are populated from the package version and
// NODE_ENV so all spans carry identical service/version metadata
// across the API and worker processes.

const { logger } = require('./logger');

const SERVICE_NAME = 'vipos-backend';

let initialized = false;
let activeSdk = null;

/**
 * Returns true when an OTel exporter has been configured. The SDK
 * is initialised lazily by `initOtel()` once this returns true.
 */
function isEnabled() {
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return true;
  if (process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) return true;
  if (process.env.OTEL_EXPORTER === 'console') return true;
  return false;
}

function resolveServiceVersion() {
  try {
    return require('../../package.json').version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Build the Resource describing this process. Kept in its own
 * function so tests can introspect the attribute shape without
 * starting the full SDK.
 */
function buildResource() {
  // Lazy require so `lib/otel` does not pull half of OpenTelemetry
  // into process startup when OTel is disabled.
  const { resourceFromAttributes } = require('@opentelemetry/resources');
  const {
    ATTR_SERVICE_NAME,
    ATTR_SERVICE_VERSION,
  } = require('@opentelemetry/semantic-conventions');

  // `deployment.environment.name` is the current spec name for the
  // deployment-environment attribute. We hard-code the literal because
  // `@opentelemetry/semantic-conventions` v1.40 has not yet exposed
  // it as a stable named export.
  return resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: resolveServiceVersion(),
    'deployment.environment.name': process.env.OTEL_ENV || process.env.NODE_ENV || 'development',
  });
}

function buildExporter() {
  if (process.env.OTEL_EXPORTER === 'console') {
    const { ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-base');
    return new ConsoleSpanExporter();
  }
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
  return new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      // The OTLP HTTP collector convention is `<base>/v1/traces`. We
      // accept the base endpoint and let the exporter append the
      // suffix when only the base is given.
      undefined,
  });
}

// Explicit auto-instrumentation allow-list. Matches the package set
// VIPOS actually uses on the request path (HTTP server + Express
// router → pg query / Redis cache / BullMQ producers). Anything not
// in this list is disabled to keep the auto-instrumentation footprint
// small and shutdown fast.
const ENABLED_INSTRUMENTATIONS = new Set([
  '@opentelemetry/instrumentation-http',
  '@opentelemetry/instrumentation-express',
  '@opentelemetry/instrumentation-pg',
  '@opentelemetry/instrumentation-ioredis',
  '@opentelemetry/instrumentation-bullmq',
]);

function buildInstrumentationConfig() {
  const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');

  // `getNodeAutoInstrumentations()` returns the full bundle. We take
  // it once with no overrides, then explicitly disable every entry
  // that is not in the allow-list. This keeps us forward-compatible
  // with new instrumentations the bundle adds in future versions.
  const all = getNodeAutoInstrumentations();
  return all.filter((instr) => ENABLED_INSTRUMENTATIONS.has(instr.instrumentationName));
}

/**
 * Initialise the OpenTelemetry Node SDK. No-op when no exporter is
 * configured. Idempotent — second + later calls return the same
 * boolean as the first.
 *
 * Must be called BEFORE `require('express')` so the
 * auto-instrumentations can patch the framework prototype.
 *
 * @returns {boolean} true when the SDK started, false otherwise.
 */
function initOtel() {
  if (initialized) return Boolean(activeSdk);
  if (!isEnabled()) return false;

  try {
    const { NodeSDK } = require('@opentelemetry/sdk-node');

    activeSdk = new NodeSDK({
      resource: buildResource(),
      traceExporter: buildExporter(),
      instrumentations: buildInstrumentationConfig(),
    });
    activeSdk.start();
    initialized = true;
    logger.info({ component: 'otel' }, 'OpenTelemetry SDK initialised');
    return true;
  } catch (err) {
    logger.warn(
      { component: 'otel', err: err.message },
      'OpenTelemetry init failed — continuing without tracing'
    );
    activeSdk = null;
    initialized = true;
    return false;
  }
}

/**
 * Shut the SDK down cleanly. Used by tests and graceful-shutdown
 * handlers. Safe to call when init never ran.
 */
async function shutdownOtel() {
  if (!activeSdk) return;
  try {
    await activeSdk.shutdown();
  } catch {
    /* ignore */
  } finally {
    activeSdk = null;
    initialized = false;
  }
}

/**
 * Read the active span's trace id, if any. Returns `undefined` when
 * no SDK is active (the OTel API installs a no-op tracer in that
 * case). Used by the pino-http mixin so log lines can join trace
 * ids without callers needing to import the OTel API.
 *
 * @returns {string | undefined}
 */
function currentTraceId() {
  try {
    const { trace } = require('@opentelemetry/api');
    const span = trace.getActiveSpan();
    if (!span) return undefined;
    const ctx = span.spanContext();
    if (!ctx || !ctx.traceId || ctx.traceId === '00000000000000000000000000000000') {
      return undefined;
    }
    return ctx.traceId;
  } catch {
    return undefined;
  }
}

module.exports = {
  initOtel,
  shutdownOtel,
  isEnabled,
  currentTraceId,
  buildResource,
  ENABLED_INSTRUMENTATIONS,
  SERVICE_NAME,
};
