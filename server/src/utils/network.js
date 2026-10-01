/** Detect whether a hostname resolves only to public, routable addresses. */
import dns from 'node:dns/promises';
import net from 'node:net';
import { AppError } from './AppError.js';

const CGNAT = '100.64.0.0/10';
const BLOCKED_V4_RANGES = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16', // link-local, includes 169.254.169.254 (cloud metadata)
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
];

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function parseCidr(cidr) {
  const [address, bitsRaw] = cidr.split('/');
  return { base: ipv4ToInt(address), bits: Number(bitsRaw) };
}

const BLOCKED_V4 = BLOCKED_V4_RANGES.map(parseCidr);

function isBlockedIPv4(ip) {
  const value = ipv4ToInt(ip);
  return BLOCKED_V4.some(({ base, bits }) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) === (base & mask);
  });
}

function isBlockedIPv6(ip) {
  const address = ip.toLowerCase().split('%')[0];
  if (address === '::1' || address === '::') return true;
  if (address.startsWith('fe8') || address.startsWith('fe9') || address.startsWith('fea') || address.startsWith('feb')) {
    return true; // link-local fe80::/10
  }
  if (/^f[cd]/.test(address)) return true; // unique local fc00::/7
  const mappedV4 = address.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mappedV4 && isBlockedIPv4(mappedV4[1])) return true;
  if (CGNAT && address.startsWith('::ffff:100.')) return true;
  return false;
}

export function isPublicAddress(ip) {
  const version = net.isIP(ip);
  if (version === 4) return !isBlockedIPv4(ip);
  if (version === 6) return !isBlockedIPv6(ip);
  return false;
}

/**
 * Reject URLs that point at loopback, private networks, link-local or cloud
 * metadata services. Allowlisted hostnames are public by definition, so this is
 * a defence-in-depth check against DNS rebinding and misconfigured resolvers.
 *
 * @param {string} hostname
 */
export async function assertPublicHostname(hostname) {
  let records;
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new AppError('HOST_UNRESOLVED', 'The hostname could not be resolved. Check the link and try again.', 400);
  }

  if (!records.length) {
    throw new AppError('HOST_UNRESOLVED', 'The hostname could not be resolved. Check the link and try again.', 400);
  }

  const offending = records.find((record) => !isPublicAddress(record.address));
  if (offending) {
    throw new AppError('BLOCKED_HOST', 'That hostname resolves to a non-public address and cannot be processed.', 400);
  }

  return records;
}

export default assertPublicHostname;
