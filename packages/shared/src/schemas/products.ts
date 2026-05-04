// Schema untuk endpoint /api/v1/products/*

import { z, registry } from '../openapi';
import { DateTimeStringSchema, ErrorResponseSchema, IdStringSchema } from './common';

export const ProductSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    sku: z.string(),
    barcode: z.string().nullable(),
    price: z.number(),
    harga_modal: z.number().default(0),
    harga_beli: z.number().default(0),
    stock: z.number().int(),
    satuan: z.string().default('pcs'),
    description: z.string().nullable(),
    category_id: z.number().int().nullable(),
    category_name: z.string().nullable().optional(),
    image_url: z.string().nullable(),
    is_active: z.union([z.literal(0), z.literal(1)]),
    is_tampil_di_menu: z.union([z.literal(0), z.literal(1)]),
    is_favorit: z.union([z.literal(0), z.literal(1)]),
    monitor_stok: z.union([z.literal(0), z.literal(1)]),
    stok_minimum: z.number().int().default(0),
    created_at: DateTimeStringSchema.optional(),
    updated_at: DateTimeStringSchema.optional(),
  })
  .openapi('Product');
export type Product = z.infer<typeof ProductSchema>;

// Helper: coerce number atau "" → number/null untuk form input.
const numFromForm = z.union([z.number(), z.string()]).transform((v, ctx) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (!Number.isFinite(n)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Bukan angka valid' });
    return z.NEVER;
  }
  return n;
});

const intFromForm = z.union([z.number(), z.string()]).transform((v, ctx) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'string' ? parseInt(v, 10) : Math.trunc(v);
  if (!Number.isFinite(n)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Bukan integer valid',
    });
    return z.NEVER;
  }
  return n;
});

// 0/1 dari form, default akan di-handle di backend (toBoolInt).
const boolIntFromForm = z
  .union([
    z.boolean(),
    z.literal(0),
    z.literal(1),
    z.literal('0'),
    z.literal('1'),
    z.literal('true'),
    z.literal('false'),
  ])
  .transform((v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0));

export const ProductCreateSchema = z
  .object({
    name: z.string().min(1, 'Nama produk wajib diisi').max(255),
    sku: z.string().min(1, 'SKU wajib diisi').max(64),
    barcode: z.string().max(64).optional().nullable(),
    description: z.string().max(2048).optional().nullable(),
    satuan: z.string().max(32).optional().default('pcs'),
    price: numFromForm.refine((v) => v !== null && v >= 0, {
      message: 'Harga jual wajib diisi dan >= 0',
    }),
    harga_modal: numFromForm.optional().nullable(),
    harga_beli: numFromForm.optional().nullable(),
    stock: intFromForm.optional().nullable(),
    category_id: intFromForm.optional().nullable(),
    image_url: z
      .string()
      .max(2048)
      .optional()
      .nullable()
      .or(z.literal('').transform(() => null)),
    image_urls: z.array(z.string().max(2048)).max(4).optional(),
    is_tampil_di_menu: boolIntFromForm.optional(),
    is_favorit: boolIntFromForm.optional(),
    monitor_stok: boolIntFromForm.optional(),
    stok_minimum: intFromForm.optional().nullable(),
    price_online: numFromForm.optional().nullable(),
    is_online_active: boolIntFromForm.optional(),
  })
  .openapi('ProductCreateRequest');
export type ProductCreate = z.infer<typeof ProductCreateSchema>;

export const ProductUpdateSchema = ProductCreateSchema.partial()
  .extend({
    is_active: boolIntFromForm.optional(),
  })
  .openapi('ProductUpdateRequest');
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>;

export const ProductListQuerySchema = z
  .object({
    category_id: z.coerce.number().int().positive().optional(),
    search: z.string().max(128).optional(),
    active_only: z
      .enum(['true', 'false'])
      .optional()
      .default('true')
      .openapi({ description: 'Default: true (cuma yang aktif).' }),
    is_tampil_di_menu: z.enum(['0', '1']).optional(),
  })
  .openapi('ProductListQuery');
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;

// --- OpenAPI path registrations -------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/v1/products',
  description: 'List produk dengan filter optional (kategori, search, aktif).',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  request: {
    query: ProductListQuerySchema,
  },
  responses: {
    200: {
      description: 'Array produk',
      content: { 'application/json': { schema: z.array(ProductSchema) } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/products/{id}',
  description: 'Detail produk by ID.',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
  },
  responses: {
    200: {
      description: 'Produk',
      content: { 'application/json': { schema: ProductSchema } },
    },
    404: {
      description: 'Tidak ditemukan',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/products',
  description: 'Buat produk baru (admin).',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: ProductCreateSchema } },
    },
  },
  responses: {
    201: {
      description: 'Produk dibuat',
      content: { 'application/json': { schema: ProductSchema } },
    },
    400: {
      description: 'Validation error / SKU duplikat',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/products/{id}',
  description: 'Update produk (admin).',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      required: true,
      content: { 'application/json': { schema: ProductUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: 'Produk ter-update',
      content: { 'application/json': { schema: ProductSchema } },
    },
    404: {
      description: 'Tidak ditemukan',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/products/{id}',
  description: 'Soft-delete produk (set is_active=0).',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
  },
  responses: {
    200: {
      description: 'Berhasil',
      content: {
        'application/json': { schema: z.object({ message: z.string() }) },
      },
    },
  },
});
