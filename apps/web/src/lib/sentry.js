// VIPOS — Frontend Sentry initialization (lazy-load, PR follow-up to
// `2026-05-06-disk-health-and-ci-timeout-fix.md` Tier-1 backlog).
//
// The Sentry SDK is a heavy dependency (~50 kB gzip in @sentry/react@8)
// so we don't want it sitting in the eager bundle alongside React +
// Router + AuthContext + AppShell. This module:
//   1. Reads `VITE_SENTRY_DSN_FRONTEND` synchronously at boot. If it's
//      unset, becomes a no-op (matches the original off-by-default
//      contract — local dev / unit tests stay completely Sentry-free).
//   2. If a DSN is set, installs lightweight synchronous global
//      `error` + `unhandledrejection` listeners that buffer events
//      into a small bounded queue until the SDK has loaded.
//   3. Schedules a dynamic `import('@sentry/react')` after first paint
//      via `requestIdleCallback` (timeout 2000ms; `setTimeout(_, 1000)`
//      fallback for Safari and other browsers that don't expose rIC).
//      Once loaded, calls `Sentry.init` with the original config,
//      replays any buffered events, and removes the pre-init listeners
//      (Sentry installs its own `GlobalHandlers` integration so we
//      don't want both running and double-capturing).
//
// Net effect: Sentry SDK becomes a lazy chunk fetched after first
// paint instead of part of the eager bundle. Errors during first paint
// still reach Sentry via the buffer-and-replay path. The PII scrubbing
// helpers stay in the eager bundle (they're tiny pure functions and
// they're passed by reference to Sentry.init when it loads).
//
// Rollback recipe (if Sentry stops capturing in production after this
// PR ships): revert this file to the pre-PR version (synchronous
// `import * as Sentry from '@sentry/react'` + `Sentry.init` in
// `initSentry`) and re-deploy. Backend Sentry (`apps/backend/src/
// lib/sentry.js`) is unaffected.

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

// Module state — reset by `_resetSentryForTests`.
let initialized = false;
let initPromise = null;
let SentrySDK = null;

// Pre-init buffer: errors thrown before the lazy SDK chunk has loaded
// are queued here and replayed once Sentry boots. Bounded so a runaway
// error loop during first paint can't blow memory.
const PRE_INIT_BUFFER_MAX = 50;
let preInitBuffer = [];
let preInitErrorHandler = null;
let preInitRejectionHandler = null;

function bufferError(error, extra) {
  if (preInitBuffer.length >= PRE_INIT_BUFFER_MAX) return;
  preInitBuffer.push({ error, extra });
}

function installPreInitHandlers() {
  if (typeof window === 'undefined' || preInitErrorHandler) return;
  preInitErrorHandler = (event) => {
    bufferError(event.error ?? new Error(event.message ?? 'unknown error'), {
      source: 'window.error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  };
  preInitRejectionHandler = (event) => {
    const reason = event.reason ?? new Error('unhandled rejection');
    const err = reason instanceof Error ? reason : new Error(String(reason));
    bufferError(err, { source: 'unhandledrejection' });
  };
  window.addEventListener('error', preInitErrorHandler);
  window.addEventListener('unhandledrejection', preInitRejectionHandler);
}

function removePreInitHandlers() {
  if (typeof window === 'undefined') return;
  if (preInitErrorHandler) {
    window.removeEventListener('error', preInitErrorHandler);
    preInitErrorHandler = null;
  }
  if (preInitRejectionHandler) {
    window.removeEventListener('unhandledrejection', preInitRejectionHandler);
    preInitRejectionHandler = null;
  }
}

function replayBufferedEvents(Sentry) {
  for (const { error, extra } of preInitBuffer) {
    try {
      Sentry.withScope((scope) => {
        scope.setTag('source', extra?.source ?? 'pre-init-buffer');
        for (const [k, v] of Object.entries(extra ?? {})) {
          if (k !== 'source' && v !== undefined) scope.setExtra(k, v);
        }
        Sentry.captureException(error);
      });
    } catch {
      // Replay must never break the app — if Sentry rejects an event
      // we just drop it and continue.
    }
  }
  preInitBuffer = [];
}

async function loadAndInit(dsn, environment, release) {
  // Vite splits this dynamic import into a separate chunk so the
  // Sentry SDK never enters the eager bundle.
  const mod = await import('@sentry/react');
  mod.init({
    dsn,
    environment,
    release,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSend: scrubEvent,
  });
  SentrySDK = mod;
  initialized = true;
  replayBufferedEvents(mod);
  removePreInitHandlers();
  return true;
}

function scheduleInit(dsn, environment, release) {
  if (initPromise) return initPromise;
  initPromise = new Promise((resolve) => {
    const run = () => {
      loadAndInit(dsn, environment, release)
        .then(resolve)
        .catch(() => {
          // Network failure / chunk load error / etc. Don't break the
          // app — Sentry capture is best-effort. Reset state so a
          // future call to initSentry can retry.
          initPromise = null;
          resolve(false);
        });
    };
    if (typeof window === 'undefined') {
      run();
    } else if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 2000 });
    } else {
      window.setTimeout(run, 1000);
    }
  });
  return initPromise;
}

