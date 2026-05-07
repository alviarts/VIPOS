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

function isKnownPaymentMethodCode(code) {
  return typeof code === 'string' && KNOWN_PAYMENT_METHOD_CODES.has(code);
}

// List the allow-list deterministically (legacy first, then canonical) so
// the 400 response body reads naturally from the kasir's POV (the
// lowercase codes they already use, then the new canonical ones).
function listKnownPaymentMethodCodes() {
  return [...LEGACY_LOWERCASE_CODES, ...ANDROID_CANONICAL_CODES];
}

module.exports = {
  KNOWN_PAYMENT_METHOD_CODES,
  LEGACY_LOWERCASE_CODES,
  ANDROID_CANONICAL_CODES,
  isKnownPaymentMethodCode,
  listKnownPaymentMethodCodes,
};
