/**
 * Smoke test: pastikan apps/web bisa import @vipos/shared schemas. Ini bukti
 * bahwa workspace dependency wiring + TypeScript build dari packages/shared
 * berfungsi end-to-end untuk consumer web.
 */
import { describe, expect, it } from 'vitest';
import { LoginRequestSchema, ProductCreateSchema } from '@vipos/shared';

describe('@vipos/shared (web consumer)', () => {
  it('LoginRequestSchema accepts valid input', () => {
    const r = LoginRequestSchema.safeParse({ username: 'admin', password: 'admin123' });
    expect(r.success).toBe(true);
  });

  it('LoginRequestSchema rejects empty username', () => {
    const r = LoginRequestSchema.safeParse({ username: '', password: 'x' });
    expect(r.success).toBe(false);
  });

  it('ProductCreateSchema rejects negative price (defensive client check)', () => {
    const r = ProductCreateSchema.safeParse({
      name: 'X',
      sku: 'X-1',
      price: -1,
    });
    expect(r.success).toBe(false);
  });
});
