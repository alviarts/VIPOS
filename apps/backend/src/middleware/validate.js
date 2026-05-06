// Zod validation middleware.
//
// Pemakaian:
//   const { validate } = require('../middleware/validate');
//   const { LoginRequestSchema } = require('@vipos/shared');
//   router.post('/login', validate({ body: LoginRequestSchema }), handler);
//
// Schema yang ter-supply akan di-`safeParse` ke `req[location]`. Kalau valid,
// nilai yang sudah di-coerce/transform di-tulis balik ke `req[location]`
// (so handler dapat akses data yang clean). Kalau invalid, balikin 400 dengan
// `details` berisi field-level error.

const ZOD_LOCATIONS = ['body', 'query', 'params'];

function formatZodError(error) {
  // `error.issues` dari Zod 3 — array of {path, message, code, ...}
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
    code: issue.code,
  }));
}

function validate(schemaMap) {
  return (req, res, next) => {
    for (const loc of ZOD_LOCATIONS) {
      const schema = schemaMap[loc];
      if (!schema) continue;
      const result = schema.safeParse(req[loc]);
      if (!result.success) {
        return res.status(400).json({
          error: 'Validation failed',
          location: loc,
          details: formatZodError(result.error),
        });
      }
      // Hindari overwrite query/params (Express read-only di sebagian versi).
      // body aman untuk overwrite. Untuk query/params, kita simpan parsed
      // value di req.validated.{loc}.
      if (loc === 'body') {
        req.body = result.data;
      } else {
        req.validated = req.validated || {};
        req.validated[loc] = result.data;
      }
    }
    next();
  };
}

module.exports = { validate };
