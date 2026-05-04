/**
 * Postgres driver for the async query layer (P2-01b base + P2-02 multi-tenant
 * RLS support).
 *
 * Uses `pg` (node-postgres) Pool. The driver is hardcoded to Postgres after
 * the P2-01b cutover; SQLite is gone.
 *
 * MULTI-TENANT (P2-02):
 *   Every `query()` and `tx()` runs inside a per-call BEGIN ... COMMIT so we
 *   can `SET LOCAL app.current_tenant = $tenant` and let Postgres RLS policies
 *   filter rows automatically. The tenant id is read from an
 *   AsyncLocalStorage store, populated by the auth middleware
 *   (`authenticateToken` -> `runWithTenant`). When there is no store on the
 *   current async context, we default to tenant id `0` which the RLS policy
 *   treats as a "system" bypass (used by init.js seeders, login lookups, and
 *   the public `/tenant/register` endpoint).
 *
 * CONNECTION:
 *   - Pool created lazily on first query.
 *   - Connection string from DATABASE_URL (Supabase pooler 6543 transaction
 *     mode in production — `SET LOCAL` is the only safe pattern there).
 *   - Pool size capped at PG_POOL_MAX env (default 10).
 *
 * QUERY API:
 *   query(sql, params) → { rows, rowCount }
 *   tx(fn)            → wraps multi-statement work in a single tx.
 *   runWithTenant(id, fn), runAsSystem(fn) → set tenant context for fn.
 */

const { AsyncLocalStorage } = require('node:async_hooks');

let _pool;

const tenantStore = new AsyncLocalStorage();

const SYSTEM_TENANT_SENTINEL = 0;

function getPool() {
  if (_pool) return _pool;
  const pg = require('pg');
  // Coerce BIGINT (oid 20) and NUMERIC (oid 1700) results to JS Number so that
  // COUNT(*) / SUM(...) return numerics in the same shape the legacy SQLite
  // driver did. Values beyond 2^53 will lose precision — acceptable for the
  // counts/aggregates this app actually runs.
  pg.types.setTypeParser(20, (v) => (v == null ? null : Number(v)));
  pg.types.setTypeParser(1700, (v) => (v == null ? null : Number(v)));
  const { Pool } = pg;
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

function currentTenantId() {
  const store = tenantStore.getStore();
  if (!store || store.tenantId == null) return SYSTEM_TENANT_SENTINEL;
  const id = Number(store.tenantId);
  if (!Number.isFinite(id)) return SYSTEM_TENANT_SENTINEL;
  return id;
}

async function setTenantOnClient(client, tenantId) {
  // Embed tenantId directly in the SQL string. SET LOCAL does not accept
  // parameter placeholders, but we always pass an integer (validated by
  // currentTenantId / runWithTenant) so this is safe from injection.
  const safe = Number(tenantId) | 0;
  await client.query(`SET LOCAL app.current_tenant = '${safe}'`);
}

async function query(sql, params = []) {
  const pool = getPool();
  const tenantId = currentTenantId();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setTenantOnClient(client, tenantId);
    const result = await client.query(sql, params);
    await client.query('COMMIT');
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
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

async function tx(fn) {
  const pool = getPool();
  const tenantId = currentTenantId();
  const client = await pool.connect();
  const txQuery = async (sql, params = []) => {
    const result = await client.query(sql, params);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  };
  try {
    await client.query('BEGIN');
    await setTenantOnClient(client, tenantId);
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

function runWithTenant(tenantId, fn) {
  const id = Number(tenantId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error(`runWithTenant: invalid tenantId ${tenantId}`);
  }
  return tenantStore.run({ tenantId: id }, fn);
}

function runAsSystem(fn) {
  return tenantStore.run({ tenantId: SYSTEM_TENANT_SENTINEL }, fn);
}

function _resetForTests() {
  if (_pool) {
    _pool.end().catch(() => {
      /* ignore — best effort */
    });
    _pool = null;
  }
}

module.exports = {
  query,
  tx,
  runWithTenant,
  runAsSystem,
  _resetForTests,
  SYSTEM_TENANT_SENTINEL,
};
