// Generator dokumen OpenAPI 3.1 dari registry tunggal.
//
// Pemakaian:
//   const { generateOpenApiDocument } = require('@vipos/shared');
//   const doc = generateOpenApiDocument();
//   res.json(doc);

import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { registry } from './openapi';
// Side-effect import: pastikan semua schema sudah di-register.
import './schemas';

export interface GenerateOptions {
  /** Versi API. Default: 1.0.0 */
  version?: string;
  /** Title doc. Default: VIPOS API */
  title?: string;
  /** Server URL prefix (untuk Swagger UI "Try it out"). Default: '/' */
  serverUrl?: string;
}

export function generateOpenApiDocument(opts: GenerateOptions = {}) {
  const { version = '1.0.0', title = 'VIPOS API', serverUrl = '/' } = opts;
  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      version,
      title,
      description:
        'Auto-generated dari Zod schemas di `@vipos/shared`. Endpoint dilindungi JWT (kecuali POST /auth/login).',
    },
    servers: [{ url: serverUrl }],
  });
}
