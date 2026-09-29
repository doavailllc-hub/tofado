import { randomUUID } from 'node:crypto';
export const asyncHandler = handler => (req, res, next) => Promise.resolve().then(() => handler(req, res, next)).catch(next);
export function requestContext(req, res, next) {
  const startedAt = process.hrtime.bigint();
  req.requestId = randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store');
  if (process.env.NODE_ENV === 'production') {
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      console.log(JSON.stringify({
        event: 'request_complete', requestId: req.requestId, method: req.method,
        path: req.path, status: res.statusCode, durationMs: Number(durationMs.toFixed(1)),
      }));
    });
  }
  next();
}
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.type === 'entity.too.large' ? 413
    : error.type === 'entity.parse.failed' ? 400
    : error.name === 'MulterError' ? 400
    : [400, 401, 403, 404, 409, 422, 429, 503].includes(error.status) ? error.status
    : error.code === 'ER_DUP_ENTRY' ? 409 : 500;
  const message = status === 413 ? 'Request is too large.'
    : status === 400 ? 'Invalid request or upload.'
    : status === 409 ? 'This record already exists or conflicts with another change.'
    : status >= 500 ? 'The service is temporarily unavailable. Please try again.'
    : error.message;
  console.error(JSON.stringify({ event: 'request_error', requestId: req.requestId, method: req.method, route: req.route?.path, status, code: error.code || error.name }));
  res.status(status).json({ message, request_id: req.requestId });
}

export function logFailure(event, error) {
  console.error(JSON.stringify({ event, code: error?.code || error?.name || "UNKNOWN" }));
}
