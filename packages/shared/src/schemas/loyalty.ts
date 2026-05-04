// Schema untuk endpoint /api/v1/loyalty-rule/* dan /api/v1/loyalty/* (transaksi
// poin loyalty per customer). Mendukung 3 tipe rule: earn_per_total,
// earn_per_product, redemption (pengaturan tukar poin).

import { z, registry } from '../openapi';
import { DateTimeStringSchema, ErrorResponseSchema, IdStringSchema } from './common';

const LoyaltyRuleTypeSchema = z.enum(['earn_per_total', 'earn_per_product', 'redemption']);
export type LoyaltyRuleType = z.infer<typeof LoyaltyRuleTypeSchema>;

const IdArraySchema = z.array(z.number().int().positive());

const MultiplierMapSchema = z.record(z.string().regex(/^\d+$/), z.coerce.number().nonnegative());

export const LoyaltyRuleSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    rule_type: LoyaltyRuleTypeSchema,
    earn_rate: z.number().nonnegative().nullable(),
    bonus_points: z.number().int().nonnegative().nullable(),
    target_product_ids: IdArraySchema,
    multiplier_per_group: MultiplierMapSchema,
    excluded_payment_methods: z.array(z.string()),
    excluded_categories: IdArraySchema,
    redemption_rate: z.number().nonnegative().nullable(),
    min_redeem_per_transaction: z.number().int().nonnegative().nullable(),
    max_redeem_per_transaction: z.number().int().nonnegative().nullable(),
    max_redeem_per_day_per_customer: z.number().int().nonnegative().nullable(),
    redemption_block: z.number().int().positive().nullable(),
    points_expire_after_months: z.number().int().nonnegative().nullable(),
    valid_from: DateTimeStringSchema.nullable(),
    valid_until: DateTimeStringSchema.nullable(),
    is_active: z.union([z.literal(0), z.literal(1)]),
    created_at: DateTimeStringSchema.optional(),
    updated_at: DateTimeStringSchema.optional(),
  })
  .openapi('LoyaltyRule');
export type LoyaltyRule = z.infer<typeof LoyaltyRuleSchema>;

export const LoyaltyRuleCreateSchema = z
  .object({
    name: z.string().min(1, 'Nama rule wajib diisi').max(120),
    rule_type: LoyaltyRuleTypeSchema,
    earn_rate: z.coerce.number().nonnegative().optional().nullable(),
    bonus_points: z.coerce.number().int().nonnegative().optional().nullable(),
    target_product_ids: IdArraySchema.default([]),
    multiplier_per_group: MultiplierMapSchema.default({}),
    excluded_payment_methods: z.array(z.string()).default([]),
    excluded_categories: IdArraySchema.default([]),
    redemption_rate: z.coerce.number().nonnegative().optional().nullable(),
    min_redeem_per_transaction: z.coerce.number().int().nonnegative().optional().nullable(),
    max_redeem_per_transaction: z.coerce.number().int().nonnegative().optional().nullable(),
    max_redeem_per_day_per_customer: z.coerce.number().int().nonnegative().optional().nullable(),
    redemption_block: z.coerce.number().int().positive().optional().nullable(),
    points_expire_after_months: z.coerce.number().int().nonnegative().optional().nullable(),
    valid_from: z.string().datetime().optional().nullable(),
    valid_until: z.string().datetime().optional().nullable(),
    is_active: z.coerce.boolean().default(true),
  })
  .openapi('LoyaltyRuleCreateRequest');
export type LoyaltyRuleCreate = z.infer<typeof LoyaltyRuleCreateSchema>;

export const LoyaltyRuleUpdateSchema = LoyaltyRuleCreateSchema.partial().openapi(
  'LoyaltyRuleUpdateRequest'
);
export type LoyaltyRuleUpdate = z.infer<typeof LoyaltyRuleUpdateSchema>;

// --- Loyalty transactions (audit ledger) -------------------------------

export const LoyaltyTransactionSchema = z
  .object({
    id: z.number().int().positive(),
    customer_id: z.number().int().positive(),
    type: z.enum(['earn', 'redeem', 'expire', 'adjust']),
    points: z.number().int(),
    balance_after: z.number().int().nonnegative(),
    transaction_id: z.number().int().positive().nullable(),
    rule_id: z.number().int().positive().nullable(),
    notes: z.string().nullable(),
    expires_at: DateTimeStringSchema.nullable(),
    created_at: DateTimeStringSchema,
    customer_name: z.string().optional(),
  })
  .openapi('LoyaltyTransaction');
export type LoyaltyTransaction = z.infer<typeof LoyaltyTransactionSchema>;

export const LoyaltyAdjustSchema = z
  .object({
    customer_id: z.coerce.number().int().positive(),
    points: z.coerce.number().int(),
    notes: z.string().max(255).optional(),
  })
  .openapi('LoyaltyAdjustRequest');
export type LoyaltyAdjust = z.infer<typeof LoyaltyAdjustSchema>;

// --- OpenAPI registrations -----------------------------------------------

const json = (schema: z.ZodTypeAny) => ({
  'application/json': { schema },
});
const okMessage = z.object({ message: z.string() });

registry.registerPath({
  method: 'get',
  path: '/api/v1/loyalty-rule',
  description: 'List semua loyalty rule (filter rule_type, is_active).',
  tags: ['Loyalty'],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      rule_type: LoyaltyRuleTypeSchema.optional(),
      is_active: z.enum(['0', '1']).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Array rule',
      content: json(z.array(LoyaltyRuleSchema)),
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/loyalty-rule',
  description: 'Buat rule baru (earn / redemption).',
  tags: ['Loyalty'],
  security: [{ bearerAuth: [] }],
  request: {
    body: { required: true, content: json(LoyaltyRuleCreateSchema) },
  },
  responses: {
    201: { description: 'Rule dibuat', content: json(LoyaltyRuleSchema) },
    400: {
      description: 'Validation error',
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/loyalty-rule/{id}',
  description: 'Update rule.',
  tags: ['Loyalty'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
    body: { required: true, content: json(LoyaltyRuleUpdateSchema) },
  },
  responses: {
    200: { description: 'Rule ter-update', content: json(LoyaltyRuleSchema) },
    404: {
      description: 'Tidak ditemukan',
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/loyalty-rule/{id}',
  description: 'Hapus rule.',
  tags: ['Loyalty'],
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
  method: 'get',
  path: '/api/v1/loyalty/transactions',
  description: 'List loyalty transactions (filter customer_id, type).',
  tags: ['Loyalty'],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      customer_id: z.string().optional(),
      type: z.enum(['earn', 'redeem', 'expire', 'adjust']).optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'List transactions + total',
      content: json(
        z.object({
          items: z.array(LoyaltyTransactionSchema),
          total: z.number().int().nonnegative(),
        })
      ),
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/loyalty/adjust',
  description: 'Manual adjust poin customer (admin). Positive = tambah, negative = kurangi.',
  tags: ['Loyalty'],
  security: [{ bearerAuth: [] }],
  request: { body: { required: true, content: json(LoyaltyAdjustSchema) } },
  responses: {
    200: {
      description: 'Adjust berhasil + saldo baru',
      content: json(
        z.object({
          customer_id: z.number().int().positive(),
          balance: z.number().int().nonnegative(),
          transaction: LoyaltyTransactionSchema,
        })
      ),
    },
    404: {
      description: 'Customer tidak ditemukan',
      content: json(ErrorResponseSchema),
    },
  },
});
