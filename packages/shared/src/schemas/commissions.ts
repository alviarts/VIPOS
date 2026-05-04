// Schema untuk /api/v1/commission-group + /api/v1/commission-assignment + /api/v1/commission-report
// Komisi: fixed atau tiered, opsional scoping per role/employee + per product/category.

import { z, registry } from "../openapi";
import {
  DateTimeStringSchema,
  ErrorResponseSchema,
  IdStringSchema,
} from "./common";

export const CommissionTypeSchema = z.enum(["FIXED", "TIERED"]).openapi({
  description: "FIXED = nominal flat, TIERED = persentase berjenjang per range",
});

export const CommissionAmountBasisSchema = z
  .enum(["PER_TRANSACTION", "PER_ITEM"])
  .openapi({
    description:
      "PER_TRANSACTION: amount × jumlah transaksi qualifying. PER_ITEM: amount × qty produk qualifying.",
  });

export const CommissionAppliesToScopeSchema = z
  .enum(["all", "roles", "employees"])
  .openapi({
    description:
      "Scope karyawan: all=semua karyawan, roles=role tertentu, employees=user_id tertentu.",
  });

export const CommissionAppliesToProductsScopeSchema = z
  .enum(["all", "categories", "products"])
  .openapi({
    description:
      "Scope produk: all=semua, categories=daftar category id, products=daftar product id.",
  });

export const CommissionCalcPeriodSchema = z
  .enum(["DAY", "WEEK", "MONTH"])
  .openapi({
    description:
      "Periode kalkulasi untuk TIERED (cumulative basis di-reset tiap periode).",
  });

export const CommissionTierSchema = z
  .object({
    from: z.number().nonnegative(),
    to: z.number().nonnegative().nullable().optional(),
    percentage: z.number().min(0).max(100),
  })
  .openapi("CommissionTier");
export type CommissionTier = z.infer<typeof CommissionTierSchema>;

export const CommissionGroupSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    description: z.string().nullable().optional(),
    type: CommissionTypeSchema,
    applies_to_scope: CommissionAppliesToScopeSchema,
    applies_to_role_keys: z.array(z.string()).nullable().optional(),
    applies_to_employee_ids: z.array(z.number().int().positive()).nullable().optional(),
    applies_to_products_scope: CommissionAppliesToProductsScopeSchema,
    applies_to_category_ids: z
      .array(z.number().int().positive())
      .nullable()
      .optional(),
    applies_to_product_ids: z
      .array(z.number().int().positive())
      .nullable()
      .optional(),
    amount: z.number().nullable().optional(),
    amount_basis: CommissionAmountBasisSchema,
    tiers: z.array(CommissionTierSchema).nullable().optional(),
    calc_period: CommissionCalcPeriodSchema,
    is_active: z.union([z.literal(0), z.literal(1), z.boolean()]),
    created_at: DateTimeStringSchema.optional(),
    updated_at: DateTimeStringSchema.optional(),
  })
  .openapi("CommissionGroup");
export type CommissionGroup = z.infer<typeof CommissionGroupSchema>;

const baseGroupCreate = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  type: CommissionTypeSchema,
  applies_to_scope: CommissionAppliesToScopeSchema.default("all"),
  applies_to_role_keys: z.array(z.string().min(1)).optional().nullable(),
  applies_to_employee_ids: z
    .array(z.number().int().positive())
    .optional()
    .nullable(),
  applies_to_products_scope: CommissionAppliesToProductsScopeSchema.default("all"),
  applies_to_category_ids: z
    .array(z.number().int().positive())
    .optional()
    .nullable(),
  applies_to_product_ids: z
    .array(z.number().int().positive())
    .optional()
    .nullable(),
  amount: z.number().nonnegative().optional().nullable(),
  amount_basis: CommissionAmountBasisSchema.default("PER_TRANSACTION"),
  tiers: z.array(CommissionTierSchema).optional().nullable(),
  calc_period: CommissionCalcPeriodSchema.default("MONTH"),
  is_active: z.boolean().default(true),
});

export const CommissionGroupCreateSchema = baseGroupCreate.openapi(
  "CommissionGroupCreate",
);
export type CommissionGroupCreate = z.infer<typeof CommissionGroupCreateSchema>;

export const CommissionGroupUpdateSchema = baseGroupCreate
  .partial()
  .openapi("CommissionGroupUpdate");
export type CommissionGroupUpdate = z.infer<typeof CommissionGroupUpdateSchema>;

