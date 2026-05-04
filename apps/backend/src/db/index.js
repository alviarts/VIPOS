/**
 * Async query layer (P2-01b finalstep — Postgres-only).
 *
 * Single entry point for all DB access in route code. After P2-01b cutover,
 * the backend speaks Postgres natively via `pg` Pool — the legacy SQLite
 * driver and `models/database.js` are gone.
 *
 * SQL STYLE:
 *   - Write queries with `$1, $2, ...` numbered placeholders (Postgres
 *     native).
 *   - Use `RETURNING ...` to recover generated ids on INSERT.
 *   - Use `ILIKE` (or `LOWER(col) LIKE LOWER($1)`) for case-insensitive
 *     search; quote user-supplied patterns via `iLikePattern()`.
 *
 * RETURN SHAPE:
 *   query(sql, params) -> Promise<{ rows: object[], rowCount: number }>
 *
 *   - SELECT: rows = result rows, rowCount = rows.length
 *   - INSERT/UPDATE/DELETE without RETURNING: rows = [], rowCount = changes
 *   - INSERT/UPDATE/DELETE with RETURNING: rows = returned rows
 *
 * TRANSACTIONS:
 *   tx(async (txQuery) => { ... }) wraps work in BEGIN/COMMIT and rolls
 *   back on error. The callback receives a tx-bound `query` function.
 */

const driverImpl = require('./driver-postgres');

/**
 * Run a query and return `{ rows, rowCount }`.
 *
 * @param {string} sql SQL with `$1, $2, ...` placeholders
 * @param {Array<unknown>} [params=[]] positional parameters
 * @returns {Promise<{ rows: Record<string, unknown>[], rowCount: number }>}
 */
async function query(sql, params = []) {
  return driverImpl.query(sql, params);
}

/**
 * Run `fn` inside a transaction. The callback receives a tx-bound query
 * helper that uses the same client connection.
 *
 * @template T
 * @param {(txQuery: typeof query) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function tx(fn) {
  return driverImpl.tx(fn);
}

/**
 * Quote a string for `LIKE`/`ILIKE` patterns: escape `%`, `_`, and `\`.
 * Use this when interpolating user input into a search pattern.
 */
function iLikePattern(value) {
  return String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Reset internal driver state (test-only). Ends the pool so the next call
 * re-opens it. Tests typically share the pool across files; only call
 * this on full process exit.
 */
function _resetForTests() {
  if (driverImpl && typeof driverImpl._resetForTests === 'function') {
    driverImpl._resetForTests();
  }
}

module.exports = {
  query,
  tx,
  iLikePattern,
  _resetForTests,
  driverName: 'postgres',
};
