/**
 * Tests for the async query layer (P2-01b).
 *
 * Covers the SQLite driver (default). The Postgres driver is exercised
 * indirectly by integration smoke tests — running its tests requires a
 * live Postgres host which we don't ship in CI yet (P2-01b-finalstep).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let initDatabase;
let query;
let tx;
let iLikePattern;
let _resetForTests;

beforeAll(() => {
  setupTestEnv();
  // Force sqlite driver explicitly even if env was set elsewhere.
  process.env.DATABASE_DRIVER = 'sqlite';
  ({ initDatabase } = require('../models/database'));
  ({ query, tx, iLikePattern, _resetForTests } = require('../db'));
  _resetForTests();
  initDatabase();
});

afterAll(() => {
  _resetForTests();
  teardownTestEnv();
});

describe('async query layer (sqlite driver)', () => {
  it('SELECT returns rows + rowCount', async () => {
    const r = await query('SELECT id, username FROM users WHERE username = $1', ['admin']);
    expect(r.rows.length).toBeGreaterThanOrEqual(1);
    expect(r.rowCount).toBe(r.rows.length);
    expect(r.rows[0]).toHaveProperty('id');
    expect(r.rows[0]).toHaveProperty('username', 'admin');
  });

  it('translates Postgres $N placeholders to SQLite ? placeholders', async () => {
    const r = await query('SELECT id FROM users WHERE username = $1 OR username = $2', [
      'admin',
      'nonexistent',
    ]);
    expect(r.rows.length).toBe(1);
  });

  it('UPDATE without RETURNING reports rowCount = changes', async () => {
    const before = await query('SELECT id FROM users WHERE username = $1', ['admin']);
    const id = before.rows[0].id;
    const r = await query('UPDATE users SET name = $1 WHERE id = $2', ['Admin Test', id]);
    expect(r.rowCount).toBe(1);
    expect(r.rows).toEqual([]);
  });

  it('INSERT with RETURNING returns the inserted row', async () => {
    const r = await query(
      `INSERT INTO categories (name, description, color)
       VALUES ($1, $2, $3) RETURNING id, name`,
      ['QueryLayer Test Cat', 'For tests', '#04C99E']
    );
    expect(r.rowCount).toBe(1);
    expect(r.rows[0]).toHaveProperty('id');
    expect(r.rows[0].name).toBe('QueryLayer Test Cat');

    // cleanup
    await query('DELETE FROM categories WHERE id = $1', [r.rows[0].id]);
  });

  it('DELETE reports rowCount = changes', async () => {
    const ins = await query(
      `INSERT INTO categories (name, description, color)
       VALUES ($1, $2, $3) RETURNING id`,
      ['ToDelete', '', '#000000']
    );
    const r = await query('DELETE FROM categories WHERE id = $1', [ins.rows[0].id]);
    expect(r.rowCount).toBe(1);
  });

  it('tx commits on success', async () => {
    const result = await tx(async (q) => {
      await q(
        `INSERT INTO categories (name, description, color)
         VALUES ($1, $2, $3)`,
        ['TxCommit', '', '#111111']
      );
      const r = await q('SELECT id FROM categories WHERE name = $1', ['TxCommit']);
      return r.rows[0].id;
    });
    expect(result).toBeTruthy();

    const after = await query('SELECT id FROM categories WHERE name = $1', ['TxCommit']);
    expect(after.rows.length).toBe(1);

    // cleanup
    await query('DELETE FROM categories WHERE name = $1', ['TxCommit']);
  });

  it('tx rolls back on thrown error', async () => {
    await expect(
      tx(async (q) => {
        await q(
          `INSERT INTO categories (name, description, color)
           VALUES ($1, $2, $3)`,
          ['TxRollback', '', '#222222']
        );
        throw new Error('intentional rollback');
      })
    ).rejects.toThrow('intentional rollback');

    const after = await query('SELECT id FROM categories WHERE name = $1', ['TxRollback']);
    expect(after.rows.length).toBe(0);
  });

  it('iLikePattern escapes wildcards', () => {
    expect(iLikePattern('100%')).toBe('100\\%');
    expect(iLikePattern('foo_bar')).toBe('foo\\_bar');
    expect(iLikePattern('plain')).toBe('plain');
  });
});
