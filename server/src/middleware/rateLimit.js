import rateLimit from 'express-rate-limit';
import config from '../config.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

const jsonError = (code, message, status = 429, retryAfter) => {
  const error = new AppError(code, message, status);
  if (retryAfter) error.details = { retryAfterSeconds: retryAfter };
  return error;
};

const handlerFor = (code, message) => (req, res, next) => {
  const retryAfter = Number.parseInt(res.getHeader('Retry-After'), 10);
  logger.warn('rate limit exceeded', { path: req.path, ip: req.ip });
  next(jsonError(code, message, 429, Number.isFinite(retryAfter) ? retryAfter : undefined));
};

const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Behind a proxy (a CDN, a tunnel, nginx) every request carries
  // X-Forwarded-For. With `trust proxy` off, express-rate-limit logs a
  // ERR_ERL_UNEXPECTED_X_FORWARDED_FOR stack trace per request and counts by the
  // proxy's address, which shares one bucket across all visitors. The request
  // still succeeds, so this is not a failure mode on its own: silencing the
  // trace only keeps the log readable. Actually identifying a client behind a
  // proxy needs TRUST_PROXY=true, which Go Live.bat sets because it always
  // starts the tunnel.
  validate: config.trustProxy
    ? undefined
    : { xForwardedForHeader: false, trustProxy: false },
  // The download endpoint streams a response body; the limiter must not hold
  // the connection open, so failed counts are forwarded to the next handler.
  handler: handlerFor('RATE_LIMITED', 'Too many requests. Please wait a moment and try again.'),
};

/** Metadata analysis: moderate limit. */
export const analyzeLimiter = rateLimit({
  ...base,
  windowMs: config.rateLimit.analyzeWindowMs,
  limit: config.rateLimit.analyze,
  handler: handlerFor('RATE_LIMITED', 'Analysis limit reached. Please wait a few minutes before analyzing more links.'),
});

/** Downloads: stricter limit because each request spawns a yt-dlp process. */
export const downloadLimiter = rateLimit({
  ...base,
  windowMs: config.rateLimit.downloadWindowMs,
  limit: config.rateLimit.download,
  handler: handlerFor('RATE_LIMITED', 'Download limit reached. Please wait a few minutes before downloading again.'),
});

/** Everything else under /api. */
export const apiLimiter = rateLimit({
  ...base,
  windowMs: config.rateLimit.apiWindowMs,
  limit: config.rateLimit.api,
});

/**
 * Progress polling for a running download.
 *
 * It gets its own budget because it is not a request a person makes: the client
 * polls roughly every 1.2 seconds for the whole length of a transfer, so a
 * single 20 minute download is around a thousand calls. Under the general API
 * ceiling those started returning 429 partway through a download, and the log
 * showed it plainly — a burst of `RATE_LIMITED` on /api/download/status right
 * before a transfer failed. The progress bar simply stopped reporting on long
 * downloads, which is exactly when a reader most needs to see that something is
 * still happening.
 *
 * The endpoint only reads an in-memory record, so a ceiling high enough for a
 * long download is cheap.
 */
export const statusLimiter = rateLimit({
  ...base,
  windowMs: config.rateLimit.statusWindowMs,
  limit: config.rateLimit.status,
  handler: handlerFor('RATE_LIMITED', 'Too many progress checks. Please wait a moment.'),
});

/** Cheap in-memory guard for the health endpoint so it cannot be abused. */
export const healthLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 60,
  handler: handlerFor('RATE_LIMITED', 'Health check rate limit exceeded.'),
});

if (config.trustProxy) {
  logger.warn('trust proxy enabled — ensure requests come from your own reverse proxy');
}

if (config.trustProxy === false) {
  // Every limiter here counts by client IP, so this is worth saying out loud
  // rather than leaving to be discovered in production.
  logger.warn(
    'TRUST_PROXY is off. Behind a reverse proxy every visitor counts as the proxy, so the first few users exhaust the shared bucket and everyone else is rate limited. Set TRUST_PROXY=true when deploying behind nginx, Caddy or a CDN.',
  );
}

export { jsonError };
