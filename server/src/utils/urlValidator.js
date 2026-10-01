import crypto from 'node:crypto';
import { AppError } from './AppError.js';

const MAX_URL_LENGTH = 2048;

/**
 * Hostname allowlist.
 *
 * TrueTube never accepts arbitrary URLs: the value is passed to yt-dlp as a
 * child-process argument, so only public, well-known media hostnames are
 * accepted. Support for any given host depends on what the installed yt-dlp
 * version can actually extract — `POST /api/analyze` returns a real error when
 * it cannot.
 */
const SUPPORTED_HOSTS = [
  { host: 'youtube.com', platform: 'YouTube' },
  { host: 'www.youtube.com', platform: 'YouTube' },
  { host: 'm.youtube.com', platform: 'YouTube' },
  { host: 'music.youtube.com', platform: 'YouTube' },
  { host: 'youtu.be', platform: 'YouTube' },
  { host: 'vimeo.com', platform: 'Vimeo' },
  { host: 'player.vimeo.com', platform: 'Vimeo' },
  { host: 'dailymotion.com', platform: 'Dailymotion' },
  { host: 'www.dailymotion.com', platform: 'Dailymotion' },
  { host: 'dai.ly', platform: 'Dailymotion' },
  { host: 'soundcloud.com', platform: 'SoundCloud' },
  { host: 'on.soundcloud.com', platform: 'SoundCloud' },
  { host: 'mixcloud.com', platform: 'Mixcloud' },
  { host: 'www.mixcloud.com', platform: 'Mixcloud' },
  { host: 'bandcamp.com', platform: 'Bandcamp' },
  { host: '*.bandcamp.com', platform: 'Bandcamp' },
  { host: 'tiktok.com', platform: 'TikTok' },
  { host: 'www.tiktok.com', platform: 'TikTok' },
  { host: 'vm.tiktok.com', platform: 'TikTok' },
  { host: 'twitter.com', platform: 'X' },
  { host: 'www.twitter.com', platform: 'X' },
  { host: 'mobile.twitter.com', platform: 'X' },
  { host: 'x.com', platform: 'X' },
  { host: 'www.x.com', platform: 'X' },
  { host: 'reddit.com', platform: 'Reddit' },
  { host: 'www.reddit.com', platform: 'Reddit' },
  { host: 'old.reddit.com', platform: 'Reddit' },
  { host: 'v.redd.it', platform: 'Reddit' },
  { host: 'redd.it', platform: 'Reddit' },
  { host: 'twitch.tv', platform: 'Twitch' },
  { host: 'www.twitch.tv', platform: 'Twitch' },
  { host: 'clips.twitch.tv', platform: 'Twitch' },
  { host: 'kick.com', platform: 'Kick' },
  { host: 'rumble.com', platform: 'Rumble' },
  { host: 'bilibili.com', platform: 'Bilibili' },
  { host: 'www.bilibili.com', platform: 'Bilibili' },
  { host: 'b23.tv', platform: 'Bilibili' },
  { host: 'linkedin.com', platform: 'LinkedIn' },
  { host: 'www.linkedin.com', platform: 'LinkedIn' },
  { host: 'facebook.com', platform: 'Facebook' },
  { host: 'www.facebook.com', platform: 'Facebook' },
  { host: 'fb.watch', platform: 'Facebook' },
  { host: 'tumblr.com', platform: 'Tumblr' },
  { host: 'www.tumblr.com', platform: 'Tumblr' },
  { host: 'flickr.com', platform: 'Flickr' },
  { host: 'www.flickr.com', platform: 'Flickr' },
  { host: 'streamable.com', platform: 'Streamable' },
  { host: 'odysee.com', platform: 'Odysee' },
  { host: 'kickstarter.com', platform: 'Kickstarter' },
  { host: 'www.kickstarter.com', platform: 'Kickstarter' },
  { host: 'ted.com', platform: 'TED' },
  { host: 'www.ted.com', platform: 'TED' },
  { host: 'archive.org', platform: 'Internet Archive' },
  { host: 'vk.com', platform: 'VK' },
  { host: 'ok.ru', platform: 'OK.ru' },
];

const SUPPORTED_SET = new Set(SUPPORTED_HOSTS.map((entry) => entry.host));

/** IPv4 / IPv6 literals are never valid targets for this service. */
const IPV4_LITERAL = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6_LITERAL = /^\[?[\da-f:]+(\]|:)$/i;

/** Blocked names: loopback, link-local metadata, private & internal namespaces. */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'instance-data',
]);

