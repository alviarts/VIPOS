// P2-08 RCA follow-up — verify the `dotenv.config({ override: true })`
// invocation in `worker.js` (and the matching call in `index.js`) lets a
// rotated value in `.env` overwrite a stale one already present in
// `process.env`. The 2026-05-06 db-backup auth-failure incident traced
// to pm2 caching a pre-rotation `DIRECT_URL` at first boot; without
// `override: true`, the worker would re-spawn with the cached stale
// value, dotenv would silently no-op, and pg_dump would fail with a
// confusing `password authentication failed for user "postgres"`. We
// guard the contract here so a future refactor doesn't quietly drop the
// flag.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SENTINEL_KEY = 'VIPOS_DOTENV_OVERRIDE_TEST_SENTINEL';

let tmpDir;
let prevCwd;
let prevSentinel;

beforeEach(async () => {
  prevCwd = process.cwd();
  prevSentinel = process.env[SENTINEL_KEY];
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'vipos-dotenv-override-'));
  process.chdir(tmpDir);
});

afterEach(async () => {
  process.chdir(prevCwd);
  if (prevSentinel === undefined) delete process.env[SENTINEL_KEY];
  else process.env[SENTINEL_KEY] = prevSentinel;
  if (tmpDir) await fsp.rm(tmpDir, { recursive: true, force: true });
});

describe('dotenv.config({ override: true })', () => {
  it('replaces a stale process.env value with the .env file value', () => {
    process.env[SENTINEL_KEY] = 'stale-from-pm2';
    fs.writeFileSync(path.join(tmpDir, '.env'), `${SENTINEL_KEY}=fresh-from-rotation\n`);

    const dotenv = require('dotenv');
    dotenv.config({ override: true });

    expect(process.env[SENTINEL_KEY]).toBe('fresh-from-rotation');
  });

  it('default config (no override) keeps the stale process.env value (regression baseline)', () => {
    process.env[SENTINEL_KEY] = 'stale-from-pm2';
    fs.writeFileSync(path.join(tmpDir, '.env'), `${SENTINEL_KEY}=fresh-from-rotation\n`);

    const dotenv = require('dotenv');
    dotenv.config(); // no override → mirrors the pre-fix bug shape

    expect(process.env[SENTINEL_KEY]).toBe('stale-from-pm2');
  });

  it('worker.js source still calls dotenv with override:true', () => {
    const src = fs.readFileSync(path.join(prevCwd, 'src/worker.js'), 'utf8');
    expect(src).toMatch(/dotenv'\)\.config\(\{\s*override:\s*true\s*\}\)/);
  });

  it('index.js source still calls dotenv with override:true', () => {
    const src = fs.readFileSync(path.join(prevCwd, 'src/index.js'), 'utf8');
    expect(src).toMatch(/dotenv'\)\.config\(\{\s*override:\s*true\s*\}\)/);
  });
});
