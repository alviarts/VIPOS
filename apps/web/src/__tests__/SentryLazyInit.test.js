// VIPOS — Lazy-init contract for `apps/web/src/lib/sentry.js`.
//
// Sentry SDK was promoted from a static eager-bundle import to a
// dynamic `import('@sentry/react')` to shave ~50 kB gzip off the
// eager bundle. The trade-off is that errors during first paint can
// arrive before the SDK chunk has finished loading; we cover that
// gap with synchronous `window.error` + `unhandledrejection`
// listeners that buffer events into a bounded queue and replay them
// once Sentry boots.
//
// This file exercises the buffer-and-replay path end-to-end:
//   - pre-init: window.error / unhandledrejection / captureBoundaryError
//     all land in the buffer
//   - init: dynamic import resolves → Sentry.init runs with the
//     correct PII scrubber wiring → buffered events replay → pre-init
//     listeners are detached so we don't double-capture once Sentry's
//     own GlobalHandlers integration is live
//   - reset: `_resetSentryForTests` returns the module to a clean
//     state and unhooks the pre-init listeners
//
// We mock `@sentry/react` to avoid hitting real Sentry endpoints.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const sentryMock = {
  init: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn((fn) => {
    const scope = {
      setTag: vi.fn(),
      setExtra: vi.fn(),
    };
    fn(scope);
    return scope;
  }),
};

vi.mock('@sentry/react', () => sentryMock);

let sentryLib;

beforeEach(async () => {
  sentryMock.init.mockClear();
  sentryMock.captureException.mockClear();
  sentryMock.withScope.mockClear();
  // Re-import via dynamic import on each test so module state is
  // truly fresh — `_resetSentryForTests` covers the runtime state but
  // `vi.resetModules()` is the safer guarantee for "no leak between
  // tests".
  vi.resetModules();
  sentryLib = await import('../lib/sentry.js');
});

afterEach(() => {
  if (sentryLib && typeof sentryLib._resetSentryForTests === 'function') {
    sentryLib._resetSentryForTests();
  }
});

describe('initSentry — lazy schedule contract', () => {
  it('returns false and skips handler install when no DSN provided', () => {
    const ok = sentryLib.initSentry({ dsn: undefined });
    expect(ok).toBe(false);
    expect(sentryLib.isSentryInitialized()).toBe(false);
    expect(sentryLib._internal._hasPreInitHandlers()).toBe(false);
  });

  it('installs pre-init handlers when DSN is provided', () => {
    const ok = sentryLib.initSentry({ dsn: 'https://test@sentry.test/1' });
    expect(ok).toBe(true);
    expect(sentryLib._internal._hasPreInitHandlers()).toBe(true);
    // SDK has not been loaded synchronously — `init` was scheduled, not
    // run. The eager bundle should NOT contain the SDK module.
    expect(sentryLib.isSentryInitialized()).toBe(false);
    expect(sentryMock.init).not.toHaveBeenCalled();
  });

  it('is idempotent — second call while scheduled returns false', () => {
    expect(sentryLib.initSentry({ dsn: 'https://test@sentry.test/1' })).toBe(true);
    expect(sentryLib.initSentry({ dsn: 'https://test@sentry.test/1' })).toBe(false);
  });
});

describe('pre-init buffer — synchronous capture before SDK boots', () => {
  beforeEach(() => {
    sentryLib.initSentry({ dsn: 'https://test@sentry.test/1' });
  });

  it('buffers window.error events', () => {
    const err = new Error('first paint crash');
    window.dispatchEvent(new ErrorEvent('error', { error: err, message: err.message }));
    const buffer = sentryLib._internal._getPreInitBuffer();
    expect(buffer).toHaveLength(1);
    expect(buffer[0].error).toBe(err);
    expect(buffer[0].extra.source).toBe('window.error');
  });

  it('buffers unhandledrejection events with non-Error reasons too', () => {
    // jsdom does not always expose `PromiseRejectionEvent`; fall back
    // to a plain `Event` with `reason` defined manually so this stays
    // jsdom-portable. The runtime contract we care about is "the
    // handler is invoked with `event.reason` and a non-Error reason
    // is wrapped in an Error".
    const hasPRE = typeof globalThis.PromiseRejectionEvent === 'function';
    const evt = hasPRE
      ? new globalThis.PromiseRejectionEvent('unhandledrejection', {
          promise: Promise.resolve(),
          reason: 'string-reason',
        })
      : Object.assign(new Event('unhandledrejection'), { reason: 'string-reason' });
    window.dispatchEvent(evt);
    const buffer = sentryLib._internal._getPreInitBuffer();
    expect(buffer).toHaveLength(1);
    expect(buffer[0].error).toBeInstanceOf(Error);
    expect(buffer[0].error.message).toBe('string-reason');
    expect(buffer[0].extra.source).toBe('unhandledrejection');
  });

  it('buffers captureBoundaryError calls until SDK loads', () => {
    const err = new Error('boundary');
    sentryLib.captureBoundaryError(err, { componentStack: '<App>' });
    const buffer = sentryLib._internal._getPreInitBuffer();
    expect(buffer).toHaveLength(1);
    expect(buffer[0].error).toBe(err);
    expect(buffer[0].extra.source).toBe('react-error-boundary');
    expect(buffer[0].extra.componentStack).toBe('<App>');
  });

  it('drops events past PRE_INIT_BUFFER_MAX (50) without throwing', () => {
    for (let i = 0; i < 60; i += 1) {
      sentryLib.captureBoundaryError(new Error(`crash-${i}`));
    }
    expect(sentryLib._internal._getPreInitBufferLength()).toBe(50);
  });
});

