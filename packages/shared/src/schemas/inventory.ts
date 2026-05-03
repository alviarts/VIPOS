// Schema untuk endpoint /api/inventory/*

import { z, registry } from "../openapi";
import {
  DateOnlySchema,
  DateTimeStringSchema,
  ErrorResponseSchema,
} from "./common";

export const InventoryTipeSchema = z.enum(["stok_in", "stok_out", "opname"]);

export const InventoryMovementSchema = z
  .object({
    id: z.number().int().positive(),
    tanggal: z.string(),
    product_id: z.number().int().positive(),
    product_name: z.string().optional(),
    tipe: InventoryTipeSchema,
    qty: z.number().int(),
    stok_sebelum: z.number().int(),
    stok_sesudah: z.number().int(),
    keterangan: z.string().nullable(),
    user_id: z.number().int().nullable(),
    user_name: z.string().nullable().optional(),
    created_at: DateTimeStringSchema.optional(),
  })
  .openapi("InventoryMovement");
export type InventoryMovement = z.infer<typeof InventoryMovementSchema>;

export const InventoryMovementCreateSchema = z
  .object({
    tanggal: DateOnlySchema.optional(),
    product_id: z.coerce.number().int().positive(),
    tipe: InventoryTipeSchema,
    qty: z.coerce.number().int().nonnegative("Qty harus >= 0"),
    keterangan: z.string().max(512).optional().nullable(),
  })
  .openapi("InventoryMovementCreateRequest");
export type InventoryMovementCreate = z.infer<
  typeof InventoryMovementCreateSchema
>;

// --- OpenAPI path registrations -------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/inventory/movements",
  description: "List inventory movement (stok_in / stok_out / opname).",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      product_id: z.coerce.number().int().positive().optional(),
      tipe: InventoryTipeSchema.optional(),
      tanggal_from: DateOnlySchema.optional(),
      tanggal_to: DateOnlySchema.optional(),
    }),
  },
  responses: {
    200: {
      description: "Array inventory movements",
      content: {
        "application/json": { schema: z.array(InventoryMovementSchema) },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/inventory/movements",
  description: "Catat inventory movement (otomatis update stock di products).",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: InventoryMovementCreateSchema },
      },
    },
  },
  responses: {
    201: {
      description: "Movement dibuat",
      content: { "application/json": { schema: InventoryMovementSchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
