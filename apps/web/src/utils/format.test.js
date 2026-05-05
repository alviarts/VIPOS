import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from './format';

describe('formatCurrency (IDR)', () => {
  it('formats integer amount as Rp tanpa decimal', () => {
    const out = formatCurrency(15000);
    expect(out).toMatch(/Rp/);
    // hilangkan non-digit (Intl pakai non-breaking space + dot)
    const digits = out.replace(/\D/g, '');
    expect(digits).toBe('15000');
  });

  it('handles 0', () => {
    expect(formatCurrency(0)).toMatch(/Rp/);
  });

  it('rounds toward integer', () => {
    const out = formatCurrency(1234.56);
    const digits = out.replace(/\D/g, '');
    // Intl id-ID rounds 1234.56 -> 1235
    expect(['1234', '1235']).toContain(digits);
  });
});

describe('formatNumber (id-ID)', () => {
  it('inserts thousands separator', () => {
    const out = formatNumber(1000000);
    expect(out).toMatch(/^1[.\u00A0\s]?000[.\u00A0\s]?000$/);
  });
});

describe('formatDateTime (Asia/Jakarta / WIB)', () => {
  // Anchor on a UTC instant where the corresponding WIB wall-clock crosses
  // into the next day, so we can prove the TZ conversion is happening.
  const utcMidnight = '2026-05-05T17:30:00.000Z'; // 00:30 next day in WIB

  it('renders timezone suffix as WIB', () => {
    const out = formatDateTime(utcMidnight);
    expect(out).toMatch(/WIB/);
  });

  it('renders the day shifted to WIB (UTC 17:30 -> next-day 00:30 WIB)', () => {
    const out = formatDateTime(utcMidnight);
    expect(out).toMatch(/06 Mei 2026/);
    expect(out).toMatch(/00\.30/);
  });
});

describe('formatDate (Asia/Jakarta)', () => {
  it('shifts midnight UTC instants to the matching WIB calendar day', () => {
    // 2026-05-05T17:30Z -> 2026-05-06 in WIB
    const out = formatDate('2026-05-05T17:30:00.000Z');
    expect(out).toMatch(/06 Mei 2026/);
  });
});
