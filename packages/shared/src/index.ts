// VIPOS shared package — entry point.
//
// Side-effect: importing `./openapi` runs `extendZodWithOpenApi(z)` sehingga
// chain `.openapi(...)` aktif global. Importing `./schemas` register semua
// path ke registry singleton.

export { z, registry } from "./openapi";
export * from "./schemas";
export { generateOpenApiDocument } from "./openapi-spec";