describe('SDK boot — dynamic import + replay + handler detach', () => {
  it('loads Sentry, calls init with PII scrubbers, replays buffer, and detaches handlers', async () => {
    sentryLib.initSentry({ dsn: 'https://test@sentry.test/1' });

    // Buffer two events while the SDK is still "loading".
    sentryLib.captureBoundaryError(new Error('boundary-pre-init'), {
      componentStack: '<App>',
    });
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('window-pre-init') }));
    expect(sentryLib._internal._getPreInitBufferLength()).toBe(2);

    // Synchronously trigger the SDK load (skips the rIC schedule).
    await sentryLib._loadSentryNowForTests({ dsn: 'https://test@sentry.test/1' });

    expect(sentryLib.isSentryInitialized()).toBe(true);
    expect(sentryMock.init).toHaveBeenCalledTimes(1);
    const initCall = sentryMock.init.mock.calls[0][0];
    expect(initCall.dsn).toBe('https://test@sentry.test/1');
    // PII scrubbers must be wired — losing these is a P0 privacy bug.
    expect(initCall.beforeBreadcrumb).toBe(sentryLib._internal.scrubBreadcrumb);
    expect(initCall.beforeSend).toBe(sentryLib._internal.scrubEvent);
    // Replays must round-trip through Sentry.captureException.
    expect(sentryMock.captureException).toHaveBeenCalledTimes(2);
    expect(sentryMock.captureException.mock.calls[0][0].message).toBe('boundary-pre-init');
    expect(sentryMock.captureException.mock.calls[1][0].message).toBe('window-pre-init');

    // Buffer drained, handlers detached so Sentry's GlobalHandlers
    // integration owns capture from here on. Asserting handler-detach
    // is the right invariant — actually dispatching a post-init
    // ErrorEvent would propagate to jsdom's `process.on('uncaught
    // Exception')` shim and pollute the suite, so we don't.
    expect(sentryLib._internal._getPreInitBufferLength()).toBe(0);
    expect(sentryLib._internal._hasPreInitHandlers()).toBe(false);
  });

  it('captureBoundaryError forwards to Sentry directly once SDK is loaded', async () => {
    sentryLib.initSentry({ dsn: 'https://test@sentry.test/1' });
    await sentryLib._loadSentryNowForTests({ dsn: 'https://test@sentry.test/1' });

    sentryMock.captureException.mockClear();
    sentryMock.withScope.mockClear();

    const err = new Error('post-init-boundary');
    sentryLib.captureBoundaryError(err, { componentStack: '<Page>' });

    expect(sentryMock.withScope).toHaveBeenCalledTimes(1);
    expect(sentryMock.captureException).toHaveBeenCalledTimes(1);
    expect(sentryMock.captureException.mock.calls[0][0]).toBe(err);
  });
});

describe('_resetSentryForTests', () => {
  it('clears module state and detaches handlers so a fresh init works', async () => {
    sentryLib.initSentry({ dsn: 'https://test@sentry.test/1' });
    sentryLib.captureBoundaryError(new Error('first'));
    expect(sentryLib._internal._getPreInitBufferLength()).toBe(1);
    expect(sentryLib._internal._hasPreInitHandlers()).toBe(true);

    sentryLib._resetSentryForTests();
    expect(sentryLib.isSentryInitialized()).toBe(false);
    expect(sentryLib._internal._getPreInitBufferLength()).toBe(0);
    expect(sentryLib._internal._hasPreInitHandlers()).toBe(false);

    // Re-init should work cleanly.
    expect(sentryLib.initSentry({ dsn: 'https://test@sentry.test/1' })).toBe(true);
    expect(sentryLib._internal._hasPreInitHandlers()).toBe(true);
  });
});
