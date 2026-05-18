// P2-05 PR-A — logger unit tests.
//
// We exercise the Pino logger by piping it through a destination stream
// we own so we can assert on the JSON output. The shared logger from
// `lib/logger.js` is silenced in NODE_ENV=test by default, so we
// instantiate a fresh logger with a known level + stream for each test
// case.

import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { Writable } from 'node:stream';

const require = createRequire(import.meta.url);

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

describe('lib/logger', () => {
  it('exports a usable logger and child() helper', () => {
    const { logger, child } = require('../lib/logger');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof child).toBe('function');
    const scoped = child({ component: 'unit' });
    expect(typeof scoped.info).toBe('function');
  });

  it('emits structured JSON with a base service field', () => {
    const pino = require('pino');
    const { stream, chunks } = captureStream();
    const log = pino({ level: 'info', base: { service: 'vipos-backend' } }, stream);
    log.info({ component: 'unit' }, 'hello');
    const lines = parseLines(chunks);
    expect(lines.length).toBe(1);
    expect(lines[0].service).toBe('vipos-backend');
    expect(lines[0].component).toBe('unit');
    expect(lines[0].msg).toBe('hello');
  });

  it('child loggers inherit and add context', () => {
    const pino = require('pino');
    const { stream, chunks } = captureStream();
    const log = pino({ level: 'info' }, stream);
    const child = log.child({ component: 'audit' });
    child.warn({ entity: 'order' }, 'audit row missing');
    const [line] = parseLines(chunks);
    expect(line.component).toBe('audit');
    expect(line.entity).toBe('order');
    expect(line.level).toBe(40); // pino warn level
  });

  it('respects the configured level (debug suppressed at info)', () => {
    const pino = require('pino');
    const { stream, chunks } = captureStream();
    const log = pino({ level: 'info' }, stream);
    log.debug('should be hidden');
    log.info('should be visible');
    const lines = parseLines(chunks);
    expect(lines.length).toBe(1);
    expect(lines[0].msg).toBe('should be visible');
  });

  it('shared logger is silent in NODE_ENV=test by default', () => {
    // The shared logger is created at module import time. NODE_ENV is
    // 'test' here, so its level resolves to 'silent'. Sanity-check the
    // resolution.
    const { logger } = require('../lib/logger');
    // pino exposes `level` getter on instances.
    expect(logger.level).toBe('silent');
  });
});
