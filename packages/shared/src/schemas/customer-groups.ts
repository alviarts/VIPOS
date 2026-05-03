// Schema untuk endpoint /api/customer-groups/* dan /api/customer-tags/*

import { z, registry } from "../openapi";
import {
  DateTimeStringSchema,
  ErrorResponseSchema,
  IdStringSchema,
} from "./common";

const HexColorSchema = z
  .string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Warna harus hex (#RRGGBB)");

// --- Customer groups ------------------------------------------------------

export const CustomerGroupSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    description: z.string().nullable(),
    discount_percent: z.number().nonnegative().default(0),
    points_multiplier: z.number().nonnegative().default(1),
    color: z.string().nullable(),
    customer_count: z.number().int().nonnegative().optional(),
    created_at: DateTimeStringSchema.optional(),
  })
  .openapi("CustomerGroup");
export type CustomerGroup = z.infer<typeof CustomerGroupSchema>;

export const CustomerGroupCreateSchema = z
  .object({
    name: z.string().min(1, "Nama grup wajib diisi").max(64),
    description: z.string().max(512).optional().nullable(),
    discount_percent: z.coerce.number().min(0).max(100).optional().default(0),
    points_multiplier: z.coerce
      .number()
      .min(0)
      .max(100)
      .optional()
      .default(1),
    color: HexColorSchema.optional().nullable(),
  })
  .openapi("CustomerGroupCreateRequest");
export type CustomerGroupCreate = z.infer<typeof CustomerGroupCreateSchema>;

export const CustomerGroupUpdateSchema = CustomerGroupCreateSchema.partial()
  .openapi("CustomerGroupUpdateRequest");
export type CustomerGroupUpdate = z.infer<typeof CustomerGroupUpdateSchema>;

// --- Customer tags --------------------------------------------------------

export const CustomerTagSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    color: z.string().nullable(),
    customer_count: z.number().int().nonnegative().optional(),
    created_at: DateTimeStringSchema.optional(),
  })
  .openapi("CustomerTag");
export type CustomerTag = z.infer<typeof CustomerTagSchema>;

export const CustomerTagCreateSchema = z
  .object({
    name: z.string().min(1, "Nama tag wajib diisi").max(64),
    color: HexColorSchema.optional().nullable(),
  })
  .openapi("CustomerTagCreateRequest");
export type CustomerTagCreate = z.infer<typeof CustomerTagCreateSchema>;

export const CustomerTagUpdateSchema = CustomerTagCreateSchema.partial()
  .openapi("CustomerTagUpdateRequest");
export type CustomerTagUpdate = z.infer<typeof CustomerTagUpdateSchema>;

// --- Assignment payload ---------------------------------------------------

export const CustomerTagAssignSchema = z
  .object({
    tag_ids: z.array(z.coerce.number().int().positive()).max(32),
  })
  .openapi("CustomerTagAssignRequest");
export type CustomerTagAssign = z.infer<typeof CustomerTagAssignSchema>;

// --- OpenAPI registrations ------------------------------------------------

const json = (schema: z.ZodTypeAny) => ({
  "application/json": { schema },
});

const okMessage = z.object({ message: z.string() });

// Groups
registry.registerPath({
  method: "get",
  path: "/api/customer-groups",
  description: "List grup pelanggan dengan jumlah anggotanya.",
  tags: ["CustomerGroups"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Array grup pelanggan",
      content: json(z.array(CustomerGroupSchema)),
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/customer-groups",
  description: "Buat grup pelanggan baru.",
  tags: ["CustomerGroups"],
  security: [{ bearerAuth: [] }],
  request: { body: { required: true, content: json(CustomerGroupCreateSchema) } },
  responses: {
    201: { description: "Grup dibuat", content: json(CustomerGroupSchema) },
    400: { description: "Validation error", content: json(ErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "put",
  path: "/api/customer-groups/{id}",
  description: "Update grup pelanggan.",
  tags: ["CustomerGroups"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
    body: { required: true, content: json(CustomerGroupUpdateSchema) },
  },
  responses: {
    200: { description: "Grup ter-update", content: json(CustomerGroupSchema) },
    404: { description: "Tidak ditemukan", content: json(ErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/customer-groups/{id}",
  description: "Hapus grup pelanggan (hanya jika tidak ada anggota).",
  tags: ["CustomerGroups"],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: { description: "Berhasil", content: json(okMessage) },
    400: { description: "Masih digunakan", content: json(ErrorResponseSchema) },
  },
});

// Tags
registry.registerPath({
  method: "get",
  path: "/api/customer-tags",
  description: "List tag pelanggan.",
  tags: ["CustomerTags"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Array tag",
      content: json(z.array(CustomerTagSchema)),
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/customer-tags",
  description: "Buat tag pelanggan.",
  tags: ["CustomerTags"],
  security: [{ bearerAuth: [] }],
  request: { body: { required: true, content: json(CustomerTagCreateSchema) } },
  responses: {
    201: { description: "Tag dibuat", content: json(CustomerTagSchema) },
    400: { description: "Validation error", content: json(ErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "put",
  path: "/api/customer-tags/{id}",
  description: "Update tag pelanggan.",
  tags: ["CustomerTags"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
    body: { required: true, content: json(CustomerTagUpdateSchema) },
  },
  responses: {
    200: { description: "Tag ter-update", content: json(CustomerTagSchema) },
    404: { description: "Tidak ditemukan", content: json(ErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/customer-tags/{id}",
  description: "Hapus tag pelanggan (mapping otomatis ikut terhapus).",
  tags: ["CustomerTags"],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: { description: "Berhasil", content: json(okMessage) },
  },
});

// Customer-tag assignment + detail
registry.registerPath({
  method: "put",
  path: "/api/customers/{id}/tags",
  description: "Replace daftar tag pada satu pelanggan.",
  tags: ["Customers"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
    body: { required: true, content: json(CustomerTagAssignSchema) },
  },
  responses: {
    200: { description: "Tag tersimpan", content: json(okMessage) },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/customers/{id}/transactions",
  description: "Riwayat transaksi pelanggan.",
  tags: ["Customers"],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: "Array transaksi",
      content: json(z.array(z.record(z.unknown()))),
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/customers/export",
  description:
    "Export semua pelanggan ke CSV. Authorization required, MIME text/csv.",
  tags: ["Customers"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "CSV",
      content: { "text/csv": { schema: z.string() } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/customers/import",
  description:
    "Import pelanggan dari array baris CSV (sudah diparse di client).",
  tags: ["Customers"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: json(
        z.object({
          rows: z.array(
            z.object({
              name: z.string().min(1),
              phone: z.string().optional().nullable(),
              email: z.string().optional().nullable(),
              address: z.string().optional().nullable(),
              gender: z.enum(["L", "P"]).optional().nullable(),
              birth_date: z.string().optional().nullable(),
              group_name: z.string().optional().nullable(),
              notes: z.string().optional().nullable(),
            }),
          ),
        }),
      ),
    },
  },
  responses: {
    200: {
      description: "Hasil import",
      content: json(
        z.object({
          inserted: z.number(),
          updated: z.number(),
          skipped: z.number(),
          errors: z.array(z.object({ row: z.number(), message: z.string() })),
        }),
      ),
    },
  },
});
