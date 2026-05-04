// Schema untuk endpoint /api/v1/auth/*

import { z, registry } from "../openapi";
import { DateTimeStringSchema, ErrorResponseSchema } from "./common";

export const UserRoleSchema = z
  .enum(["admin", "cashier"])
  .openapi({ example: "admin" });
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z
  .object({
    id: z.number().int().positive(),
    username: z.string(),
    name: z.string(),
    role: UserRoleSchema,
    created_at: DateTimeStringSchema.optional(),
  })
  .openapi("User");
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
  .openapi("UserSummary");
export type UserSummary = z.infer<typeof UserSummarySchema>;

// POST /api/v1/auth/login
export const LoginRequestSchema = z
  .object({
    username: z.string().min(1, "Username wajib diisi").max(64),
    password: z.string().min(1, "Password wajib diisi"),
    remember_me: z.boolean().optional().default(false),
  })
  .openapi("LoginRequest");
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z
  .object({
    token: z
      .string()
      .openapi({
        description: "Access JWT, expiry 15 menit (refresh via /auth/refresh).",
      }),
    refresh_token: z.string().openapi({
      description: "Refresh token opaque, dikirim balik ke /auth/refresh.",
    }),
    expires_in: z.number().int().openapi({
      description: "Sisa detik sampai access token expire.",
    }),
    user: UserSummarySchema,
  })
  .openapi("LoginResponse");
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// Saat user 2FA-nya enabled, /auth/login balikin login_token (intermediate JWT)
// + flag requires_2fa, bukan access token. Client lalu panggil /auth/login/2fa.
export const Login2FARequiredResponseSchema = z
  .object({
    requires_2fa: z.literal(true),
    login_token: z.string().openapi({
      description:
        "JWT short-lived (5 menit) untuk proof password sudah benar. Kirim balik ke /auth/login/2fa bersama TOTP code.",
    }),
  })
  .openapi("Login2FARequiredResponse");
export type Login2FARequiredResponse = z.infer<
  typeof Login2FARequiredResponseSchema
>;

export const LoginVerify2FARequestSchema = z
  .object({
    login_token: z.string().min(1),
    code: z.string().regex(/^\d{6}$/, "Kode TOTP 6 digit angka"),
    remember_me: z.boolean().optional().default(false),
  })
  .openapi("LoginVerify2FARequest");
export type LoginVerify2FARequest = z.infer<typeof LoginVerify2FARequestSchema>;

// POST /api/v1/auth/refresh
export const RefreshRequestSchema = z
  .object({
    refresh_token: z.string().min(1),
  })
  .openapi("RefreshRequest");
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

export const RefreshResponseSchema = LoginResponseSchema.openapi(
  "RefreshResponse",
);

// POST /api/v1/auth/logout
export const LogoutRequestSchema = z
  .object({
    refresh_token: z.string().min(1),
  })
  .openapi("LogoutRequest");
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;

// POST /api/v1/auth/forgot-password
export const ForgotPasswordRequestSchema = z
  .object({
    email_or_username: z.string().min(1),
  })
  .openapi("ForgotPasswordRequest");
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

// POST /api/v1/auth/reset-password
export const ResetPasswordRequestSchema = z
  .object({
    token: z.string().min(1),
    new_password: z.string().min(6, "Password minimal 6 karakter").max(128),
  })
  .openapi("ResetPasswordRequest");
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

// POST /api/v1/auth/change-password (auth required)
export const ChangePasswordRequestSchema = z
  .object({
    current_password: z.string().min(1),
    new_password: z.string().min(6, "Password minimal 6 karakter").max(128),
  })
  .openapi("ChangePasswordRequest");
export type ChangePasswordRequest = z.infer<
  typeof ChangePasswordRequestSchema
>;

// POST /api/v1/auth/2fa/setup → returns secret + otpauth URL.
export const TwoFactorSetupResponseSchema = z
  .object({
    secret: z.string(),
    otpauth_url: z.string().url(),
  })
  .openapi("TwoFactorSetupResponse");
export type TwoFactorSetupResponse = z.infer<
  typeof TwoFactorSetupResponseSchema
>;

// POST /api/v1/auth/2fa/verify
export const TwoFactorVerifyRequestSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/, "Kode TOTP 6 digit angka"),
  })
  .openapi("TwoFactorVerifyRequest");
export type TwoFactorVerifyRequest = z.infer<
  typeof TwoFactorVerifyRequestSchema
>;

