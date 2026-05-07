import { describe, it, expect } from 'vitest';
import { WIRE_CODE_FROM_UI_ID, toWireCode, formatPaymentMethodLabel } from '../utils/paymentMethod';

describe('WIRE_CODE_FROM_UI_ID', () => {
  it('maps the 3 kasir UI ids to canonical Android wire codes', () => {
    expect(WIRE_CODE_FROM_UI_ID).toEqual({
      cash: 'CASH',
      card: 'EDC',
      qris: 'QRIS_STATIC',
    });
  });

  it('is frozen so callers cannot mutate the contract at runtime', () => {
    expect(Object.isFrozen(WIRE_CODE_FROM_UI_ID)).toBe(true);
  });
});

describe('toWireCode', () => {
  it.each([
    ['cash', 'CASH'],
    ['card', 'EDC'],
    ['qris', 'QRIS_STATIC'],
  ])('translates UI id "%s" -> canonical "%s"', (input, expected) => {
    expect(toWireCode(input)).toBe(expected);
  });

  it('passes already-canonical codes through verbatim', () => {
    expect(toWireCode('CASH')).toBe('CASH');
    expect(toWireCode('GOPAY')).toBe('GOPAY');
    expect(toWireCode('LOYALTY_POINT')).toBe('LOYALTY_POINT');
  });

  it('passes unknown codes through verbatim (backend allow-list rejects)', () => {
    expect(toWireCode('foo')).toBe('foo');
    expect(toWireCode('BITCOIN')).toBe('BITCOIN');
    expect(toWireCode('')).toBe('');
  });

  it('returns non-strings unchanged so backend typeof guard fires', () => {
    expect(toWireCode(undefined)).toBeUndefined();
    expect(toWireCode(null)).toBeNull();
    expect(toWireCode(42)).toBe(42);
  });
});

describe('formatPaymentMethodLabel', () => {
  it.each([
    ['cash', 'Tunai'],
    ['card', 'Kartu'],
    ['qris', 'QRIS'],
  ])('renders legacy lowercase "%s" as Indonesian "%s" (back-compat)', (input, expected) => {
    expect(formatPaymentMethodLabel(input)).toBe(expected);
  });

  it.each([
    ['CASH', 'Tunai'],
    ['EDC', 'EDC'],
    ['QRIS_STATIC', 'QRIS'],
    ['QRIS_DYNAMIC', 'QRIS Dinamis'],
    ['GOPAY', 'GoPay'],
    ['OVO', 'OVO'],
    ['DANA', 'DANA'],
    ['SHOPEEPAY', 'ShopeePay'],
    ['LINKAJA', 'LinkAja'],
    ['BANK_TRANSFER', 'Transfer Bank'],
    ['CREDIT', 'Kredit'],
    ['DEPOSIT', 'Deposit'],
    ['VOUCHER', 'Voucher'],
    ['LOYALTY_POINT', 'Poin Loyalti'],
    ['OTHER', 'Lainnya'],
  ])('renders canonical "%s" as Indonesian "%s"', (input, expected) => {
    expect(formatPaymentMethodLabel(input)).toBe(expected);
  });

  it('falls back to the raw code for unknown values', () => {
    expect(formatPaymentMethodLabel('BITCOIN')).toBe('BITCOIN');
    expect(formatPaymentMethodLabel('foo')).toBe('foo');
  });

  it('returns em-dash for nullish / non-string / empty input', () => {
    expect(formatPaymentMethodLabel(undefined)).toBe('—');
    expect(formatPaymentMethodLabel(null)).toBe('—');
    expect(formatPaymentMethodLabel('')).toBe('—');
    expect(formatPaymentMethodLabel(42)).toBe('—');
  });
});
