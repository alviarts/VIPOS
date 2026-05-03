import { describe, expect, it } from 'vitest';
import {
  CashTransactionCreateSchema,
  CategoryCreateSchema,
  CustomerCreateSchema,
  InventoryMovementCreateSchema,
  LoginRequestSchema,
  ProductCreateSchema,
  ProductUpdateSchema,
  generateOpenApiDocument,
} from '../index';

describe('LoginRequestSchema', () => {
  it('accepts valid login', () => {
    const r = LoginRequestSchema.safeParse({ username: 'admin', password: 'admin123' });
    expect(r.success).toBe(true);
  });

  it('rejects empty username', () => {
    const r = LoginRequestSchema.safeParse({ username: '', password: 'admin123' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['username']);
      expect(r.error.issues[0].message).toMatch(/wajib/i);
    }
  });

  it('rejects missing password', () => {
    const r = LoginRequestSchema.safeParse({ username: 'admin' });
    expect(r.success).toBe(false);
  });
});

describe('ProductCreateSchema', () => {
  it('coerces string price to number', () => {
    const r = ProductCreateSchema.safeParse({
      name: 'Test',
      sku: 'X-1',
      price: '15000',
      harga_modal: '10000',
      stock: '5',
      is_favorit: 'true',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.price).toBe(15000);
      expect(r.data.harga_modal).toBe(10000);
      expect(r.data.stock).toBe(5);
      expect(r.data.is_favorit).toBe(1);
    }
  });

  it('rejects when name missing', () => {
    const r = ProductCreateSchema.safeParse({ sku: 'X-1', price: 100 });
    expect(r.success).toBe(false);
  });

  it('rejects negative price', () => {
    const r = ProductCreateSchema.safeParse({ name: 'X', sku: 'X-1', price: -100 });
    expect(r.success).toBe(false);
  });

  it('coerces "" empty string to null for optional numeric', () => {
    const r = ProductCreateSchema.safeParse({
      name: 'Test',
      sku: 'X-1',
      price: 1000,
      harga_modal: '',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.harga_modal).toBeNull();
  });
});

describe('ProductUpdateSchema (partial)', () => {
  it('accepts partial update with just name', () => {
    const r = ProductUpdateSchema.safeParse({ name: 'New name' });
    expect(r.success).toBe(true);
  });

  it('still validates types when fields present', () => {
    const r = ProductUpdateSchema.safeParse({ price: -1 });
    expect(r.success).toBe(false);
  });
});

describe('CategoryCreateSchema', () => {
  it('accepts minimal payload', () => {
    const r = CategoryCreateSchema.safeParse({ name: 'Makanan' });
    expect(r.success).toBe(true);
  });

  it('rejects empty name', () => {
    const r = CategoryCreateSchema.safeParse({ name: '' });
    expect(r.success).toBe(false);
  });
});

describe('CustomerCreateSchema', () => {
  it('accepts valid customer', () => {
    const r = CustomerCreateSchema.safeParse({ name: 'Budi', phone: '08123' });
    expect(r.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const r = CustomerCreateSchema.safeParse({ name: 'Budi', email: 'not-an-email' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid gender', () => {
    const r = CustomerCreateSchema.safeParse({ name: 'Budi', gender: 'X' });
    expect(r.success).toBe(false);
  });
});

describe('CashTransactionCreateSchema', () => {
  it('accepts pemasukan with positive jumlah', () => {
    const r = CashTransactionCreateSchema.safeParse({
      tipe: 'pemasukan',
      account_id: 1,
      jumlah: 50000,
    });
    expect(r.success).toBe(true);
  });

  it('rejects zero jumlah', () => {
    const r = CashTransactionCreateSchema.safeParse({
      tipe: 'pemasukan',
      account_id: 1,
      jumlah: 0,
    });
    expect(r.success).toBe(false);
  });

  it('requires account_to_id when tipe=transfer', () => {
    const r = CashTransactionCreateSchema.safeParse({
      tipe: 'transfer',
      account_id: 1,
      jumlah: 1000,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('account_to_id'))).toBe(true);
    }
  });

  it('accepts transfer with account_to_id', () => {
    const r = CashTransactionCreateSchema.safeParse({
      tipe: 'transfer',
      account_id: 1,
      account_to_id: 2,
      jumlah: 1000,
    });
    expect(r.success).toBe(true);
  });
});

describe('InventoryMovementCreateSchema', () => {
  it('accepts stok_in with positive qty', () => {
    const r = InventoryMovementCreateSchema.safeParse({
      product_id: 1,
      tipe: 'stok_in',
      qty: 5,
    });
    expect(r.success).toBe(true);
  });

  it('accepts opname with qty=0', () => {
    const r = InventoryMovementCreateSchema.safeParse({
      product_id: 1,
      tipe: 'opname',
      qty: 0,
    });
    expect(r.success).toBe(true);
  });

  it('rejects negative qty', () => {
    const r = InventoryMovementCreateSchema.safeParse({
      product_id: 1,
      tipe: 'stok_in',
      qty: -3,
    });
    expect(r.success).toBe(false);
  });

  it('rejects unknown tipe', () => {
    const r = InventoryMovementCreateSchema.safeParse({
      product_id: 1,
      tipe: 'invalid',
      qty: 1,
    });
    expect(r.success).toBe(false);
  });
});

describe('OpenAPI generation', () => {
  it('generates valid OpenAPI 3.1 document', () => {
    const doc = generateOpenApiDocument({ title: 'Test API', version: '1.0.0', serverUrl: '/' });
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('Test API');
    expect(Object.keys(doc.paths || {}).length).toBeGreaterThan(0);
  });

  it('exposes /api/auth/login path', () => {
    const doc = generateOpenApiDocument();
    expect(doc.paths?.['/api/auth/login']).toBeDefined();
    expect(doc.paths?.['/api/auth/login']?.post).toBeDefined();
  });

  it('exposes components.schemas', () => {
    const doc = generateOpenApiDocument();
    const schemas = doc.components?.schemas as Record<string, unknown> | undefined;
    expect(schemas).toBeDefined();
    expect(schemas?.LoginRequest).toBeDefined();
    expect(schemas?.ProductCreateRequest).toBeDefined();
  });
});
