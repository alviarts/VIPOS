import { describe, expect, it } from 'vitest';
import { formatCurrency, formatNumber } from './format';

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
