// Schema untuk endpoint /api/v1/promo/* — 8 jenis promo (PERCENT, NOMINAL,
// FREE_PRODUCT, BUY_X_GET_Y, BUNDLE_PRICE, MIN_PURCHASE, STEP_DISCOUNT,
// MEMBER_PRICE) + kondisi waktu/customer-group/produk/min-purchase.

import { z, registry } from '../openapi';
import { DateTimeStringSchema, ErrorResponseSchema, IdStringSchema } from './common';

const PromoTypeSchema = z.enum([
  'PERCENT',
  'NOMINAL',
  'FREE_PRODUCT',
  'BUY_X_GET_Y',
  'BUNDLE_PRICE',
  'MIN_PURCHASE',
  'STEP_DISCOUNT',
  'MEMBER_PRICE',
]);
export type PromoType = z.infer<typeof PromoTypeSchema>;

const DiscountTargetSchema = z.enum([
  'WHOLE_CART',
  'TARGET_PRODUCTS',
  'CHEAPEST_OF_TARGET',
  'MOST_EXPENSIVE_OF_TARGET',
]);
export type DiscountTarget = z.infer<typeof DiscountTargetSchema>;

const IdArraySchema = z.array(z.number().int().positive());

const StepTierSchema = z.object({
  min_qty: z.coerce.number().int().nonnegative().optional(),
  min_amount: z.coerce.number().nonnegative().optional(),
  discount_percent: z.coerce.number().min(0).max(100).optional(),
  discount_nominal: z.coerce.number().nonnegative().optional(),
});
export type StepTier = z.infer<typeof StepTierSchema>;

const TimeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format waktu HH:MM (00:00-23:59)');

export const PromoSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    description: z.string().nullable(),
    promo_type: PromoTypeSchema,
    discount_value: z.number().nonnegative(),
    max_discount: z.number().nonnegative().nullable(),
    bundle_price: z.number().nonnegative().nullable(),
    qty_required: z.number().int().nonnegative(),
    give_qty: z.number().int().nonnegative(),
    discount_target: DiscountTargetSchema,
    target_product_ids: IdArraySchema,
    target_category_ids: IdArraySchema,
    customer_group_ids: IdArraySchema,
    valid_from: DateTimeStringSchema.nullable(),
    valid_until: DateTimeStringSchema.nullable(),
    day_of_week_mask: z.number().int().min(0).max(127),
    time_of_day_start: z.string().nullable(),
    time_of_day_end: z.string().nullable(),
    min_purchase: z.number().nonnegative(),
    max_use_per_customer: z.number().int().nonnegative(),
    max_total_use: z.number().int().nonnegative(),
    current_use_count: z.number().int().nonnegative(),
    step_tiers: z.array(StepTierSchema),
    is_stackable: z.union([z.literal(0), z.literal(1)]),
    requires_coupon: z.union([z.literal(0), z.literal(1)]),
    is_active: z.union([z.literal(0), z.literal(1)]),
    coupon_count: z.number().int().nonnegative().optional(),
    created_at: DateTimeStringSchema.optional(),
    updated_at: DateTimeStringSchema.optional(),
  })
  .openapi('Promo');
export type Promo = z.infer<typeof PromoSchema>;

export const PromoCreateSchema = z
  .object({
    name: z.string().min(1, 'Nama promo wajib diisi').max(120),
    description: z.string().max(1024).optional().nullable(),
    promo_type: PromoTypeSchema,
    discount_value: z.coerce.number().nonnegative().default(0),
    max_discount: z.coerce.number().nonnegative().optional().nullable(),
    bundle_price: z.coerce.number().nonnegative().optional().nullable(),
    qty_required: z.coerce.number().int().nonnegative().default(0),
    give_qty: z.coerce.number().int().nonnegative().default(0),
    discount_target: DiscountTargetSchema.default('WHOLE_CART'),
    target_product_ids: IdArraySchema.default([]),
    target_category_ids: IdArraySchema.default([]),
    customer_group_ids: IdArraySchema.default([]),
    valid_from: z.string().datetime().optional().nullable(),
    valid_until: z.string().datetime().optional().nullable(),
    day_of_week_mask: z.coerce.number().int().min(0).max(127).default(127),
    time_of_day_start: TimeOfDaySchema.optional().nullable(),
    time_of_day_end: TimeOfDaySchema.optional().nullable(),
    min_purchase: z.coerce.number().nonnegative().default(0),
    max_use_per_customer: z.coerce.number().int().nonnegative().default(0),
    max_total_use: z.coerce.number().int().nonnegative().default(0),
    step_tiers: z.array(StepTierSchema).default([]),
    is_stackable: z.coerce.boolean().default(false),
    requires_coupon: z.coerce.boolean().default(false),
    is_active: z.coerce.boolean().default(true),
  })
  .openapi('PromoCreateRequest');
export type PromoCreate = z.infer<typeof PromoCreateSchema>;

export const PromoUpdateSchema = PromoCreateSchema.partial().openapi('PromoUpdateRequest');
export type PromoUpdate = z.infer<typeof PromoUpdateSchema>;

// --- OpenAPI registrations ------------------------------------------------

const json = (schema: z.ZodTypeAny) => ({
  'application/json': { schema },
});
const okMessage = z.object({ message: z.string() });

registry.registerPath({
  method: 'get',
  path: '/api/v1/promo',
  description: 'List semua promo dengan filter optional (is_active, promo_type, search).',
  tags: ['Promos'],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      is_active: z.enum(['0', '1']).optional(),
      promo_type: PromoTypeSchema.optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Array promo',
      content: json(z.array(PromoSchema)),
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/promo/{id}',
  description: 'Detail satu promo.',
  tags: ['Promos'],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: { description: 'Promo', content: json(PromoSchema) },
    404: {
      description: 'Tidak ditemukan',
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/promo',
  description: 'Buat promo baru (admin).',
  tags: ['Promos'],
  security: [{ bearerAuth: [] }],
  request: { body: { required: true, content: json(PromoCreateSchema) } },
  responses: {
    201: { description: 'Promo dibuat', content: json(PromoSchema) },
    400: {
      description: 'Validation error',
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/promo/{id}',
  description: 'Update promo (admin).',
  tags: ['Promos'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
    body: { required: true, content: json(PromoUpdateSchema) },
  },
  responses: {
    200: { description: 'Promo ter-update', content: json(PromoSchema) },
    404: {
      description: 'Tidak ditemukan',
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/promo/{id}',
  description: 'Hapus promo (admin). Akan cascade hapus coupon terkait.',
  tags: ['Promos'],
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
