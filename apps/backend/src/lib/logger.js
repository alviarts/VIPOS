// P2-05 PR-A — structured Pino logger.
//
// Single shared base logger. Modules use either `logger` directly or
// `child({ component: 'foo' })` to inherit + add context.
//
// Output format:
//   - test (NODE_ENV=test): silent by default to keep test output clean
//     unless LOG_LEVEL is explicitly set.
//   - development: pretty-printed via pino-pretty when available.
//   - production / anything else: JSON one-line-per-event.
//
// Configurable env:
//   LOG_LEVEL  — fatal | error | warn | info | debug | trace (default: info,
//                or silent in NODE_ENV=test).
//
// IMPORTANT: keep this file dependency-light (no Express imports). The
// worker process and CLI scripts share the same logger.

const pino = require('pino');

function resolveLevel() {
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL;
  if (process.env.NODE_ENV === 'test') return 'silent';
  return 'info';
}

function buildBaseLogger() {
  const level = resolveLevel();
  const nodeEnv = process.env.NODE_ENV || 'development';

  // In dev, try to use pino-pretty for human-readable output. Fall back
  // to JSON if the dev dep is not installed (e.g. in production-only
  // node_modules).
  let transport;
  if (nodeEnv === 'development') {
    try {
      require.resolve('pino-pretty');
      transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      };
    } catch {
      transport = undefined;
    }
  }

  return pino({
    level,
    base: { service: 'vipos-backend' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      // Avoid leaking auth headers, cookies, or tokens into structured
      // logs. Keep this list conservative — adding redactions is cheap,
      // and missing redactions could leak credentials.
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-access-token"]',
        '*.password',
        '*.token',
        '*.access_token',
        '*.refresh_token',
      ],
      remove: true,
    },
    transport,
  });
}

const logger = buildBaseLogger();

/**
 * Create a child logger with extra static context. Convenience wrapper
 * around `logger.child(bindings)` so consumers don't need to import
 * `logger` themselves when they only want a scoped logger.
 *
 * @param {Record<string, unknown>} bindings
 * @returns {pino.Logger}
 */
function child(bindings) {
  return logger.child(bindings || {});
}

module.exports = {
  logger,
  child,
};
