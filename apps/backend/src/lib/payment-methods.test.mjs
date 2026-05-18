import { describe, it, expect } from 'vitest';
import paymentMethods from './payment-methods.js';

const {
  KNOWN_PAYMENT_METHOD_CODES,
  LEGACY_LOWERCASE_CODES,
  ANDROID_CANONICAL_CODES,
  LEGACY_TO_CANONICAL,
  isKnownPaymentMethodCode,
  listKnownPaymentMethodCodes,
  canonicalizePaymentMethod,
  canonicalPaymentMethodSql,
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

// `LEGACY_TO_CANONICAL` + `canonicalizePaymentMethod()` + `canonicalPaymentMethodSql()`
// drive the dashboard / reports aggregation fix that merges legacy `cash`/
// `card`/`qris` rows into the canonical `CASH`/`EDC`/`QRIS_STATIC` buckets.
// These tests pin the contract so a future legacy-code addition fails loud
// if any of the three sides drifts.
describe('LEGACY_TO_CANONICAL map', () => {
  it('covers every legacy lowercase code with a canonical Android equivalent', () => {
    for (const legacy of LEGACY_LOWERCASE_CODES) {
      expect(typeof LEGACY_TO_CANONICAL[legacy]).toBe('string');
      expect(ANDROID_CANONICAL_CODES).toContain(LEGACY_TO_CANONICAL[legacy]);
    }
  });

  it('matches the kasir UI translation table verbatim', () => {
    expect(LEGACY_TO_CANONICAL).toEqual({
      cash: 'CASH',
      card: 'EDC',
      qris: 'QRIS_STATIC',
    });
  });

  it('is frozen so a stray runtime mutation cannot corrupt aggregations', () => {
    expect(Object.isFrozen(LEGACY_TO_CANONICAL)).toBe(true);
    expect(() => {
      LEGACY_TO_CANONICAL.bitcoin = 'BITCOIN';
    }).toThrow(TypeError);
    expect(() => {
      LEGACY_TO_CANONICAL.cash = 'mutated';
    }).toThrow(TypeError);
  });
});

describe('canonicalizePaymentMethod()', () => {
  it('maps each legacy lowercase code to its canonical Android equivalent', () => {
    expect(canonicalizePaymentMethod('cash')).toBe('CASH');
    expect(canonicalizePaymentMethod('card')).toBe('EDC');
    expect(canonicalizePaymentMethod('qris')).toBe('QRIS_STATIC');
  });

  it('returns canonical codes verbatim (idempotent)', () => {
    for (const code of ANDROID_CANONICAL_CODES) {
      expect(canonicalizePaymentMethod(code)).toBe(code);
    }
  });

  it('returns unknown strings verbatim — no implicit normalisation', () => {
    expect(canonicalizePaymentMethod('Cash')).toBe('Cash'); // case-sensitive, no fold
    expect(canonicalizePaymentMethod('CASH ')).toBe('CASH '); // no trim
    expect(canonicalizePaymentMethod('bitcoin')).toBe('bitcoin');
    expect(canonicalizePaymentMethod('')).toBe('');
  });

  it('returns non-string inputs verbatim without throwing', () => {
    expect(canonicalizePaymentMethod(undefined)).toBe(undefined);
    expect(canonicalizePaymentMethod(null)).toBe(null);
    expect(canonicalizePaymentMethod(42)).toBe(42);
    const obj = { code: 'cash' };
    expect(canonicalizePaymentMethod(obj)).toBe(obj);
  });
});

describe('canonicalPaymentMethodSql()', () => {
  it('emits a CASE expression keyed off LOWER(column) covering every legacy code', () => {
    const sql = canonicalPaymentMethodSql('t.payment_method');
    // The fragment is interpolated via template literal in the routes,
    // so it MUST use the exact column reference the caller passed in.
    expect(sql).toContain('LOWER(t.payment_method)');
    expect(sql).toContain("WHEN 'cash' THEN 'CASH'");
    expect(sql).toContain("WHEN 'card' THEN 'EDC'");
    expect(sql).toContain("WHEN 'qris' THEN 'QRIS_STATIC'");
    // The ELSE branch falls through to the raw column so canonical
    // codes (CASH, EDC, ...) and any unknown future code are returned
    // verbatim — never silently rewritten.
    expect(sql).toContain('ELSE t.payment_method');
    expect(sql).toMatch(/CASE/);
    expect(sql).toMatch(/END\s*$/);
  });

  it('honours the column reference verbatim — no shadowing, no quoting', () => {
    expect(canonicalPaymentMethodSql('payment_method')).toContain('LOWER(payment_method)');
    expect(canonicalPaymentMethodSql('t.payment_method')).toContain('LOWER(t.payment_method)');
    // Aliased table prefixes are passed through untouched so a
    // multi-table join can disambiguate (e.g. `t.payment_method` vs
    // `o.payment_method` for an orders join).
    expect(canonicalPaymentMethodSql('o.payment_method')).toContain('LOWER(o.payment_method)');
  });

  it('covers every entry in LEGACY_TO_CANONICAL — no map drift', () => {
    // Defensive guard: if a future PR adds `gopay -> GOPAY` to
    // LEGACY_TO_CANONICAL but forgets to extend the SQL, this fails.
    const sql = canonicalPaymentMethodSql('payment_method');
    for (const [legacy, canonical] of Object.entries(LEGACY_TO_CANONICAL)) {
      expect(sql).toContain(`WHEN '${legacy}' THEN '${canonical}'`);
    }
  });
});
