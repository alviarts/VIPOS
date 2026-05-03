/**
 * Helper to spin up a fresh per-test SQLite DB.
 *
 * Sets process.env.VIPOS_DB_PATH to a temp file and forces the database
 * singleton to open against it. Each test file gets its own DB so tests don't
 * cross-contaminate.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { _resetDbForTests } = require('../models/database');

const created = [];

export function setupTestEnv() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-vipos';
  process.env.DISABLE_API_DOCS = '1';

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vipos-test-'));
  const dbFile = path.join(dir, 'vipos.db');
  process.env.VIPOS_DB_PATH = dbFile;
  created.push({ dir, dbFile });

  _resetDbForTests();
  return { dbFile, dir };
}

export function teardownTestEnv() {
  _resetDbForTests();
  while (created.length) {
    const { dir } = created.pop();
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  delete process.env.VIPOS_DB_PATH;
}
