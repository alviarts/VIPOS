// Schema untuk endpoint /api/v1/finance/* (cash accounts + cash transactions).

import { z, registry } from '../openapi';
import {
  DateOnlySchema,
  DateTimeStringSchema,
  ErrorResponseSchema,
  IdStringSchema,
} from './common';

export const AccountTipeSchema = z.enum(['header', 'detail']);
export const CashAccountSchema = z
  .object({
    id: z.number().int().positive(),
    kode: z.string(),
    tipe: AccountTipeSchema.default('detail'),
    nama: z.string(),
    kategori: z.string().default('Kas & Bank'),
    saldo_awal: z.number().default(0),
    is_active: z.union([z.literal(0), z.literal(1)]),
    created_at: DateTimeStringSchema.optional(),
  })
  .openapi('CashAccount');
export type CashAccount = z.infer<typeof CashAccountSchema>;

export const CashAccountCreateSchema = z
  .object({
    kode: z.string().min(1, 'Kode akun wajib diisi').max(32),
    tipe: AccountTipeSchema.optional().default('detail'),
    nama: z.string().min(1, 'Nama akun wajib diisi').max(128),
    kategori: z.string().max(64).optional().default('Kas & Bank'),
    saldo_awal: z.coerce.number().optional().default(0),
  })
  .openapi('CashAccountCreateRequest');
export type CashAccountCreate = z.infer<typeof CashAccountCreateSchema>;

export const CashAccountUpdateSchema = CashAccountCreateSchema.partial()
  .extend({
    is_active: z.coerce.number().int().min(0).max(1).optional(),
  })
  .openapi('CashAccountUpdateRequest');
export type CashAccountUpdate = z.infer<typeof CashAccountUpdateSchema>;

export const CashTransactionTipeSchema = z.enum(['pemasukan', 'pengeluaran', 'transfer']);
export const CashTransactionSchema = z
  .object({
    id: z.number().int().positive(),
    tanggal: z.string(),
    tipe: CashTransactionTipeSchema,
    account_id: z.number().int().positive(),
    account_to_id: z.number().int().positive().nullable(),
    kategori: z.string().nullable(),
    jumlah: z.number(),
    keterangan: z.string().nullable(),
    reference: z.string().nullable(),
    user_id: z.number().int().nullable(),
    created_at: DateTimeStringSchema.optional(),
  })
  .openapi('CashTransaction');
export type CashTransaction = z.infer<typeof CashTransactionSchema>;

export const CashTransactionCreateSchema = z
  .object({
    tanggal: DateOnlySchema.optional(),
    tipe: CashTransactionTipeSchema,
    account_id: z.coerce.number().int().positive(),
    account_to_id: z.coerce.number().int().positive().optional().nullable(),
    kategori: z.string().max(64).optional().nullable(),
    jumlah: z.coerce.number().positive('Jumlah harus > 0'),
    keterangan: z.string().max(512).optional().nullable(),
    reference: z.string().max(128).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.tipe === 'transfer' && !v.account_to_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['account_to_id'],
        message: 'account_to_id wajib untuk transfer',
      });
    }
  })
  .openapi('CashTransactionCreateRequest');
export type CashTransactionCreate = z.infer<typeof CashTransactionCreateSchema>;

// --- OpenAPI path registrations -------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/v1/finance/accounts',
  description: 'List cash account.',
  tags: ['Finance'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Array cash accounts',
      content: { 'application/json': { schema: z.array(CashAccountSchema) } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/finance/accounts',
  description: 'Buat cash account.',
  tags: ['Finance'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: CashAccountCreateSchema } },
    },
  },
  responses: {
    201: {
      description: 'Account dibuat',
      content: { 'application/json': { schema: CashAccountSchema } },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/finance/accounts/{id}',
  description: 'Update cash account.',
  tags: ['Finance'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      required: true,
      content: { 'application/json': { schema: CashAccountUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: 'Account ter-update',
      content: { 'application/json': { schema: CashAccountSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/finance/transactions',
  description: 'List cash transaction (filter by tanggal/tipe/account).',
  tags: ['Finance'],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      tanggal_from: DateOnlySchema.optional(),
      tanggal_to: DateOnlySchema.optional(),
      tipe: CashTransactionTipeSchema.optional(),
      account_id: z.coerce.number().int().positive().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Array cash transactions',
      content: {
        'application/json': { schema: z.array(CashTransactionSchema) },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/finance/transactions',
  description: 'Catat cash transaction (pemasukan/pengeluaran/transfer).',
  tags: ['Finance'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: CashTransactionCreateSchema } },
    },
  },
  responses: {
    201: {
      description: 'Transaction dibuat',
      content: { 'application/json': { schema: CashTransactionSchema } },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});
