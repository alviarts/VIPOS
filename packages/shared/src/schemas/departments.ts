// Schema untuk endpoint /api/departments/*.
//
// Departemen = grup di atas kategori (misal Departemen "Beverages" → kategori
// "Coffee", "Tea", "Juice"). Diperkenalkan di P1-05 sebagai master data
// di Penjualan group.

import { z, registry } from "../openapi";
import {
  DateTimeStringSchema,
  ErrorResponseSchema,
  IdStringSchema,
} from "./common";

export const DepartmentSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    description: z.string().nullable(),
    urutan: z.number().int().default(0),
    is_active: z.union([z.literal(0), z.literal(1)]),
    category_count: z.number().int().nonnegative().optional(),
    created_at: DateTimeStringSchema.optional(),
  })
  .openapi("Department");
export type Department = z.infer<typeof DepartmentSchema>;

export const DepartmentCreateSchema = z
  .object({
    name: z.string().min(1, "Nama departemen wajib diisi").max(128),
    description: z.string().max(512).optional().nullable(),
    urutan: z.coerce.number().int().nonnegative().optional().default(0),
    is_active: z.coerce
      .number()
      .int()
      .min(0)
      .max(1)
      .optional()
      .default(1),
  })
  .openapi("DepartmentCreateRequest");
export type DepartmentCreate = z.infer<typeof DepartmentCreateSchema>;

export const DepartmentUpdateSchema = DepartmentCreateSchema.partial().openapi(
  "DepartmentUpdateRequest",
);
export type DepartmentUpdate = z.infer<typeof DepartmentUpdateSchema>;

// Reorder payload: list of department IDs in new order. Server akan assign
// `urutan = index` (0-based) ke tiap ID. ID yang tidak ada di array tidak
// diubah.
export const DepartmentReorderSchema = z
  .object({
    ids: z
      .array(z.number().int().positive())
      .min(1, "Minimal 1 ID")
      .max(500),
  })
  .openapi("DepartmentReorderRequest");
export type DepartmentReorder = z.infer<typeof DepartmentReorderSchema>;

// Reorder kategori dalam departemen tertentu (atau pindah ke departemen lain).
// `department_id = null` = pindahkan ke "Tanpa Departemen".
export const CategoryReorderSchema = z
  .object({
    ids: z
      .array(z.number().int().positive())
      .min(1, "Minimal 1 ID")
      .max(500),
    department_id: z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .nullable(),
  })
  .openapi("CategoryReorderRequest");
export type CategoryReorder = z.infer<typeof CategoryReorderSchema>;

// --- OpenAPI path registrations -------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/departments",
  description: "List semua departemen, urut by urutan ASC, name ASC.",
  tags: ["Departments"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Array departemen",
      content: { "application/json": { schema: z.array(DepartmentSchema) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/departments",
  description: "Buat departemen baru (admin).",
  tags: ["Departments"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: DepartmentCreateSchema } },
    },
  },
  responses: {
    201: {
      description: "Departemen dibuat",
      content: { "application/json": { schema: DepartmentSchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/api/departments/{id}",
  description: "Update departemen (admin).",
  tags: ["Departments"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      required: true,
      content: { "application/json": { schema: DepartmentUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: "Departemen ter-update",
      content: { "application/json": { schema: DepartmentSchema } },
    },
    404: {
      description: "Tidak ditemukan",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/departments/{id}",
  description: "Hapus departemen (admin). Gagal kalau masih dipakai kategori.",
  tags: ["Departments"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
  },
  responses: {
    200: {
      description: "Sukses dihapus",
      content: {
        "application/json": { schema: z.object({ message: z.string() }) },
      },
    },
    400: {
      description: "Masih dipakai kategori",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/departments/reorder",
  description:
    "Reorder departemen dalam batch (admin). Server set `urutan = index` ke tiap ID.",
  tags: ["Departments"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: DepartmentReorderSchema } },
    },
  },
  responses: {
    200: {
      description: "Sukses reorder",
      content: {
        "application/json": {
          schema: z.object({ message: z.string(), updated: z.number() }),
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
  method: "post",
  path: "/api/categories/reorder",
  description:
    "Reorder kategori dalam batch (admin). Bisa juga move ke departemen lain dengan field `department_id`.",
  tags: ["Categories"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: CategoryReorderSchema } },
    },
  },
  responses: {
    200: {
      description: "Sukses reorder",
      content: {
        "application/json": {
          schema: z.object({ message: z.string(), updated: z.number() }),
        },
      },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
