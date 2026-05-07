import { describe, it, expect } from 'vitest';
import paymentMethods from './payment-methods.js';

const {
  KNOWN_PAYMENT_METHOD_CODES,
  LEGACY_LOWERCASE_CODES,
  ANDROID_CANONICAL_CODES,
  isKnownPaymentMethodCode,
  listKnownPaymentMethodCodes,
} = paymentMethods;

describe('payment-methods allow-list', () => {
  it('contains every legacy lowercase code currently used by the web kasir', () => {
    for (const code of ['cash', 'card', 'qris']) {
      expect(LEGACY_LOWERCASE_CODES).toContain(code);
      expect(isKnownPaymentMethodCode(code)).toBe(true);
    }
  });

  it('contains every canonical Android PaymentMethod enum code', () => {
    // Mirrors apps/android/feature/pos/src/main/java/id/alviarts/vipos/
    // feature/pos/domain/PaymentMethod.kt verbatim. If this list drifts
    // the kasir will get a 400 on commit, so the test fails loud.
    const expected = [
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
    ];
    expect(ANDROID_CANONICAL_CODES).toEqual(expected);
    for (const code of expected) {
      expect(isKnownPaymentMethodCode(code)).toBe(true);
    }
  });

  it('rejects unknown / typo codes', () => {
    expect(isKnownPaymentMethodCode('crypto')).toBe(false);
    expect(isKnownPaymentMethodCode('Cash')).toBe(false); // case-sensitive
    expect(isKnownPaymentMethodCode('cash ')).toBe(false); // no trim
    expect(isKnownPaymentMethodCode('')).toBe(false);
  });

  it('rejects non-string inputs without throwing', () => {
    expect(isKnownPaymentMethodCode(undefined)).toBe(false);
    expect(isKnownPaymentMethodCode(null)).toBe(false);
    expect(isKnownPaymentMethodCode(0)).toBe(false);
    expect(isKnownPaymentMethodCode(['cash'])).toBe(false);
    expect(isKnownPaymentMethodCode({ code: 'cash' })).toBe(false);
  });

  it('exposes the union via KNOWN_PAYMENT_METHOD_CODES', () => {
    expect(KNOWN_PAYMENT_METHOD_CODES).toBeInstanceOf(Set);
    expect(KNOWN_PAYMENT_METHOD_CODES.size).toBe(
      LEGACY_LOWERCASE_CODES.length + ANDROID_CANONICAL_CODES.length
    );
    expect(Object.isFrozen(KNOWN_PAYMENT_METHOD_CODES)).toBe(true);
  });

  it('listKnownPaymentMethodCodes returns legacy first, then canonical', () => {
    const list = listKnownPaymentMethodCodes();
    expect(list.slice(0, LEGACY_LOWERCASE_CODES.length)).toEqual([...LEGACY_LOWERCASE_CODES]);
    expect(list.slice(LEGACY_LOWERCASE_CODES.length)).toEqual([...ANDROID_CANONICAL_CODES]);
  });
});

// Defensive invariants — guard against silent drift from a future refactor
// that removes `Object.freeze` on the exported tables, or that swaps
// `listKnownPaymentMethodCodes()` for a memoised reference. Both classes
// of regression would let a misbehaving caller corrupt the kasir's 400
// response body or the in-memory allow-list at runtime.
describe('payment-methods immutability invariants', () => {
  it('LEGACY_LOWERCASE_CODES rejects push / index assignment / length mutation', () => {
    expect(Object.isFrozen(LEGACY_LOWERCASE_CODES)).toBe(true);
    expect(() => LEGACY_LOWERCASE_CODES.push('cryptobux')).toThrow(TypeError);
    expect(() => {
      LEGACY_LOWERCASE_CODES[0] = 'mutated';
    }).toThrow(TypeError);
    expect(() => {
      LEGACY_LOWERCASE_CODES.length = 0;
    }).toThrow(TypeError);
    expect(LEGACY_LOWERCASE_CODES).toEqual(['cash', 'card', 'qris']);
  });

  it('ANDROID_CANONICAL_CODES rejects push / index assignment / length mutation', () => {
    expect(Object.isFrozen(ANDROID_CANONICAL_CODES)).toBe(true);
    expect(() => ANDROID_CANONICAL_CODES.push('SHADYCOIN')).toThrow(TypeError);
    expect(() => {
      ANDROID_CANONICAL_CODES[0] = 'mutated';
    }).toThrow(TypeError);
    expect(() => {
      ANDROID_CANONICAL_CODES.length = 0;
    }).toThrow(TypeError);
    expect(ANDROID_CANONICAL_CODES.length).toBe(15);
  });

  it('KNOWN_PAYMENT_METHOD_CODES rejects new own properties', () => {
    expect(Object.isFrozen(KNOWN_PAYMENT_METHOD_CODES)).toBe(true);
    expect(() => {
      KNOWN_PAYMENT_METHOD_CODES.foo = 'bar';
    }).toThrow(TypeError);
  });
});

describe('listKnownPaymentMethodCodes() iteration ordering', () => {
  // Hardcoded expected sequence — locks the contract that the kasir's
  // 400 response body uses (legacy lowercase first, then the Android
  // canonical enum in `PaymentMethod.kt` declaration order).
  const EXPECTED_ORDER = [
    'cash',
    'card',
    'qris',
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
  ];

  it('iterates via for...of in the legacy-then-canonical declaration order', () => {
    const actual = [];
    for (const code of listKnownPaymentMethodCodes()) {
      actual.push(code);
    }
    expect(actual).toEqual(EXPECTED_ORDER);
  });

  it('iterates via spread in the same legacy-then-canonical order', () => {
    expect([...listKnownPaymentMethodCodes()]).toEqual(EXPECTED_ORDER);
  });

  it('returns a fresh array on every call — caller mutations cannot leak', () => {
    const a = listKnownPaymentMethodCodes();
    const b = listKnownPaymentMethodCodes();
    expect(a).not.toBe(b);
    a.push('mutated-by-caller');
    a[0] = 'CORRUPTED';
    const c = listKnownPaymentMethodCodes();
    expect(c).toEqual(b);
    expect(c).not.toContain('mutated-by-caller');
    expect(c[0]).toBe('cash');
  });

  it('contains no duplicate codes across the legacy + canonical union', () => {
    const list = listKnownPaymentMethodCodes();
    expect(list.length).toBe(LEGACY_LOWERCASE_CODES.length + ANDROID_CANONICAL_CODES.length);
    expect(new Set(list).size).toBe(list.length);
  });
});
