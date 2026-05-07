// VIPOS — payment method canonical wire codes + display labels.
//
// Pairs with backend PR #232 (`apps/backend/src/lib/payment-methods.js`)
// and Android `PaymentMethod.kt`. The web kasir submits the canonical
// uppercase code (e.g. `CASH`, `EDC`, `QRIS_STATIC`) so the entire
// stack — Android, web kasir, backend, reports — speaks the same
// vocabulary. Legacy lowercase codes (`cash`, `card`, `qris`) are
// preserved in the display map so transactions saved before this
// migration still render with friendly Indonesian labels in the
// transactions list / receipts.

// UI id -> canonical wire code. The kasir UI state uses lowercase ids
// (so the existing cash-only branches `paymentMethod === 'cash'` keep
// working), but we translate to canonical at submit time. Adding a new
// kasir button just means adding a row here + a row in the methods
// array on `CashierPage.jsx`.
export const WIRE_CODE_FROM_UI_ID = Object.freeze({
  cash: 'CASH',
  card: 'EDC',
  qris: 'QRIS_STATIC',
});

// Display map for both legacy lowercase (rows saved before the
// migration) and canonical Android codes. Matches the Indonesian
// labels used by the kasir buttons + Android `PaymentMethod.kt`'s
// `displayName` resource so the UX is consistent.
const PAYMENT_METHOD_LABELS = Object.freeze({
  // Legacy lowercase (pre-#232 transactions).
  cash: 'Tunai',
  card: 'Kartu',
  qris: 'QRIS',
  // Canonical Android codes.
  CASH: 'Tunai',
  EDC: 'EDC',
  QRIS_STATIC: 'QRIS',
  QRIS_DYNAMIC: 'QRIS Dinamis',
  GOPAY: 'GoPay',
  OVO: 'OVO',
  DANA: 'DANA',
  SHOPEEPAY: 'ShopeePay',
  LINKAJA: 'LinkAja',
  BANK_TRANSFER: 'Transfer Bank',
  CREDIT: 'Kredit',
  DEPOSIT: 'Deposit',
  VOUCHER: 'Voucher',
  LOYALTY_POINT: 'Poin Loyalti',
  OTHER: 'Lainnya',
});

// Translate a kasir UI id to the canonical wire code. Falls back to
// the input verbatim so a future code passed through unchanged still
// reaches the backend (where the allow-list will reject anything
// unknown — see `lib/payment-methods.js`).
export function toWireCode(uiId) {
  if (typeof uiId !== 'string') return uiId;
  return WIRE_CODE_FROM_UI_ID[uiId] ?? uiId;
}

// Format any payment method code (legacy or canonical) for display.
// Falls back to the raw code if unknown so the UI never shows blank
// or `undefined` — the kasir always knows what was used to settle a
// transaction even if a future enum entry hasn't been added here.
export function formatPaymentMethodLabel(code) {
  if (typeof code !== 'string' || code.length === 0) return '—';
  return PAYMENT_METHOD_LABELS[code] ?? code;
}
