/**
 * Sentry Error Monitoring Configuration
 *
 * Provides centralized error tracking and performance monitoring for VIPOS backend.
 *
 * Features:
 * - Automatic error capture
 * - Performance monitoring (transactions, spans)
 * - User context tracking
 * - Custom tags and breadcrumbs
 * - Release tracking
 * - Environment separation (dev, staging, prod)
 *
 * Usage:
 * ```javascript
 * const { captureError, captureMessage, setUser, addBreadcrumb } = require('./lib/sentry');
 *
 * // Capture error
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   captureError(error, { context: 'payment-processing' });
 * }
 *
 * // Set user context
 * setUser({ id: user.id, username: user.username, tenant_id: user.tenant_id });
 *
 * // Add breadcrumb
 * addBreadcrumb({ message: 'User initiated checkout', category: 'action' });
 * ```
 */

const Sentry = require('@sentry/node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');

/**
 * Initialize Sentry with configuration.
 * Call this once at application startup.
 */
function initializeSentry() {
  const dsn = process.env.SENTRY_DSN;

  // Skip initialization if DSN not configured
  if (!dsn) {
    console.warn('[Sentry] DSN not configured, error monitoring disabled');
    return;
  }

  const environment = process.env.NODE_ENV || 'development';
  const release =
    process.env.SENTRY_RELEASE || `vipos-backend@${process.env.npm_package_version || '1.0.0'}`;

  Sentry.init({
    dsn,
    environment,
    release,

    // Performance Monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev

    // Profiling (optional, requires @sentry/profiling-node)
    profilesSampleRate: environment === 'production' ? 0.1 : 1.0,

    // Integrations
    integrations: [
      // Automatic instrumentation
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
      Sentry.prismaIntegration(),
      Sentry.postgresIntegration(),

      // Profiling (optional)
      nodeProfilingIntegration(),
    ],

    // Before send hook - filter sensitive data
    beforeSend(event, _hint) {
      // Remove sensitive data from error context
      if (event.request) {
        // Remove authorization headers
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }

        // Remove sensitive query params
        if (event.request.query_string) {
          event.request.query_string = event.request.query_string
            .replace(/password=[^&]*/gi, 'password=[REDACTED]')
            .replace(/token=[^&]*/gi, 'token=[REDACTED]')
            .replace(/api_key=[^&]*/gi, 'api_key=[REDACTED]');
        }
      }

      // Remove sensitive data from extra context
      if (event.extra) {
        ['password', 'token', 'api_key', 'secret', 'authorization'].forEach((key) => {
          if (event.extra[key]) {
            event.extra[key] = '[REDACTED]';
          }
        });
      }

      return event;
    },

    // Ignore certain errors
    ignoreErrors: [
      // Network errors
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',

      // Client errors (4xx)
      'ValidationError',
      'UnauthorizedError',
      'ForbiddenError',
      'NotFoundError',

      // Rate limiting
      'TooManyRequestsError',
    ],
  });

  console.log(`[Sentry] Initialized (env=${environment}, release=${release})`);
}

/**
 * Capture an error to Sentry.
 *
 * @param {Error} error - The error to capture
 * @param {Object} context - Additional context
 * @param {string} context.context - Error context (e.g., 'payment-processing')
 * @param {Object} context.tags - Custom tags
 * @param {Object} context.extra - Extra data
 * @returns {string} Event ID
 */
function captureError(error, context = {}) {
  return Sentry.captureException(error, {
    tags: context.tags,
    extra: context.extra,
    contexts: {
      context: {
        name: context.context || 'unknown',
      },
    },
  });
}

/**
 * Capture a message to Sentry.
 *
 * @param {string} message - The message to capture
 * @param {string} level - Severity level (fatal, error, warning, info, debug)
 * @param {Object} context - Additional context
 * @returns {string} Event ID
 */
