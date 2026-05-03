// Schema untuk endpoint /api/inventory/*

import { z, registry } from "../openapi";
import {
  DateOnlySchema,
  DateTimeStringSchema,
  ErrorResponseSchema,
} from "./common";

export const InventoryTipeSchema = z.enum(["stok_in", "stok_out", "opname"]);

export const InventoryReasonSchema = z
  .enum(["damaged", "expired", "shrinkage", "production", "manual", "other"])
  .openapi("InventoryReason");

export const InventoryMovementSchema = z
  .object({
    id: z.number().int().positive(),
    tanggal: z.string(),
    product_id: z.number().int().positive(),
    product_name: z.string().optional(),
    product_sku: z.string().nullable().optional(),
    product_satuan: z.string().nullable().optional(),
    tipe: InventoryTipeSchema,
    qty: z.number().int(),
    stok_sebelum: z.number().int(),
    stok_sesudah: z.number().int(),
    unit_cost: z.number().nullable().optional(),
    reason: z.string().nullable().optional(),
    ref_type: z.string().nullable().optional(),
    ref_id: z.number().int().nullable().optional(),
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
    unit_cost: z.coerce.number().nonnegative().optional().nullable(),
    reason: InventoryReasonSchema.optional().nullable(),
    keterangan: z.string().max(512).optional().nullable(),
  })
  .openapi("InventoryMovementCreateRequest");
export type InventoryMovementCreate = z.infer<
  typeof InventoryMovementCreateSchema
>;

// --- Stock opname ----------------------------------------------------------

export const StockOpnameStatusSchema = z
  .enum(["draft", "final", "cancelled"])
  .openapi("StockOpnameStatus");

export const StockOpnameItemSchema = z
  .object({
    id: z.number().int().positive(),
    opname_id: z.number().int().positive(),
    product_id: z.number().int().positive(),
    product_name: z.string().optional(),
    product_sku: z.string().nullable().optional(),
    product_satuan: z.string().nullable().optional(),
    qty_sistem: z.number().int(),
    qty_fisik: z.number().int().nullable(),
    selisih: z.number().int().optional(),
    catatan: z.string().nullable().optional(),
  })
  .openapi("StockOpnameItem");
export type StockOpnameItem = z.infer<typeof StockOpnameItemSchema>;

export const StockOpnameSchema = z
  .object({
    id: z.number().int().positive(),
    kode: z.string(),
    tanggal: z.string(),
    status: StockOpnameStatusSchema,
    catatan: z.string().nullable().optional(),
    created_by: z.number().int().nullable().optional(),
    created_by_name: z.string().nullable().optional(),
    finalized_by: z.number().int().nullable().optional(),
    finalized_by_name: z.string().nullable().optional(),
    finalized_at: z.string().nullable().optional(),
    created_at: DateTimeStringSchema.optional(),
    updated_at: DateTimeStringSchema.optional(),
    item_count: z.number().int().optional(),
    counted_count: z.number().int().optional(),
    variance_count: z.number().int().optional(),
    items: z.array(StockOpnameItemSchema).optional(),
  })
  .openapi("StockOpname");
export type StockOpname = z.infer<typeof StockOpnameSchema>;

export const StockOpnameCreateSchema = z
  .object({
    tanggal: DateOnlySchema.optional(),
    catatan: z.string().max(512).optional().nullable(),
    product_ids: z.array(z.coerce.number().int().positive()).optional(),
  })
  .openapi("StockOpnameCreateRequest");
export type StockOpnameCreate = z.infer<typeof StockOpnameCreateSchema>;

export const StockOpnameItemUpdateSchema = z
  .object({
    product_id: z.coerce.number().int().positive(),
    qty_fisik: z.coerce.number().int().nonnegative().nullable(),
    catatan: z.string().max(255).optional().nullable(),
  })
  .openapi("StockOpnameItemUpdate");
export type StockOpnameItemUpdate = z.infer<typeof StockOpnameItemUpdateSchema>;

export const StockOpnameUpdateSchema = z
  .object({
    catatan: z.string().max(512).optional().nullable(),
    items: z.array(StockOpnameItemUpdateSchema).optional(),
  })
  .openapi("StockOpnameUpdateRequest");
export type StockOpnameUpdate = z.infer<typeof StockOpnameUpdateSchema>;

export const StockOpnameFinalizeSchema = z
  .object({
    confirm: z.literal(true),
  })
  .openapi("StockOpnameFinalizeRequest");
export type StockOpnameFinalize = z.infer<typeof StockOpnameFinalizeSchema>;

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

registry.registerPath({
  method: "get",
  path: "/api/inventory/movements/{product_id}",
  description: "Riwayat pergerakan stok per produk.",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      product_id: z.coerce.number().int().positive(),
    }),
    query: z.object({
      limit: z.coerce.number().int().min(1).max(500).optional(),
    }),
  },
  responses: {
    200: {
      description: "Movement history",
      content: {
        "application/json": { schema: z.array(InventoryMovementSchema) },
      },
    },
  },
});

// --- Stock opname endpoints -----------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/stock-opname",
  description: "List opname (draft + final).",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      status: StockOpnameStatusSchema.optional(),
    }),
  },
  responses: {
    200: {
      description: "Array opname (header only)",
      content: {
        "application/json": { schema: z.array(StockOpnameSchema) },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/stock-opname",
  description:
    "Buat opname baru (draft). Jika product_ids kosong, semua produk monitor_stok=1 disertakan.",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: StockOpnameCreateSchema },
      },
    },
  },
  responses: {
    201: {
      description: "Opname draft dibuat",
      content: { "application/json": { schema: StockOpnameSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/stock-opname/{id}",
  description: "Detail opname (header + items).",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    200: {
      description: "Opname detail",
      content: { "application/json": { schema: StockOpnameSchema } },
    },
    404: {
      description: "Tidak ditemukan",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/api/stock-opname/{id}",
  description: "Update qty_fisik untuk item-item opname (hanya saat status=draft).",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
    body: {
      required: true,
      content: {
        "application/json": { schema: StockOpnameUpdateSchema },
      },
    },
  },
  responses: {
    200: {
      description: "Opname diupdate",
      content: { "application/json": { schema: StockOpnameSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/stock-opname/{id}/finalize",
  description:
    "Finalize opname → posting OPNAME_ADJUST movements untuk setiap item dengan selisih ≠ 0; status menjadi final.",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
    body: {
      required: true,
      content: {
        "application/json": { schema: StockOpnameFinalizeSchema },
      },
    },
  },
  responses: {
    200: {
      description: "Opname difinalisasi",
      content: { "application/json": { schema: StockOpnameSchema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/stock-opname/{id}",
  description: "Cancel opname draft (tidak boleh kalau status=final).",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    204: { description: "Dihapus" },
    400: {
      description: "Status final tidak boleh dihapus",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