// POST /api/v1/auth/2fa/disable
export const TwoFactorDisableRequestSchema = z
  .object({
    password: z.string().min(1),
  })
  .openapi("TwoFactorDisableRequest");
export type TwoFactorDisableRequest = z.infer<
  typeof TwoFactorDisableRequestSchema
>;

// GET /api/v1/auth/me
export const MeResponseSchema = z
  .object({
    user: UserSummarySchema,
  })
  .openapi("MeResponse");
export type MeResponse = z.infer<typeof MeResponseSchema>;

// POST /api/v1/auth/register (admin only)
export const RegisterRequestSchema = z
  .object({
    username: z.string().min(1, "Username wajib diisi").max(64),
    password: z.string().min(6, "Password minimal 6 karakter").max(128),
    name: z.string().min(1, "Nama wajib diisi").max(128),
    role: UserRoleSchema.optional().default("cashier"),
  })
  .openapi("RegisterRequest");
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const RegisterResponseSchema = z
  .object({
    message: z.string(),
    user: UserSummarySchema,
  })
  .openapi("RegisterResponse");
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

// --- OpenAPI path registrations -------------------------------------------

const bearerAuth = registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/login",
  description: "Login dengan username + password, balikin JWT.",
  tags: ["Auth"],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: LoginRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Login berhasil",
      content: { "application/json": { schema: LoginResponseSchema } },
    },
    401: {
      description: "Username atau password salah",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    400: {
      description: "Field wajib tidak diisi",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/auth/me",
  description: "Dapatkan info user dari JWT.",
  tags: ["Auth"],
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: {
      description: "User profile",
      content: { "application/json": { schema: MeResponseSchema } },
    },
    401: {
      description: "Token tidak valid",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/register",
  description: "Buat user baru (hanya admin).",
  tags: ["Auth"],
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: RegisterRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "User berhasil dibuat",
      content: { "application/json": { schema: RegisterResponseSchema } },
    },
    400: {
      description: "Validation error / username sudah dipakai",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Bukan admin",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/login/2fa",
  description: "Verify TOTP code for users with 2FA enabled.",
  tags: ["Auth"],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: LoginVerify2FARequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Login berhasil",
      content: { "application/json": { schema: LoginResponseSchema } },
    },
    401: {
      description: "Kode TOTP salah atau login_token expired",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/refresh",
  description:
    "Tukar refresh token dengan access token baru. Refresh token lama langsung di-revoke (token rotation).",
  tags: ["Auth"],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: RefreshRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Token baru",
      content: { "application/json": { schema: RefreshResponseSchema } },
    },
    401: {
      description: "Refresh token tidak valid / expired / revoked",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/logout",
  description: "Invalidate refresh token (server-side revoke).",
  tags: ["Auth"],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: LogoutRequestSchema } },
    },
  },
  responses: {
    204: { description: "Logged out" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/forgot-password",
  description:
    "Generate reset link. Untuk dev environment, link di-print ke server console.",
  tags: ["Auth"],
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: ForgotPasswordRequestSchema },
      },
    },
  },
  responses: {
    202: { description: "Reset link dispatched (idempotent for security)" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/reset-password",
  description: "Reset password pakai token dari /forgot-password.",
  tags: ["Auth"],
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: ResetPasswordRequestSchema },
      },
    },
  },
  responses: {
    200: { description: "Password updated" },
    400: {
      description: "Token tidak valid / sudah dipakai / expired",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/change-password",
  description: "Ganti password pakai password lama.",
  tags: ["Auth"],
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: ChangePasswordRequestSchema },
      },
    },
  },
  responses: {
    200: { description: "Password updated" },
    401: {
      description: "Password lama salah",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/2fa/setup",
  description: "Generate TOTP secret + otpauth URL untuk QR.",
  tags: ["Auth"],
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: {
      description: "Secret + otpauth URL",
      content: {
        "application/json": { schema: TwoFactorSetupResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/2fa/verify",
  description:
    "Verify TOTP code yang user input dari authenticator app, lalu enable 2FA.",
  tags: ["Auth"],
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: TwoFactorVerifyRequestSchema },
      },
    },
  },
  responses: {
    200: { description: "2FA enabled" },
    401: {
      description: "Kode salah",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/2fa/disable",
  description: "Disable 2FA. Butuh password user.",
  tags: ["Auth"],
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: TwoFactorDisableRequestSchema },
      },
    },
  },
  responses: {
    200: { description: "2FA disabled" },
    401: {
      description: "Password salah",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