const BLOCKED_SUFFIXES = ['.local', '.internal', '.lan', '.home.arpa', '.test', '.invalid', '.localdomain'];

function isIpLiteral(hostname) {
  return IPV4_LITERAL.test(hostname) || (hostname.includes(':') && IPV6_LITERAL.test(hostname));
}

/** Find the allowlist entry (supports single `*.` wildcard entries). */
function matchSupportedHost(hostname) {
  if (SUPPORTED_SET.has(hostname)) {
    return SUPPORTED_HOSTS.find((entry) => entry.host === hostname);
  }
  for (const entry of SUPPORTED_HOSTS) {
    if (!entry.host.startsWith('*.')) continue;
    const suffix = entry.host.slice(1); // ".bandcamp.com"
    if (hostname.endsWith(suffix)) return entry;
  }
  return null;
}

export function listSupportedHosts() {
  return [...new Set(SUPPORTED_HOSTS.map((entry) => entry.host))].sort();
}

/**
 * Display order for the supported-platform list. Purely presentational: it
 * puts the most frequently used sources first in the UI.
 */
const PLATFORM_PRIORITY = [
  'YouTube',
  'TikTok',
  'Facebook',
  'X',
  'Reddit',
  'Twitch',
  'Vimeo',
  'SoundCloud',
  'Dailymotion',
  'Bilibili',
  'LinkedIn',
  'Bandcamp',
  'Flickr',
  'Internet Archive',
  'Kick',
  'Kickstarter',
];

/** Hostnames grouped by the platform name shown in the UI. */
export function listSupportedPlatforms() {
  const grouped = new Map();
  for (const { host, platform } of SUPPORTED_HOSTS) {
    if (!grouped.has(platform)) grouped.set(platform, new Set());
    grouped.get(platform).add(host);
  }

  const rank = (platform) => {
    const index = PLATFORM_PRIORITY.indexOf(platform);
    return index === -1 ? PLATFORM_PRIORITY.length : index;
  };

  return [...grouped.entries()]
    .map(([platform, hosts]) => ({ platform, hosts: [...hosts].sort() }))
    .sort((a, b) => rank(a.platform) - rank(b.platform) || a.platform.localeCompare(b.platform));
}

/**
 * Validate a user supplied URL.
 *
 * @param {unknown} raw
 * @returns {{ url: string, host: string, platform: string, cacheKey: string }}
 * @throws {AppError}
 */
export function validateMediaUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new AppError('INVALID_URL', 'Enter a video URL to continue.', 400);
  }

  const value = raw.trim();

  if (value.length > MAX_URL_LENGTH) {
    throw new AppError('INVALID_URL', 'That URL is too long to process.', 400);
  }

  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new AppError('INVALID_URL', 'The URL contains characters that are not allowed.', 400);
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new AppError('INVALID_URL', 'That does not look like a valid URL. Include http:// or https://.', 400);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new AppError('INVALID_URL', 'Only http and https URLs are supported.', 400);
  }

  if (parsed.username || parsed.password) {
    throw new AppError('INVALID_URL', 'URLs containing credentials are not accepted.', 400);
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');

  if (!host) {
    throw new AppError('INVALID_URL', 'The URL is missing a hostname.', 400);
  }

  if (BLOCKED_HOSTNAMES.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new AppError('BLOCKED_HOST', 'That hostname cannot be processed by this service.', 400);
  }

  if (isIpLiteral(host)) {
    throw new AppError('BLOCKED_HOST', 'Direct IP addresses cannot be processed by this service.', 400);
  }

  if (!/^[a-z0-9.-]+$/.test(host) || host.includes('..') || host.startsWith('.') || host.endsWith('.')) {
    throw new AppError('INVALID_URL', 'The URL hostname is not valid.', 400);
  }

  const match = matchSupportedHost(host);
  if (!match) {
    throw new AppError(
      'UNSUPPORTED_URL',
      'That hostname is not supported by TrueTube. Paste a link from a supported public video source.',
      400,
    );
  }

  // Normalised, canonical form used everywhere downstream.
  parsed.hash = '';
  const normalised = parsed.toString();

  return {
    url: normalised,
    host,
    platform: match.platform,
    cacheKey: `${match.platform}:${normalised}`,
  };
}

/** Stable key for caching metadata of a given URL. */
export function metadataKey(url) {
  return crypto.createHash('sha256').update(url).digest('hex');
}

export default validateMediaUrl;
