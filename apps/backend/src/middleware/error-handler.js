// P2-05 PR-A — global Express error handler.
//
// Mount this *after* all routes (and after the Sentry Express error
// handler if Sentry is enabled). Logs every unhandled error via the
// shared Pino logger and returns a sanitised JSON response with the
// request id so callers can correlate.
//
// We deliberately keep the response shape minimal — we do NOT leak
// stack traces, internal error messages, or internal field names to
// clients in production. In `NODE_ENV=development` we attach the
// stack to ease debugging.

const { logger } = require('../lib/logger');

function buildResponseBody(err, req) {
  // Allow downstream handlers to produce structured client errors via
  // err.status + err.expose pattern (compatible with http-errors).
  const status = Number.isInteger(err?.status) ? err.status : 500;
  const safe = err && err.expose === true;
  const body = {
    error: safe && err.message ? err.message : 'Internal Server Error',
    request_id: req?.id,
  };
  if (process.env.NODE_ENV === 'development' && err?.stack) {
    body.stack = err.stack;
  }
  return { status, body };
}

function globalErrorHandler() {
  // 4-arity Express error middleware. Express dispatches to this when
  // any handler calls next(err) or throws inside an async route that's
  // wrapped to forward errors.
  // eslint-disable-next-line no-unused-vars
  return function (err, req, res, next) {
    const { status, body } = buildResponseBody(err, req);

    // Lean on the per-request child logger pino-http installs as
    // `req.log`. Falls back to the global logger if pino-http hasn't
    // attached one (e.g. error fired before middleware mount).
    const log = req?.log ?? logger;
    log.error(
      {
        component: 'http',
        request_id: req?.id,
        method: req?.method,
        url: req?.originalUrl ?? req?.url,
        status,
        err: {
          message: err?.message,
          stack: err?.stack,
          name: err?.name,
          code: err?.code,
        },
      },
      'unhandled error'
    );

    if (res.headersSent) {
      // Express will fall back to the default error handler which
      // closes the connection. Don't try to send a body.
      return;
    }
    res.status(status).json(body);
  };
}

module.exports = {
  globalErrorHandler,
};
