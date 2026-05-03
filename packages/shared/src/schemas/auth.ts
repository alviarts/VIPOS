// Schema untuk endpoint /api/auth/*

import { z, registry } from '../openapi';
import { DateTimeStringSchema, ErrorResponseSchema } from './common';

export const UserRoleSchema = z
  .enum(['admin', 'cashier'])
  .openapi({ example: 'admin' });
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z
  .object({
    id: z.number().int().positive(),
    username: z.string(),
    name: z.string(),
    role: UserRoleSchema,
    created_at: DateTimeStringSchema.optional(),
  })
  .openapi('User');
export type User = z.infer<typeof UserSchema>;

// User minimal (tanpa created_at) — bentuk yang dikembalikan login response
// dan /auth/me.
export const UserSummarySchema = z
  .object({
    id: z.number().int().positive(),
    username: z.string(),
    name: z.string(),
    role: UserRoleSchema,
  })
  .openapi('UserSummary');
export type UserSummary = z.infer<typeof UserSummarySchema>;

// POST /api/auth/login
export const LoginRequestSchema = z
  .object({
    username: z.string().min(1, 'Username wajib diisi').max(64),
    password: z.string().min(1, 'Password wajib diisi'),
  })
  .openapi('LoginRequest');
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z
  .object({
    token: z.string().openapi({ description: 'JWT signed dengan JWT_SECRET, expiry 24 jam' }),
    user: UserSummarySchema,
  })
  .openapi('LoginResponse');
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// GET /api/auth/me
export const MeResponseSchema = z
  .object({
    user: UserSummarySchema,
  })
  .openapi('MeResponse');
export type MeResponse = z.infer<typeof MeResponseSchema>;

// POST /api/auth/register (admin only)
export const RegisterRequestSchema = z
  .object({
    username: z.string().min(1, 'Username wajib diisi').max(64),
    password: z.string().min(6, 'Password minimal 6 karakter').max(128),
    name: z.string().min(1, 'Nama wajib diisi').max(128),
    role: UserRoleSchema.optional().default('cashier'),
  })
  .openapi('RegisterRequest');
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const RegisterResponseSchema = z
  .object({
    message: z.string(),
    user: UserSummarySchema,
  })
  .openapi('RegisterResponse');
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

// --- OpenAPI path registrations -------------------------------------------

const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  description: 'Login dengan username + password, balikin JWT.',
  tags: ['Auth'],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: LoginRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'Login berhasil',
      content: { 'application/json': { schema: LoginResponseSchema } },
    },
    401: {
      description: 'Username atau password salah',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    400: {
      description: 'Field wajib tidak diisi',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/auth/me',
  description: 'Dapatkan info user dari JWT.',
  tags: ['Auth'],
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: {
      description: 'User profile',
      content: { 'application/json': { schema: MeResponseSchema } },
    },
    401: {
      description: 'Token tidak valid',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/register',
  description: 'Buat user baru (hanya admin).',
  tags: ['Auth'],
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: RegisterRequestSchema } },
    },
  },
  responses: {
    201: {
      description: 'User berhasil dibuat',
      content: { 'application/json': { schema: RegisterResponseSchema } },
    },
    400: {
      description: 'Validation error / username sudah dipakai',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Bukan admin',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});
