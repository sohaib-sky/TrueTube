import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import config from '../config.js';

/** Wrap an async controller so rejections flow into `errorHandler`. */
export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const notFoundHandler = (req, res, next) => {
  next(new AppError('NOT_FOUND', 'The requested endpoint does not exist.', 404));
};

/** Convert a zod failure into the standard error envelope. */
function fromZod(error) {
  const issue = error?.issues?.[0];
  const field = issue?.path?.join('.') || 'request';
  return new AppError('VALIDATION_ERROR', issue?.message || 'The request payload is invalid.', 400, {
    details: { field },
  });
}

export function errorHandler(error, req, res, next) {
  let appError;

  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof ZodError) {
    appError = fromZod(error);
  } else if (error?.type === 'entity.too.large') {
    appError = new AppError('PAYLOAD_TOO_LARGE', 'The request payload is too large.', 413);
  } else if (error?.type === 'entity.parse.failed') {
    appError = new AppError('INVALID_JSON', 'The request body is not valid JSON.', 400);
  } else {
    appError = new AppError('INTERNAL_ERROR', 'Something went wrong on our side. Please try again.', 500, {
      cause: error,
    });
  }

  if (appError.status >= 500) {
    logger.error('request failed', {
      code: appError.code,
      status: appError.status,
      method: req.method,
      path: req.path,
      reason: appError.cause?.message,
    });
  } else {
    logger.warn('request rejected', { code: appError.code, status: appError.status, method: req.method, path: req.path });
  }

  if (res.headersSent) {
    res.end();
    return;
  }

  const body = appError.toJSON();

  if (!config.isProduction && appError.cause) {
    // Development-only diagnostics. Never sent in production.
    body.error.reason = appError.cause.code || appError.cause.message;
  }

  res.status(appError.status).json(body);
}
