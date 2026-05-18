// VIPOS — Standardized response helpers.
//
// Ensures consistent JSON response shapes across all routes.
// Every success/error response follows the same contract so
// the Android client can parse them uniformly.

/**
 * Send a success response with data.
 * Shape: { success: true, data: ... }
 */
function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    ...data,
  });
}

/**
 * Send a created response (201).
 * Shape: { success: true, data: ... }
 */
function sendCreated(res, data) {
  return sendSuccess(res, data, 201);
}

/**
 * Send an error response.
 * Shape: { success: false, error: message, code?: string }
 */
function sendError(res, message, statusCode = 400, code = undefined) {
  const body = { success: false, error: message };
  if (code) body.code = code;
  return res.status(statusCode).json(body);
}

/**
 * Send a 404 not found response.
 */
function sendNotFound(res, message = 'Resource tidak ditemukan') {
  return sendError(res, message, 404, 'NOT_FOUND');
}

/**
 * Send a 409 conflict response.
 */
function sendConflict(res, message, code) {
  return sendError(res, message, 409, code);
}

/**
 * Send a 500 internal server error.
 */
function sendServerError(res, message = 'Terjadi kesalahan server') {
  return sendError(res, message, 500, 'INTERNAL_ERROR');
}

/**
 * Send a 403 forbidden response.
 */
function sendForbidden(res, message = 'Akses ditolak') {
  return sendError(res, message, 403, 'FORBIDDEN');
}

module.exports = {
  sendSuccess,
  sendCreated,
  sendError,
  sendNotFound,
  sendConflict,
  sendServerError,
  sendForbidden,
};
