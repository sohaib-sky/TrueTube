/**
 * Client-side URL validation.
 *
 * This mirrors the server rules to give immediate feedback. The server always
 * re-validates — nothing here is trusted.
 */

const BLOCKED_SUFFIXES = ['.local', '.internal', '.lan', '.home.arpa', '.test', '.invalid', '.localdomain'];
const BLOCKED_HOSTS = ['localhost', 'metadata.google.internal', 'metadata', 'instance-data'];
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export function validateUrlInput(value) {
  const raw = typeof value === 'string' ? value.trim() : '';

  if (!raw) return { valid: false, message: 'Enter a video URL to continue.' };
  if (raw.length > 2048) return { valid: false, message: 'That URL is too long to process.' };
  if (/[\u0000-\u001f\u007f]/.test(raw)) {
    return { valid: false, message: 'The URL contains characters that are not allowed.' };
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { valid: false, message: 'That does not look like a valid URL. Include http:// or https://.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, message: 'Only http and https URLs are supported.' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, message: 'URLs containing credentials are not accepted.' };
  }

  const host = parsed.hostname.toLowerCase();

  if (!host) return { valid: false, message: 'The URL is missing a hostname.' };
  if (BLOCKED_HOSTS.includes(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return { valid: false, message: 'That hostname cannot be processed by this service.' };
  }
  if (IPV4.test(host)) {
    return { valid: false, message: 'Direct IP addresses cannot be processed by this service.' };
  }

  return { valid: true, url: parsed.toString(), host };
}

export default validateUrlInput;
