/**
 * Postgres driver for the async query layer (P2-01b).
 *
 * Uses `pg` (node-postgres) Pool. Activated when env DATABASE_DRIVER=postgres
 * (default is `sqlite` so tests + local dev don't need a Postgres host).
 *
 * CONNECTION:
 *   - Pool created lazily on first query.
 *   - Connection string from DATABASE_URL (Supabase pooler 6543 transaction
 *     mode in production).
 *   - Pool size capped at PG_POOL_MAX env (default 10) — conservative for
 *     PgBouncer transaction-mode hosts.
 *
 * QUERY API:
 *   query(sql, params) → { rows, rowCount } — same shape as the sqlite
 *   driver. SQL uses native $1, $2 placeholders; no translation needed.
 *
 * TRANSACTIONS:
 *   tx(fn) acquires a dedicated client, BEGIN, runs fn with a tx-bound
 *   query helper, then COMMIT or ROLLBACK on error.
 */

let _pool;

function getPool() {
  if (_pool) return _pool;
  const { Pool } = require('pg');
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_DRIVER=postgres but DATABASE_URL is not set. Provision via .env or Devin org-secret.'
    );
  }
  const max = Number(process.env.PG_POOL_MAX || 10);
  _pool = new Pool({
    connectionString: url,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  _pool.on('error', (err) => {
    // Log but don't crash — pool errors during idle should be transient.

    console.error('[pg pool] idle client error:', err.message);
  });
  return _pool;
}

async function query(sql, params = []) {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return { rows: result.rows, rowCount: result.rowCount ?? 0 };
}

async function tx(fn) {
  const pool = getPool();
  const client = await pool.connect();
  const txQuery = async (sql, params = []) => {
    const result = await client.query(sql, params);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  };
  try {
    await client.query('BEGIN');
    const result = await fn(txQuery);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore rollback failure */
    }
    throw err;
  } finally {
    client.release();
  }
}

function _resetForTests() {
  if (_pool) {
    _pool.end().catch(() => {
      /* ignore — best effort */
    });
    _pool = null;
  }
}

module.exports = { query, tx, _resetForTests };