function captureMessage(message, level = 'info', context = {}) {
  return Sentry.captureMessage(message, {
    level,
    tags: context.tags,
    extra: context.extra,
  });
}

/**
 * Set user context for error reports.
 *
 * @param {Object} user - User information
 * @param {string} user.id - User ID
 * @param {string} user.username - Username
 * @param {string} user.email - Email (optional)
 * @param {string} user.tenant_id - Tenant ID (optional)
 * @param {string} user.outlet_id - Outlet ID (optional)
 */
function setUser(user) {
  Sentry.setUser({
    id: user.id,
    username: user.username,
    email: user.email,
    tenant_id: user.tenant_id,
    outlet_id: user.outlet_id,
  });
}

/**
 * Clear user context (call on logout).
 */
function clearUser() {
  Sentry.setUser(null);
}

/**
 * Set custom tag for error grouping.
 *
 * @param {string} key - Tag key
 * @param {string} value - Tag value
 */
function setTag(key, value) {
  Sentry.setTag(key, value);
}

/**
 * Set multiple tags at once.
 *
 * @param {Object} tags - Key-value pairs
 */
function setTags(tags) {
  Sentry.setTags(tags);
}

/**
 * Add breadcrumb for debugging.
 *
 * @param {Object} breadcrumb - Breadcrumb data
 * @param {string} breadcrumb.message - Breadcrumb message
 * @param {string} breadcrumb.category - Category (e.g., 'auth', 'payment', 'api')
 * @param {string} breadcrumb.level - Level (fatal, error, warning, info, debug)
 * @param {Object} breadcrumb.data - Additional data
 */
function addBreadcrumb(breadcrumb) {
  Sentry.addBreadcrumb({
    message: breadcrumb.message,
    category: breadcrumb.category || 'default',
    level: breadcrumb.level || 'info',
    data: breadcrumb.data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Start a performance transaction.
 *
 * @param {string} name - Transaction name
 * @param {string} op - Operation type (e.g., 'http.server', 'db.query')
 * @returns {Transaction} Sentry transaction
 */
function startTransaction(name, op = 'http.server') {
  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Wrap async function with error capture.
 *
 * @param {Function} fn - Async function to wrap
 * @param {Object} context - Error context
 * @returns {Function} Wrapped function
 */
function wrapAsync(fn, context = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureError(error, context);
      throw error;
    }
  };
}

/**
 * Express error handler middleware.
 * Place this AFTER all routes and other error handlers.
 */
const errorHandler = Sentry.Handlers.errorHandler({
  shouldHandleError(error) {
    // Capture 5xx errors
    return error.status >= 500;
  },
});

/**
 * Express request handler middleware.
 * Place this BEFORE all routes.
 */
const requestHandler = Sentry.Handlers.requestHandler({
  user: ['id', 'username', 'email'],
  ip: true,
  request: true,
  transaction: 'methodPath', // Group by HTTP method + path
});

/**
 * Express tracing middleware.
 * Place this AFTER requestHandler and BEFORE routes.
 */
const tracingHandler = Sentry.Handlers.tracingHandler();

/**
 * Flush pending events (call before shutdown).
 *
 * @param {number} timeout - Timeout in milliseconds (default: 2000)
 * @returns {Promise<boolean>} True if flushed successfully
 */
async function flush(timeout = 2000) {
  return Sentry.flush(timeout);
}

/**
 * Close Sentry client (call on shutdown).
 *
 * @param {number} timeout - Timeout in milliseconds (default: 2000)
 * @returns {Promise<boolean>} True if closed successfully
 */
async function close(timeout = 2000) {
  return Sentry.close(timeout);
}

module.exports = {
  initializeSentry,
  captureError,
  captureMessage,
  setUser,
  clearUser,
  setTag,
  setTags,
  addBreadcrumb,
  startTransaction,
  wrapAsync,
  errorHandler,
  requestHandler,
  tracingHandler,
  flush,
  close,
  Sentry, // Export raw Sentry for advanced usage
};
