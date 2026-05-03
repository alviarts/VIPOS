// Setup `@asteasolutions/zod-to-openapi` extensions sekali di entry shared
// package, supaya semua file schema bisa pakai `.openapi(...)` chain.
//
// File ini di-load via side-effect dari `src/index.ts`. Harus jadi import
// pertama sebelum file schema apapun.

import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

// Singleton registry — semua schema didaftar di sini supaya bisa di-emit ke
// dokumen OpenAPI tunggal.
export const registry = new OpenAPIRegistry();

export { z };
