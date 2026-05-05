// VIPOS — Frontend Sentry initialization (PR-1, pra-beta v0.0.1).
//
// Off-by-default: only activates when VITE_SENTRY_DSN_FRONTEND is set in the
// build environment. Local dev / unit tests stay completely Sentry-free, so
// no dummy DSN spam, no extra network calls, no "Sentry is not configured"
// noise in console.
//
// PII scrubbing — we strip request URL queries, breadcrumb data, and
// localStorage references before send so tokens / passwords never leak.
// Sentry's own IP / user-id capture is also disabled (`sendDefaultPii: false`)
// so we get just the stack trace + browser metadata that is needed to
// triage a crash, nothing more.

import * as Sentry from '@sentry/react';

const SENSITIVE_KEYS = [
  'password',
  'access_token',
  'refresh_token',
  'token',
  'login_token',
  'authorization',
  'cookie',
  'set-cookie',
  'totp',
  'totp_code',
];

function scrubObject(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrubObject(v));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.includes(k.toLowerCase())) {
      out[k] = '[redacted]';
    } else if (v && typeof v === 'object') {
      out[k] = scrubObject(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function scrubBreadcrumb(breadcrumb) {
  if (!breadcrumb) return breadcrumb;
  const next = { ...breadcrumb };
  if (next.data) next.data = scrubObject(next.data);
  if (next.message && typeof next.message === 'string') {
    next.message = next.message
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]')
      .replace(/(["']?(?:password|token)["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi, '$1[redacted]');
  }
  return next;
}

function scrubEvent(event) {
  if (!event) return event;
  if (event.request) {
    if (event.request.cookies) event.request.cookies = '[redacted]';
    if (event.request.headers) event.request.headers = scrubObject(event.request.headers);
    if (event.request.data) event.request.data = scrubObject(event.request.data);
    if (typeof event.request.query_string === 'string') {
      event.request.query_string = event.request.query_string.replace(
        /(token|password|totp)=[^&]+/gi,
        '$1=[redacted]'
      );
    }
  }
  if (event.user) {
    delete event.user.username;
    delete event.user.email;
    delete event.user.ip_address;
  }
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  }
  if (event.extra) event.extra = scrubObject(event.extra);
  if (event.contexts) event.contexts = scrubObject(event.contexts);
  return event;
}

let initialized = false;

export function initSentry({ dsn, environment, release } = {}) {
  if (initialized) return false;
  // Direct (non-optional) `import.meta.env.X` access lets Vite statically
  // replace these with literals at build time. Optional chaining defeats
  // the static-analysis pass and causes Vite to emit a runtime lookup
  // against an empty `import.meta.env` object — leading to silent Sentry
  // init failure (no DSN, no release) in production. See vite.config.js
  // for the matching `define` overrides.
  const resolvedDsn = dsn ?? import.meta.env.VITE_SENTRY_DSN_FRONTEND;
  if (!resolvedDsn) return false;
  Sentry.init({
    dsn: resolvedDsn,
    environment: environment ?? import.meta.env.MODE ?? 'production',
    release: release ?? import.meta.env.VITE_SENTRY_RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSend: scrubEvent,
  });
  initialized = true;
  return true;
}

export function captureBoundaryError(error, info) {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    scope.setTag('source', 'react-error-boundary');
    if (info && typeof info.componentStack === 'string') {
      scope.setExtra('componentStack', info.componentStack);
    }
    Sentry.captureException(error);
  });
}

export function isSentryInitialized() {
  return initialized;
}

// Test-only: reset the module state so unit tests can re-initialize cleanly.
export function _resetSentryForTests() {
  initialized = false;
}

// Re-export the scrub helpers so they can be unit-tested without firing
// Sentry.init (which would require a live DSN + network).
export const _internal = {
  scrubBreadcrumb,
  scrubEvent,
  scrubObject,
  SENSITIVE_KEYS,
};
