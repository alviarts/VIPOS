// Sentry integration - simplified version
const Sentry = require('@sentry/node');

function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log('Sentry disabled (no DSN)');
    return;
  }
  
  try {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENV || process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
    console.log('Sentry initialized');
  } catch (err) {
    console.error('Sentry init failed:', err.message);
  }
}

function attachSentryUserMiddleware() {
  return (req, res, next) => next();
}

function attachSentryErrorHandler(app) {
  if (process.env.SENTRY_DSN && Sentry.Handlers) {
    try {
      app.use(Sentry.Handlers.errorHandler());
    } catch (err) {
      console.error('Sentry error handler failed:', err.message);
    }
  }
}

module.exports = { initSentry, attachSentryUserMiddleware, attachSentryErrorHandler };
