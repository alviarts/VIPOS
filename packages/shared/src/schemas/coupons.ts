// Schema untuk endpoint /api/v1/coupon/* — pre-generated coupon codes (SINGLE
// atau BULK_GENERATE) yang trigger promo saat redeem di checkout.

import { z, registry } from '../openapi';
import { DateTimeStringSchema, ErrorResponseSchema, IdStringSchema } from './common';

export const CouponSchema = z
  .object({
    id: z.number().int().positive(),
    promo_id: z.number().int().positive(),
    code: z.string(),
    batch_id: z.string().nullable(),
    max_uses: z.number().int().nonnegative(),
    used_count: z.number().int().nonnegative(),
    assigned_customer_id: z.number().int().positive().nullable(),
    valid_from: DateTimeStringSchema.nullable(),
    valid_until: DateTimeStringSchema.nullable(),
    is_active: z.union([z.literal(0), z.literal(1)]),
    promo_name: z.string().optional(),
    promo_type: z.string().optional(),
    customer_name: z.string().optional().nullable(),
    created_at: DateTimeStringSchema.optional(),
  })
  .openapi('Coupon');
export type Coupon = z.infer<typeof CouponSchema>;

export const CouponCreateSchema = z
  .object({
    promo_id: z.coerce.number().int().positive(),
    code: z
      .string()
      .min(3, 'Kode kupon minimal 3 karakter')
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/, 'Kode kupon hanya huruf, angka, _, -')
      .transform((v) => v.toUpperCase()),
    max_uses: z.coerce.number().int().min(1).max(100000).default(1),
    assigned_customer_id: z.coerce.number().int().positive().optional().nullable(),
    valid_from: z.string().datetime().optional().nullable(),
    valid_until: z.string().datetime().optional().nullable(),
    is_active: z.coerce.boolean().default(true),
  })
  .openapi('CouponCreateRequest');
export type CouponCreate = z.infer<typeof CouponCreateSchema>;

export const CouponBulkCreateSchema = z
  .object({
    promo_id: z.coerce.number().int().positive(),
    count: z.coerce.number().int().min(1).max(10000),
    prefix: z
      .string()
      .max(16)
      .regex(/^[A-Z0-9_-]*$/, 'Prefix hanya huruf besar, angka, _, -')
      .optional()
      .default(''),
    code_length: z.coerce.number().int().min(4).max(32).default(8),
    max_uses: z.coerce.number().int().min(1).max(100000).default(1),
    valid_from: z.string().datetime().optional().nullable(),
    valid_until: z.string().datetime().optional().nullable(),
  })
  .openapi('CouponBulkCreateRequest');
export type CouponBulkCreate = z.infer<typeof CouponBulkCreateSchema>;

export const CouponBulkResponseSchema = z
  .object({
    batch_id: z.string(),
    count: z.number().int().nonnegative(),
    codes: z.array(z.string()),
  })
  .openapi('CouponBulkResponse');
export type CouponBulkResponse = z.infer<typeof CouponBulkResponseSchema>;

export const CouponValidateRequestSchema = z
  .object({
    code: z.string().min(1).max(64),
    customer_id: z.coerce.number().int().positive().optional().nullable(),
    subtotal: z.coerce.number().nonnegative().optional().default(0),
  })
  .openapi('CouponValidateRequest');
export type CouponValidateRequest = z.infer<typeof CouponValidateRequestSchema>;

export const CouponValidateResponseSchema = z
  .object({
    valid: z.boolean(),
    reason: z.string().optional(),
    coupon: CouponSchema.optional(),
    promo: z
      .object({
        id: z.number().int().positive(),
        name: z.string(),
        promo_type: z.string(),
        discount_value: z.number().nonnegative(),
        max_discount: z.number().nullable(),
        min_purchase: z.number().nonnegative(),
      })
      .optional(),
    estimated_discount: z.number().nonnegative().optional(),
  })
  .openapi('CouponValidateResponse');
export type CouponValidateResponse = z.infer<typeof CouponValidateResponseSchema>;

// --- OpenAPI registrations ------------------------------------------------

const json = (schema: z.ZodTypeAny) => ({
  'application/json': { schema },
});
const okMessage = z.object({ message: z.string() });

registry.registerPath({
  method: 'get',
  path: '/api/v1/coupon',
  description: 'List kupon dengan filter (promo_id, batch_id, is_active, search code).',
  tags: ['Coupons'],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      promo_id: z.string().optional(),
      batch_id: z.string().optional(),
      is_active: z.enum(['0', '1']).optional(),
      search: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'List kupon + total count',
      content: json(
        z.object({
          items: z.array(CouponSchema),
          total: z.number().int().nonnegative(),
        })
      ),
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/coupon/batches',
  description: 'Ringkasan batch (count, used, remaining, status).',
  tags: ['Coupons'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Array batch summary',
      content: json(
        z.array(
          z.object({
            batch_id: z.string(),
            promo_id: z.number().int().positive(),
            promo_name: z.string(),
            generated: z.number().int().nonnegative(),
            used: z.number().int().nonnegative(),
            remaining: z.number().int().nonnegative(),
            created_at: z.string(),
          })
        )
      ),
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/coupon',
  description: 'Buat satu kupon dengan kode custom.',
  tags: ['Coupons'],
  security: [{ bearerAuth: [] }],
  request: { body: { required: true, content: json(CouponCreateSchema) } },
  responses: {
    201: { description: 'Kupon dibuat', content: json(CouponSchema) },
    400: {
      description: 'Validation error',
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/coupon/bulk',
  description:
    'Generate N kupon secara bulk (random suffix). Kembalikan list kode untuk distribusi.',
  tags: ['Coupons'],
  security: [{ bearerAuth: [] }],
  request: { body: { required: true, content: json(CouponBulkCreateSchema) } },
  responses: {
    201: {
      description: 'Bulk generate berhasil',
      content: json(CouponBulkResponseSchema),
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/coupon/validate',
  description:
    'Validasi kupon (cek aktif, expiry, max_uses, customer assignment, min_purchase). Tidak meng-increment used_count.',
  tags: ['Coupons'],
  security: [{ bearerAuth: [] }],
  request: {
    body: { required: true, content: json(CouponValidateRequestSchema) },
  },
  responses: {
    200: {
      description: 'Hasil validasi',
      content: json(CouponValidateResponseSchema),
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/coupon/redeem',
  description:
    'Redeem kupon — increment used_count + record di coupon_redemptions. Validasi sama dengan validate. Idempoten via transaction_id.',
  tags: ['Coupons'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: json(
        CouponValidateRequestSchema.extend({
          transaction_id: z.coerce.number().int().positive().optional(),
          amount: z.coerce.number().nonnegative().default(0),
        })
      ),
    },
  },
  responses: {
    200: {
      description: 'Redeem berhasil',
      content: json(CouponValidateResponseSchema),
    },
    400: {
      description: 'Tidak valid / sudah dipakai',
      content: json(CouponValidateResponseSchema),
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/coupon/{id}',
  description: 'Hapus satu kupon (admin).',
  tags: ['Coupons'],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: { description: 'Berhasil', content: json(okMessage) },
    404: {
      description: 'Tidak ditemukan',
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/coupon/batch/{batch_id}',
  description: 'Deactivate seluruh kupon dalam batch (set is_active=0). Tidak menghapus row.',
  tags: ['Coupons'],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ batch_id: z.string() }) },
  responses: {
    200: {
      description: 'Berhasil',
      content: json(z.object({ message: z.string(), updated: z.number() })),
    },
  },
});
