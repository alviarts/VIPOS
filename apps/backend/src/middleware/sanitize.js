// VIPOS — Input sanitization middleware.
//
// Strips HTML tags and dangerous characters from string fields
// in request bodies to prevent stored XSS. Applied globally
// before route handlers.
//
// Does NOT sanitize:
//  - Non-string fields (numbers, booleans, arrays, objects)
//  - Fields explicitly whitelisted (e.g. rich-text content)
//  - Query parameters (handled separately per-route)

/**
 * Recursively sanitize all string values in an object.
 * Strips HTML tags and trims whitespace.
 */
function sanitizeValue(value) {
  if (typeof value === 'string') {
    return value
      .replace(/<[^>]*>/g, '') // Strip HTML tags
      .replace(/[<>]/g, '')    // Remove stray angle brackets
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    return sanitizeObject(value);
  }
  return value;
}

function sanitizeObject(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = sanitizeValue(value);
  }
  return result;
}

/**
 * Express middleware that sanitizes req.body string fields.
 */
function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

module.exports = { sanitizeBody, sanitizeValue, sanitizeObject };
