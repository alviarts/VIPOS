// P2-05 PR-A — Sentry init gating tests.
//
// We don't want tests to actually emit traffic to Sentry. Verify:
//   - initSentry() is a no-op when SENTRY_DSN is unset.
//   - isEnabled() reflects the env state.
//   - attachSentryUserMiddleware() returns a function that calls next()
//     without throwing whether or not Sentry is enabled.
//   - attachSentryErrorHandler() is a no-op without Sentry init.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const SENTRY_PATH = require.resolve('../lib/sentry');

function freshSentry() {
  // Drop the cached module so each test gets a clean `initialized` flag.
  delete require.cache[SENTRY_PATH];
  return require('../lib/sentry');
}

describe('lib/sentry', () => {
  let originalDsn;

  beforeEach(() => {
    originalDsn = process.env.SENTRY_DSN;
    delete process.env.SENTRY_DSN;
  });

  afterEach(() => {
    if (originalDsn === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = originalDsn;
    }
  });

  it('initSentry() is a no-op without SENTRY_DSN', () => {
    const mod = freshSentry();
    expect(mod.isEnabled()).toBe(false);
    expect(mod.initSentry()).toBe(false);
    expect(mod.isEnabled()).toBe(false);
  });

  it('attachSentryUserMiddleware returns a passthrough when disabled', () => {
    const mod = freshSentry();
    const mw = mod.attachSentryUserMiddleware();
    let called = false;
    mw({}, {}, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('attachSentryErrorHandler is a no-op without init', () => {
    const mod = freshSentry();
    // Should not throw even when called with a bare object — the
    // middleware function only fires when initialized=true.
    expect(() => mod.attachSentryErrorHandler({ use() {} })).not.toThrow();
  });

  it('isEnabled() reflects SENTRY_DSN env var', () => {
    process.env.SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';
    const mod = freshSentry();
    expect(mod.isEnabled()).toBe(true);
    // We do NOT call initSentry() here — that would fire actual
    // network handshakes. isEnabled() is a pure env check.
  });
});
