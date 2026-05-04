// Mount Swagger UI di /api/docs + raw OpenAPI spec di /api/docs.json.
// Dokumen di-generate dari registry tunggal di `@vipos/shared`. Path semua
// endpoint sudah pakai prefix `/api/v1/` per P2-07; legacy `/api/*` adalah
// alias backward-compat dan tidak di-document di sini (lihat
// `api-version.js`).

const swaggerUi = require('swagger-ui-express');
const { generateOpenApiDocument } = require('@vipos/shared');

function mountApiDocs(app) {
  const doc = generateOpenApiDocument({
    title: 'VIPOS API',
    version: '1.0.0',
    serverUrl: '/',
  });

  app.get('/api/docs.json', (req, res) => res.json(doc));
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(doc, {
      customSiteTitle: 'VIPOS API Docs (v1)',
      swaggerOptions: { persistAuthorization: true },
    })
  );
}

module.exports = { mountApiDocs };
