import { AppError, MESSAGES } from '../lib/errors.js';
import { userForToken } from '../services/auth.js';
import { PRODUCTION } from '../config.js';

export const tokenOf = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

/** Attach req.user when a valid token is sent (optional auth). */
export function identify(req, _res, next) {
  req.user = userForToken(tokenOf(req));
  next();
}

/** Require one of the given roles. */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new AppError('UNAUTHORIZED', 401));
  if (roles.length && !roles.includes(req.user.role)) return next(new AppError('FORBIDDEN', 403));
  next();
};

export function getClientIp(req) {
  try {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) return String(forwarded).split(',')[0].trim();
    const realIp = req.headers?.['x-real-ip'];
    if (realIp) return String(realIp).trim();
    if (req.socket?.remoteAddress) return req.socket.remoteAddress;
    return '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

/** Small in-memory limiter for login and sign-up (per IP). */
export function rateLimit({ windowMs = 10 * 60_000, max = 20 } = {}) {
  const hits = new Map();
  return (req, _res, next) => {
    const key = getClientIp(req);
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) hits.set(key, { n: 1, reset: now + windowMs });
    else if (++h.n > max) return next(new AppError('TOO_MANY', 429));
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    next();
  };
}

export function securityHeaders(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  if (PRODUCTION) {
    if (req.headers['x-forwarded-proto'] === 'http') return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, code: err.code, params: err.params });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: MESSAGES.IMAGE_INVALID, code: 'IMAGE_INVALID', params: {} });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: MESSAGES.BAD_REQUEST, code: 'BAD_REQUEST', params: {} });
  }
  console.error(err);
  res.status(500).json({ error: MESSAGES.SERVER, code: 'SERVER', params: {} });
}
