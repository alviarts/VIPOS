/**
 * Async query layer (P2-01b).
 *
 * Single entry point for all DB access in route code. Goal: route handlers
 * use a uniform `await query(sql, params)` API regardless of underlying
 * driver, so we can migrate from better-sqlite3 → Postgres incrementally
 * without ripping out everything in one shot.
 *
 * DRIVER SELECTION (env `DATABASE_DRIVER`):
 *   - `sqlite` (default): backed by better-sqlite3. Sync internally,
 *     wrapped in resolved Promises so the call site can `await` cleanly.
 *     Used by tests + dev (no Postgres setup needed).
 *   - `postgres`: backed by `pg` Pool. Real async. Used in production
 *     against Supabase or any Postgres host. Driven by DATABASE_URL.
 *
 * SQL STYLE:
 *   - Write queries with `$1, $2, ...` numbered placeholders (Postgres
 *     native). The sqlite driver auto-translates to `?`.
 *   - Write `RETURNING id` for INSERTs that need the new id. Both drivers
 *     support it (SQLite >= 3.35; better-sqlite3 wraps modern SQLite).
 *   - Avoid `LIKE` for case-insensitive search; use lowercase comparison
 *     via the helper `iLikePattern()` if both drivers must agree.
 *
 * RETURN SHAPE (uniform across drivers):
 *   query(sql, params) -> Promise<{ rows: object[], rowCount: number }>
 *
 *   - SELECT: rows = result rows, rowCount = rows.length
 *   - INSERT/UPDATE/DELETE without RETURNING: rows = [], rowCount = changes
 *   - INSERT/UPDATE/DELETE with RETURNING: rows = returned rows, rowCount = rows.length
 *
 * TRANSACTIONS:
 *   tx(async (txQuery) => { ... }) wraps work in BEGIN/COMMIT (or sqlite
 *   transaction). The callback receives a tx-bound `query` function.
 *
 * MIGRATION PLAN (route cutover):
 *   1. (this PR step1) Build this module + migrate one route file as proof.
 *   2. (next PRs) Migrate remaining 48 files in domain batches.
 *   3. (final PR) Flip DATABASE_DRIVER=postgres in production. Drop
 *      better-sqlite3 dependency and `models/database.js` after all routes
 *      are off it.
 */

const DRIVER = (process.env.DATABASE_DRIVER || 'sqlite').toLowerCase();

let driverImpl;

function getDriver() {
  if (driverImpl) return driverImpl;
  if (DRIVER === 'postgres') {
    driverImpl = require('./driver-postgres');
  } else {
    driverImpl = require('./driver-sqlite');
  }
  return driverImpl;
}

/**
 * Run a query and return `{ rows, rowCount }`.
 *
 * @param {string} sql SQL with `$1, $2, ...` placeholders
 * @param {Array<unknown>} [params=[]] positional parameters
 * @returns {Promise<{ rows: Record<string, unknown>[], rowCount: number }>}
 */
async function query(sql, params = []) {
  return getDriver().query(sql, params);
}

/**
 * Run `fn` inside a transaction. The callback receives a tx-bound query
 * helper that uses the same connection / SQLite db handle.
 *
 * @template T
 * @param {(txQuery: typeof query) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function tx(fn) {
  return getDriver().tx(fn);
}

/**
 * Quote a string for `LIKE`/`ILIKE` patterns: escape `%` and `_`. Use this
 * when interpolating user input into a search pattern.
 */
function iLikePattern(value) {
  return String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Reset internal driver state (test-only).
 *
 * For the sqlite driver this re-opens the DB against (possibly new)
 * VIPOS_DB_PATH. For postgres, ends the pool — call before tests that
 * intentionally tear down the pool.
 */
function _resetForTests() {
  if (driverImpl && typeof driverImpl._resetForTests === 'function') {
    driverImpl._resetForTests();
  }
  driverImpl = null;
}

module.exports = {
  query,
  tx,
  iLikePattern,
  _resetForTests,
  driverName: DRIVER,
};
