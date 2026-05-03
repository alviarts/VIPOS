// Schema untuk endpoint /api/customers/*

import { z, registry } from '../openapi';
import { DateOnlySchema, DateTimeStringSchema, ErrorResponseSchema, IdStringSchema } from './common';

export const GenderSchema = z.enum(['L', 'P']).openapi({
  description: 'L=Laki-laki, P=Perempuan',
});

export const CustomerSchema = z
  .object({
    id: z.number().int().positive(),
    kode: z.string().nullable(),
    name: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    address: z.string().nullable(),
    gender: GenderSchema.nullable(),
    birth_date: z.string().nullable(),
    points: z.number().int().default(0),
    deposit: z.number().default(0),
    notes: z.string().nullable(),
    is_active: z.union([z.literal(0), z.literal(1)]),
    created_at: DateTimeStringSchema.optional(),
    updated_at: DateTimeStringSchema.optional(),
  })
  .openapi('Customer');
export type Customer = z.infer<typeof CustomerSchema>;

export const CustomerCreateSchema = z
  .object({
    kode: z.string().max(32).optional().nullable(),
    name: z.string().min(1, 'Nama wajib diisi').max(128),
    phone: z.string().max(32).optional().nullable(),
    email: z
      .string()
      .email('Email tidak valid')
      .max(128)
      .optional()
      .nullable()
      .or(z.literal('').transform(() => null)),
    address: z.string().max(512).optional().nullable(),
    gender: GenderSchema.optional().nullable(),
    birth_date: DateOnlySchema.optional().nullable().or(z.literal('').transform(() => null)),
    points: z.coerce.number().int().nonnegative().optional().default(0),
    deposit: z.coerce.number().nonnegative().optional().default(0),
    notes: z.string().max(2048).optional().nullable(),
  })
  .openapi('CustomerCreateRequest');
export type CustomerCreate = z.infer<typeof CustomerCreateSchema>;

export const CustomerUpdateSchema = CustomerCreateSchema.partial()
  .extend({
    is_active: z.coerce.number().int().min(0).max(1).optional(),
  })
  .openapi('CustomerUpdateRequest');
export type CustomerUpdate = z.infer<typeof CustomerUpdateSchema>;

// --- OpenAPI path registrations -------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/customers',
  description: 'List customer dengan optional search.',
  tags: ['Customers'],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      search: z.string().max(128).optional(),
      active_only: z.enum(['true', 'false']).optional().default('true'),
    }),
  },
  responses: {
    200: {
      description: 'Array customer',
      content: { 'application/json': { schema: z.array(CustomerSchema) } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/customers',
  description: 'Buat customer baru.',
  tags: ['Customers'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: CustomerCreateSchema } },
    },
  },
  responses: {
    201: {
      description: 'Customer dibuat',
      content: { 'application/json': { schema: CustomerSchema } },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/customers/{id}',
  description: 'Update customer.',
  tags: ['Customers'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      required: true,
      content: { 'application/json': { schema: CustomerUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: 'Customer ter-update',
      content: { 'application/json': { schema: CustomerSchema } },
    },
    404: {
      description: 'Tidak ditemukan',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/customers/{id}',
  description: 'Soft-delete customer (set is_active=0).',
  tags: ['Customers'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
  },
  responses: {
    200: {
      description: 'Berhasil',
      content: { 'application/json': { schema: z.object({ message: z.string() }) } },
    },
  },
});
