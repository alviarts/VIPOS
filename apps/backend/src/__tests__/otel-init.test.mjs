// P2-05 PR-B — `lib/otel` init gating tests.
//
// We avoid hitting the real OTLP collector. The `console` exporter
// path lets us assert that init succeeds without requiring a remote
// endpoint, and the no-op path covers the gating contract.
//
// Each test gets a fresh module instance via `freshOtel()` so the
// `initialized` flag does not leak between cases.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const OTEL_PATH = require.resolve('../lib/otel');

function freshOtel() {
  delete require.cache[OTEL_PATH];
  return require('../lib/otel');
}

describe('lib/otel', () => {
  let originalEndpoint;
  let originalTracesEndpoint;
  let originalExporter;

  beforeEach(() => {
    originalEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    originalTracesEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    originalExporter = process.env.OTEL_EXPORTER;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    delete process.env.OTEL_EXPORTER;
  });

  afterEach(async () => {
    // Restore env so other test files keep their expected state.
    if (originalEndpoint === undefined) delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    else process.env.OTEL_EXPORTER_OTLP_ENDPOINT = originalEndpoint;
    if (originalTracesEndpoint === undefined) delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    else process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = originalTracesEndpoint;
    if (originalExporter === undefined) delete process.env.OTEL_EXPORTER;
    else process.env.OTEL_EXPORTER = originalExporter;

    // Ensure we never leave a started SDK behind for other tests.
    try {
      const mod = require('../lib/otel');
      await mod.shutdownOtel();
    } catch {
      /* ignore */
    }
  });

  it('isEnabled() is false when no exporter env vars are set', () => {
    const mod = freshOtel();
    expect(mod.isEnabled()).toBe(false);
  });

  it('isEnabled() is true when OTEL_EXPORTER_OTLP_ENDPOINT is set', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
    const mod = freshOtel();
    expect(mod.isEnabled()).toBe(true);
  });

  it('isEnabled() is true when OTEL_EXPORTER=console', () => {
    process.env.OTEL_EXPORTER = 'console';
    const mod = freshOtel();
    expect(mod.isEnabled()).toBe(true);
  });

  it('initOtel() is a no-op without an exporter (returns false)', () => {
    const mod = freshOtel();
    expect(mod.initOtel()).toBe(false);
    expect(mod.currentTraceId()).toBeUndefined();
  });

  it('initOtel() with OTEL_EXPORTER=console starts the SDK', async () => {
    process.env.OTEL_EXPORTER = 'console';
    const mod = freshOtel();
    expect(mod.initOtel()).toBe(true);
    // Idempotent — second call returns true without re-initialising.
    expect(mod.initOtel()).toBe(true);
    await mod.shutdownOtel();
  });

  it('buildResource() carries vipos-backend service.name + version', () => {
    process.env.OTEL_EXPORTER = 'console';
    const mod = freshOtel();
    const resource = mod.buildResource();
    // Resource v2 exposes attributes on either `attributes` (legacy)
    // or via async detection. The synchronous path is simplest:
    const attrs = resource.attributes || {};
    expect(attrs['service.name']).toBe('vipos-backend');
    expect(typeof attrs['service.version']).toBe('string');
    expect(attrs['deployment.environment.name']).toBeDefined();
  });

  it('currentTraceId() returns undefined when no span is active', () => {
    const mod = freshOtel();
    expect(mod.currentTraceId()).toBeUndefined();
  });
});
