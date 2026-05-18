// P2-05 PR-B — pino + OpenTelemetry trace_id correlation.
//
// Verifies that a log emitted inside an active OTel span carries the
// span's trace_id when the logger is configured with the same mixin
// app.js uses (`mixin: () => ({ trace_id: currentTraceId() })`).
//
// We stand up an in-process tracer provider (via NodeSDK with the
// console exporter) so the test never hits the network. The pino
// destination is captured via a Writable stream so we can assert on
// the emitted JSON.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const OTEL_PATH = require.resolve('../lib/otel');

function captureStream() {
  const chunks = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString('utf8'));
      cb();
    },
  });
  return { stream, chunks };
}

function parseLines(chunks) {
  return chunks
    .join('')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

let otelMod;
let originalExporter;

beforeAll(() => {
  originalExporter = process.env.OTEL_EXPORTER;
  process.env.OTEL_EXPORTER = 'console';
  delete require.cache[OTEL_PATH];
  otelMod = require('../lib/otel');
  // Initialising mutates the global trace provider, so we keep the
  // SDK alive for the duration of the suite and shut it down in
  // afterAll.
  otelMod.initOtel();
});

afterAll(async () => {
  if (otelMod) await otelMod.shutdownOtel();
  if (originalExporter === undefined) delete process.env.OTEL_EXPORTER;
  else process.env.OTEL_EXPORTER = originalExporter;
});

describe('pino + OTel trace_id correlation', () => {
  it('logs emitted inside an active span carry trace_id', async () => {
    const pino = require('pino');
    const { trace } = require('@opentelemetry/api');
    const tracer = trace.getTracer('vipos-test');

    const { stream, chunks } = captureStream();
    const logger = pino(
      {
        level: 'info',
        mixin: () => {
          const traceId = otelMod.currentTraceId();
          return traceId ? { trace_id: traceId } : {};
        },
      },
      stream
    );

    let traceIdInsideSpan;
    await new Promise((resolve) => {
      tracer.startActiveSpan('unit-correlation', (span) => {
        traceIdInsideSpan = span.spanContext().traceId;
        logger.info({ component: 'unit' }, 'inside span');
        span.end();
        resolve();
      });
    });

    // Outside the span — log should NOT carry trace_id.
    logger.info({ component: 'unit' }, 'outside span');

    const lines = parseLines(chunks);
    expect(lines.length).toBe(2);
    expect(lines[0].msg).toBe('inside span');
    expect(lines[0].trace_id).toBe(traceIdInsideSpan);
    expect(typeof lines[0].trace_id).toBe('string');
    expect(lines[0].trace_id).toMatch(/^[0-9a-f]{32}$/);

    expect(lines[1].msg).toBe('outside span');
    expect(lines[1].trace_id).toBeUndefined();
  });

  it('currentTraceId() reads the active span outside of pino', () => {
    const { trace } = require('@opentelemetry/api');
    const tracer = trace.getTracer('vipos-test');

    let collected;
    tracer.startActiveSpan('unit-current-trace', (span) => {
      collected = otelMod.currentTraceId();
      span.end();
    });

    expect(typeof collected).toBe('string');
    expect(collected).toMatch(/^[0-9a-f]{32}$/);
    // Outside any span, the helper returns undefined again.
    expect(otelMod.currentTraceId()).toBeUndefined();
  });
});
