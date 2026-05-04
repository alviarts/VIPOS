// Schema untuk endpoint /api/v1/categories/*

import { z, registry } from "../openapi";
import {
  DateTimeStringSchema,
  ErrorResponseSchema,
  IdStringSchema,
} from "./common";

// Hex color (#RGB / #RRGGBB). Untuk button background di POS catalogue.
const HexColorSchema = z
  .string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Warna harus hex (#RRGGBB)");

export const CategorySchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    description: z.string().nullable(),
    urutan: z.number().int().default(0),
    department_id: z.number().int().nullable(),
    color: z.string().nullable(),
    icon_url: z.string().nullable(),
    is_tampil_di_menu: z.union([z.literal(0), z.literal(1)]),
    created_at: DateTimeStringSchema.optional(),
  })
  .openapi("Category");
export type Category = z.infer<typeof CategorySchema>;

export const CategoryCreateSchema = z
  .object({
    name: z.string().min(1, "Nama kategori wajib diisi").max(128),
    description: z.string().max(512).optional().nullable(),
    urutan: z.coerce.number().int().nonnegative().optional().default(0),
    department_id: z.coerce.number().int().positive().optional().nullable(),
    color: HexColorSchema.optional().nullable(),
    icon_url: z.string().max(512).optional().nullable(),
    is_tampil_di_menu: z.coerce
      .number()
      .int()
      .min(0)
      .max(1)
      .optional()
      .default(1),
  })
  .openapi("CategoryCreateRequest");
export type CategoryCreate = z.infer<typeof CategoryCreateSchema>;

export const CategoryUpdateSchema = CategoryCreateSchema.partial().openapi(
  "CategoryUpdateRequest",
);
export type CategoryUpdate = z.infer<typeof CategoryUpdateSchema>;

// --- OpenAPI path registrations -------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/v1/categories",
  description: "List semua kategori.",
  tags: ["Categories"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Array kategori",
      content: { "application/json": { schema: z.array(CategorySchema) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/categories",
  description: "Buat kategori baru (admin).",
  tags: ["Categories"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: CategoryCreateSchema } },
    },
  },
  responses: {
    201: {
      description: "Kategori dibuat",
      content: { "application/json": { schema: CategorySchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/api/v1/categories/{id}",
  description: "Update kategori (admin).",
  tags: ["Categories"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      required: true,
      content: { "application/json": { schema: CategoryUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: "Kategori ter-update",
      content: { "application/json": { schema: CategorySchema } },
    },
    404: {
      description: "Kategori tidak ditemukan",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/categories/{id}",
  description: "Hapus kategori (admin).",
  tags: ["Categories"],
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
    404: {
      description: "Tidak ditemukan",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
