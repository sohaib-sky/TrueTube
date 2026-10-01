/**
 * Minimal, dependency-free logger.
 *
 * Emits human readable lines in development and single-line JSON in
 * production so a log aggregator can parse it. Levels are controlled by
 * LOG_LEVEL (debug | info | warn | error | silent).
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

const envLevel = (process.env.LOG_LEVEL || '').toLowerCase();
const threshold = LEVELS[envLevel] ?? LEVELS.info;

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

/** Values that must never reach the log stream. */
const SENSITIVE_KEYS = /^(authorization|cookie|password|passwd|token|secret|api[-_]?key)$/i;

function scrub(value) {
  if (value == null) return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, code: value.code };
  }
  if (Array.isArray(value)) return value.map(scrub);
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SENSITIVE_KEYS.test(key) ? '[redacted]' : scrub(val);
    }
    return out;
  }
  return value;
}

function write(level, message, meta) {
  if (LEVELS[level] < threshold) return;

  const payload = meta === undefined ? undefined : scrub(meta);

  if (isProduction) {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      message,
      ...(payload !== undefined ? { meta: payload } : {}),
    });
    (level === 'error' ? process.stderr : process.stdout).write(`${line}\n`);
    return;
  }

  const time = new Date().toISOString().slice(11, 23);
  const tag = level.toUpperCase().padEnd(5, ' ');
  let line = `${time} ${tag} ${message}`;
  if (payload !== undefined) {
    line += ` ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`;
  }
  (level === 'error' ? process.stderr : process.stdout).write(`${line}\n`);
}

export const logger = {
  debug: (message, meta) => write('debug', message, meta),
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};
