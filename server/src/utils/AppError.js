/**
 * Operational error with a stable, client-safe error code.
 *
 * Only the `code` and `message` are ever sent to the client, so internal
 * details (stack traces, binary paths) never leak.
 */
export class AppError extends Error {
  /**
   * @param {string} code machine readable code, e.g. `UNSUPPORTED_URL`
   * @param {string} message human readable, safe to display
   * @param {number} status HTTP status code
   * @param {object} [options]
   * @param {unknown} [options.cause] original error for logging
   * @param {Record<string, unknown>} [options.details] extra safe context
   */
  constructor(code, message, status = 400, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = options.details;
    this.expected = options.expected ?? status < 500;
    Error.captureStackTrace?.(this, AppError);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }

  static from(error, fallbackCode = 'INTERNAL_ERROR', fallbackMessage = 'An unexpected error occurred.') {
    if (error instanceof AppError) return error;
    return new AppError(fallbackCode, fallbackMessage, 500, { cause: error, expected: false });
  }
}

export default AppError;
