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
