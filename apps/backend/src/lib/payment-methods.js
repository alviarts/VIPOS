// Allow-list for `transactions.payment_method` values.
//
// The DB column is a free-text VARCHAR (no CHECK constraint, no Postgres
// ENUM type). Until we migrate to a dedicated enum we keep the allow-list
// at the application layer so a typo / forged client can't write a value
// nobody else recognises.
//
// The set is the *union* of two contracts that currently both write into
// the column:
//
//   1. Legacy lowercase codes from `apps/web/src/pages/CashierPage.jsx`:
//      `cash`, `card`, `qris`. The web kasir has been in production since
//      day one writing these literals; the cashflow report
//      (`apps/backend/src/routes/reports.js` cashflow_summary) and the
//      DashboardPage / TransactionsPage / SalesReportsPage also pivot
//      on these literals. Removing them would break existing data.
//
//   2. Canonical uppercase codes from the Android `PaymentMethod` enum
//      (`apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/
//      pos/domain/PaymentMethod.kt`). The Android kasir is shipping in
//      P3-08 and writes these codes to the same column.
//
// When the web client is migrated to canonical codes (separate PR), the
// legacy entries can be removed and the column upgraded to a Postgres
// ENUM via a Prisma migration. Until then this list is the source of
// truth that both clients have to satisfy.

const LEGACY_LOWERCASE_CODES = Object.freeze(['cash', 'card', 'qris']);

// Mirror of the Android `PaymentMethod` enum `code` column. Any future
// addition to that enum MUST also be added here before merge — the
// enum's KDoc explicitly calls this contract out.
const ANDROID_CANONICAL_CODES = Object.freeze([
  'CASH',
  'EDC',
  'QRIS_STATIC',
  'QRIS_DYNAMIC',
  'GOPAY',
  'OVO',
  'DANA',
  'SHOPEEPAY',
  'LINKAJA',
  'BANK_TRANSFER',
  'CREDIT',
  'DEPOSIT',
  'VOUCHER',
  'LOYALTY_POINT',
  'OTHER',
]);

const KNOWN_PAYMENT_METHOD_CODES = Object.freeze(
  new Set([...LEGACY_LOWERCASE_CODES, ...ANDROID_CANONICAL_CODES])
);

// Map each legacy lowercase code to its canonical Android equivalent.
// Used when aggregating `payment_method` so a row that was written
// before PR #236 (lowercase) merges into the same group as the matching
// canonical Android code (PR #232 / #236) — otherwise the dashboard
// pie chart would show "Tunai" twice (one slice for `cash`, another
// for `CASH`) until the lowercase rows are migrated. Mirrors the
// `WIRE_CODE_FROM_UI_ID` map in `apps/web/src/utils/paymentMethod.js`.
const LEGACY_TO_CANONICAL = Object.freeze({
  cash: 'CASH',
  card: 'EDC',
  qris: 'QRIS_STATIC',
});

function isKnownPaymentMethodCode(code) {
  return typeof code === 'string' && KNOWN_PAYMENT_METHOD_CODES.has(code);
}

// List the allow-list deterministically (legacy first, then canonical) so
// the 400 response body reads naturally from the kasir's POV (the
// lowercase codes they already use, then the new canonical ones).
function listKnownPaymentMethodCodes() {
  return [...LEGACY_LOWERCASE_CODES, ...ANDROID_CANONICAL_CODES];
}

// Normalise a `payment_method` value to its canonical Android code.
// Legacy lowercase codes are mapped to their canonical equivalent; any
// other input (canonical codes, unknown strings, non-strings) is
// returned verbatim. The kasir, dashboard, and reports use this so a
// transactions table that holds a mix of legacy + canonical codes
// still aggregates / filters as if it spoke a single vocabulary.
function canonicalizePaymentMethod(code) {
  if (typeof code !== 'string') return code;
  return LEGACY_TO_CANONICAL[code] ?? code;
}

// SQL fragment that normalises a `payment_method` column to its
// canonical Android code. Use as `${canonicalPaymentMethodSql('t.payment_method')}`
// inside a SELECT or GROUP BY so a `cash`/`CASH` mix in the DB rolls
// up into a single canonical bucket. Wraps the column in `LOWER(...)`
// so the legacy match is case-insensitive on the LHS — every other
// canonical code falls through to the ELSE branch unchanged.
//
// Keep this in sync with `LEGACY_TO_CANONICAL` above. The unit tests
// in `payment-methods.test.mjs` (and the integration test in
// `__tests__/dashboard-payment-methods-canonicalization.test.mjs`)
// pin the contract so a future legacy-code addition fails loud if
// either side drifts.
function canonicalPaymentMethodSql(column) {
  return `CASE LOWER(${column})
    WHEN 'cash' THEN 'CASH'
    WHEN 'card' THEN 'EDC'
    WHEN 'qris' THEN 'QRIS_STATIC'
    ELSE ${column}
  END`;
}

module.exports = {
  KNOWN_PAYMENT_METHOD_CODES,
  LEGACY_LOWERCASE_CODES,
  ANDROID_CANONICAL_CODES,
  LEGACY_TO_CANONICAL,
  isKnownPaymentMethodCode,
  listKnownPaymentMethodCodes,
  canonicalizePaymentMethod,
  canonicalPaymentMethodSql,
};