export const CommissionAssignmentSchema = z
  .object({
    id: z.number().int().positive(),
    transaction_id: z.number().int().positive(),
    employee_id: z.number().int().positive(),
    employee_name: z.string().nullable().optional(),
    commission_group_id: z.number().int().positive(),
    commission_group_name: z.string().nullable().optional(),
    basis_amount: z.number().nonnegative(),
    basis_qty: z.number().int().nonnegative(),
    computed_amount: z.number().nonnegative(),
    tier_percentage: z.number().nullable().optional(),
    period_key: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    invoice_number: z.string().nullable().optional(),
    transaction_total: z.number().nullable().optional(),
    created_at: DateTimeStringSchema.optional(),
  })
  .openapi("CommissionAssignment");
export type CommissionAssignment = z.infer<typeof CommissionAssignmentSchema>;

export const CommissionAssignmentCreateSchema = z
  .object({
    transaction_id: z.number().int().positive(),
    employee_id: z.number().int().positive(),
    commission_group_ids: z
      .array(z.number().int().positive())
      .optional()
      .openapi({
        description:
          "Optional. Kalau kosong, backend pilih semua group active yang qualifying.",
      }),
    notes: z.string().max(255).optional().nullable(),
  })
  .openapi("CommissionAssignmentCreate");
export type CommissionAssignmentCreate = z.infer<
  typeof CommissionAssignmentCreateSchema
>;

export const CommissionReportRowSchema = z
  .object({
    employee_id: z.number().int().positive(),
    employee_name: z.string().nullable().optional(),
    period_key: z.string(),
    transaction_count: z.number().int().nonnegative(),
    total_basis: z.number().nonnegative(),
    total_commission: z.number().nonnegative(),
  })
  .openapi("CommissionReportRow");
export type CommissionReportRow = z.infer<typeof CommissionReportRowSchema>;

export const CommissionReportResponseSchema = z
  .object({
    rows: z.array(CommissionReportRowSchema),
    total_commission: z.number().nonnegative(),
  })
  .openapi("CommissionReportResponse");

// === OpenAPI registry ===

const tag = "Commissions";

registry.registerPath({
  method: "get",
  path: "/api/v1/commission-group",
  tags: [tag],
  summary: "Daftar grup komisi",
  request: {
    query: z.object({
      is_active: z.enum(["0", "1"]).optional(),
      type: CommissionTypeSchema.optional(),
    }),
  },
  responses: {
    200: {
      description: "List of commission groups",
      content: { "application/json": { schema: z.array(CommissionGroupSchema) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/commission-group",
  tags: [tag],
  summary: "Buat grup komisi",
  request: {
    body: {
      content: { "application/json": { schema: CommissionGroupCreateSchema } },
    },
  },
  responses: {
    201: {
      description: "Created",
      content: { "application/json": { schema: CommissionGroupSchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/api/v1/commission-group/{id}",
  tags: [tag],
  summary: "Update grup komisi",
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      content: { "application/json": { schema: CommissionGroupUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: "Updated",
      content: { "application/json": { schema: CommissionGroupSchema } },
    },
    404: {
      description: "Not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/commission-group/{id}",
  tags: [tag],
  summary: "Hapus grup komisi",
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: "Deleted",
      content: {
        "application/json": { schema: z.object({ id: z.number().int() }) },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/commission-assignment",
  tags: [tag],
  summary: "List per-transaction commission assignments",
  request: {
    query: z.object({
      employee_id: z.string().optional(),
      transaction_id: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "List assignments",
      content: {
        "application/json": {
          schema: z.object({
            items: z.array(CommissionAssignmentSchema),
            total: z.number().int().nonnegative(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/commission-assignment",
  tags: [tag],
  summary: "Tag karyawan ke transaksi (auto-compute commission per group qualifying)",
  request: {
    body: {
      content: {
        "application/json": { schema: CommissionAssignmentCreateSchema },
      },
    },
  },
  responses: {
    201: {
      description: "Created assignments",
      content: {
        "application/json": {
          schema: z.object({
            assignments: z.array(CommissionAssignmentSchema),
            total_commission: z.number().nonnegative(),
          }),
        },
      },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/commission-assignment/{id}",
  tags: [tag],
  summary: "Untag (hapus assignment)",
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: "Deleted",
      content: {
        "application/json": { schema: z.object({ id: z.number().int() }) },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/commission-report",
  tags: [tag],
  summary: "Aggregate commission per employee per period",
  request: {
    query: z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      employee_id: z.string().optional(),
      group_by: z.enum(["DAY", "WEEK", "MONTH"]).optional(),
    }),
  },
  responses: {
    200: {
      description: "Report aggregates",
      content: {
        "application/json": { schema: CommissionReportResponseSchema },
      },
    },
  },
});
