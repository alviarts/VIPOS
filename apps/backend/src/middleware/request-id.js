// P2-05 PR-A — request id middleware.
//
// Reads an incoming `X-Request-ID` header (case-insensitive) and reuses
// it as the request correlation id. If absent, generates a UUIDv4. The
// id is exposed both as `req.id` (consumed by pino-http via genReqId)
// and echoed back as the `X-Request-ID` response header so callers can
// trace requests end-to-end.

const { v4: uuidv4 } = require('uuid');

const HEADER_IN = 'x-request-id';
const HEADER_OUT = 'X-Request-ID';

// Restrict accepted incoming ids to printable ASCII without control or
// quoting characters. Anything else is dropped and a fresh UUID is
// generated. This avoids log-injection vectors via attacker-controlled
// header values.
const SAFE_RE = /^[A-Za-z0-9._:-]{1,128}$/;

function requestIdMiddleware(req, res, next) {
  const incoming = req.headers[HEADER_IN];
  const id = typeof incoming === 'string' && SAFE_RE.test(incoming) ? incoming : uuidv4();
  req.id = id;
  res.setHeader(HEADER_OUT, id);
  next();
}

module.exports = {
  requestIdMiddleware,
  HEADER_IN,
  HEADER_OUT,
};
