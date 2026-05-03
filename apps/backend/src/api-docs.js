// Mount Swagger UI di /api/docs (dev) + serve raw OpenAPI spec di
// /api/docs.json. Dokumen di-generate dari `@vipos/shared` registry.

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
      customSiteTitle: 'VIPOS API Docs',
      swaggerOptions: { persistAuthorization: true },
    })
  );
}

module.exports = { mountApiDocs };