export function initSentry({ dsn, environment, release } = {}) {
  if (initialized) return false;
  if (initPromise) return false;

  // Direct (non-optional) `import.meta.env.X` access lets Vite statically
  // replace these with literals at build time. Optional chaining defeats
  // the static-analysis pass and causes Vite to emit a runtime lookup
  // against an empty `import.meta.env` object — leading to silent Sentry
  // init failure (no DSN, no release) in production. See vite.config.js
  // for the matching `define` overrides.
  const resolvedDsn = dsn ?? import.meta.env.VITE_SENTRY_DSN_FRONTEND;
  if (!resolvedDsn) return false;

  const resolvedEnvironment = environment ?? import.meta.env.MODE ?? 'production';
  const resolvedRelease = release ?? import.meta.env.VITE_SENTRY_RELEASE;

  installPreInitHandlers();
  scheduleInit(resolvedDsn, resolvedEnvironment, resolvedRelease);

  // Return true to signal "scheduled". Note: `isSentryInitialized()`
  // will still return false until the dynamic import resolves —
  // callers needing post-init guarantees should await the SDK load
  // explicitly via `_loadSentryNowForTests` (test-only).
  return true;
}

export function captureBoundaryError(error, info) {
  if (initialized && SentrySDK) {
    SentrySDK.withScope((scope) => {
      scope.setTag('source', 'react-error-boundary');
      if (info && typeof info.componentStack === 'string') {
        scope.setExtra('componentStack', info.componentStack);
      }
      SentrySDK.captureException(error);
    });
    return;
  }
  // Pre-init: buffer for later replay (only if pre-init handlers were
  // installed — i.e., a DSN is configured for this build). Without a
  // DSN we silently drop, matching the original off-by-default contract.
  if (preInitErrorHandler) {
    bufferError(error, {
      source: 'react-error-boundary',
      componentStack: info?.componentStack,
    });
  }
}

export function isSentryInitialized() {
  return initialized;
}

// Test-only: reset module state so unit tests can re-initialize cleanly.
export function _resetSentryForTests() {
  initialized = false;
  initPromise = null;
  SentrySDK = null;
  preInitBuffer = [];
  removePreInitHandlers();
}

// Test-only: synchronously load + init Sentry (skips the rIC schedule
// step) so tests can assert on post-init behavior without timer hacks.
// Returns the promise from `loadAndInit` directly.
export function _loadSentryNowForTests({ dsn, environment, release } = {}) {
  if (initialized) return Promise.resolve(false);
  const resolvedDsn =
    dsn ?? import.meta.env.VITE_SENTRY_DSN_FRONTEND ?? 'https://test@sentry.test/1';
  const resolvedEnvironment = environment ?? 'test';
  const resolvedRelease = release ?? 'test@0.0.0';
  installPreInitHandlers();
  initPromise = loadAndInit(resolvedDsn, resolvedEnvironment, resolvedRelease).catch(() => {
    initPromise = null;
    return false;
  });
  return initPromise;
}

// Re-export the scrub helpers so they can be unit-tested without firing
// Sentry.init (which would require a live DSN + network).
export const _internal = {
  scrubBreadcrumb,
  scrubEvent,
  scrubObject,
  SENSITIVE_KEYS,
  // Test-only buffer accessors.
  _getPreInitBufferLength: () => preInitBuffer.length,
  _getPreInitBuffer: () => preInitBuffer.slice(),
  _hasPreInitHandlers: () => preInitErrorHandler !== null,
};
