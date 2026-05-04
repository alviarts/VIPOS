// VIPOS — API versioning utilities (P2-07).
//
// Strategy:
//   - Canonical API path is `/api/v{N}/...`. Current version: v1.
//   - Legacy unversioned path `/api/...` is kept as a backward-compat alias to
//     `/api/v1/...`. Requests served via the alias receive `Deprecation`,
//     `Sunset`, and `Link: rel="successor-version"` response headers per
//     RFC 8594 + draft-ietf-httpapi-deprecation-header so that clients can
//     detect the deprecation programmatically.
//   - When the sunset date passes, the alias should be removed in a follow-up.
//
// Usage:
//   const { LEGACY_SUNSET, legacyDeprecationMiddleware } = require('./api-version');
//   app.use('/api', legacyDeprecationMiddleware({ successorPrefix: '/api/v1' }), legacyRouter);

/**
 * Sunset date for the unversioned `/api/*` alias. Six months out from
 * P2-07 merge gives integrators a comfortable migration window. Format is
 * IMF-fixdate (RFC 7231 §7.1.1.1).
 */
const LEGACY_SUNSET = "Wed, 04 Nov 2026 23:59:59 GMT";

/**
 * Build a middleware that tags responses with deprecation headers and
 * advertises the canonical successor URL.
 *
 * Skips paths that are not part of the deprecation surface (Swagger UI,
 * OpenAPI JSON, health probe).
 *
 * @param {object} [opts]
 * @param {string} [opts.successorPrefix] absolute prefix the canonical URL
 *   lives under, e.g. `/api/v1`. Defaults to `/api/v1`.
 * @param {string} [opts.sunset] IMF-fixdate string for the `Sunset` header.
 * @returns {import('express').RequestHandler}
 */
function legacyDeprecationMiddleware({
  successorPrefix = "/api/v1",
  sunset = LEGACY_SUNSET,
} = {}) {
  return function legacyDeprecation(req, res, next) {
    // Inside a router mounted at `/api`, req.path is the part after `/api`.
    const p = req.path || "/";

    // Skip non-versioned utility endpoints + already-versioned paths.
    if (
      p === "/health" ||
      p.startsWith("/health/") ||
      p === "/docs" ||
      p.startsWith("/docs/") ||
      p === "/docs.json" ||
      p === "/v1" ||
      p.startsWith("/v1/")
    ) {
      return next();
    }

    res.setHeader("Deprecation", "true");
    res.setHeader("Sunset", sunset);
    res.setHeader(
      "Link",
      `<${successorPrefix}${p}>; rel="successor-version"`,
    );
    next();
  };
}

module.exports = { LEGACY_SUNSET, legacyDeprecationMiddleware };
