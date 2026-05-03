// Schema umum yang dipakai banyak resource (ID, error response, pagination).

import { z } from "../openapi";

// ID positif integer — untuk path param `:id`.
export const IdSchema = z
  .number()
  .int()
  .positive()
  .openapi({ example: 1, description: "Primary key (positive integer)" });

// Numeric ID dari path string (Express memberikan string).
export const IdStringSchema = z
  .string()
  .regex(/^\d+$/, "ID harus angka")
  .transform((v) => parseInt(v, 10))
  .pipe(z.number().int().positive());

// Error response konsisten di seluruh endpoint.
export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "Username atau password salah" }),
    details: z.unknown().optional(),
  })
  .openapi("ErrorResponse");

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Boolean dari berbagai bentuk (form input bisa kirim "0"/"1"/"true"/"false").
// Di-coerce ke 0/1 untuk SQLite integer column.
export const BoolIntSchema = z
  .union([z.boolean(), z.literal(0), z.literal(1), z.string()])
  .transform((v) => {
    if (v === true || v === 1 || v === "1" || v === "true") return 1 as const;
    return 0 as const;
  });

// Tanggal ISO (YYYY-MM-DD). SQLite menyimpan sebagai DATE.
export const DateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
  .openapi({ example: "2025-12-31" });

// DateTime ISO 8601 (response only — backend balikin `created_at` apa adanya
// dari SQLite, biasanya "YYYY-MM-DD HH:MM:SS").
export const DateTimeStringSchema = z.string();
