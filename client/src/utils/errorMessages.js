/**
 * Maps stable backend error codes to a title + hint.
 *
 * The server's own `message` is always displayed verbatim underneath, so the
 * copy here only adds context — it never invents a different outcome.
 */
const CATALOG = {
  INVALID_URL: { title: 'Invalid URL', hint: 'Check that the link is complete and starts with http:// or https://.' },
  BLOCKED_HOST: {
    title: 'Blocked host',
    hint: 'TrueTube only processes public, supported media hostnames — never internal or private addresses.',
  },
  HOST_UNRESOLVED: { title: 'Host unreachable', hint: 'The hostname could not be resolved. Verify the link and your network.' },
  UNSUPPORTED_URL: {
    title: 'Unsupported link',
    hint: 'The installed yt-dlp build has no extractor for this link. Try a different public source.',
  },
  PRIVATE_CONTENT: {
    title: 'Private content',
    hint: "Private content isn't available. TrueTube never accesses private videos and cannot process them.",
  },
  MEMBERS_ONLY: {
    title: 'Members-only content',
    hint: 'Gated and paid content is out of scope for TrueTube.',
  },
  AUTH_REQUIRED: {
    title: 'Sign-in required',
    hint: "TrueTube can't download this video because the source requires authentication. It never sends accounts, cookies or session credentials.",
  },
  AGE_RESTRICTED: { title: 'Age-restricted', hint: 'This media cannot be accessed without signing in.' },
  DRM_PROTECTED: {
    title: 'DRM protected',
    hint: 'TrueTube does not remove encryption or access controls.',
  },
  GEO_BLOCKED: { title: 'Region restricted', hint: 'The source is not available from the server region.' },
  VIDEO_UNAVAILABLE: { title: 'Video unavailable', hint: 'It may have been removed, renamed, or made private.' },
  ACCESS_DENIED: { title: 'Access denied', hint: 'The source refused the request for this media.' },
  EXTRACTOR_ERROR: {
    title: 'Extraction failed',
    hint: 'The source may have changed its pages. Please try again in a few minutes.',
  },
  FORMAT_UNAVAILABLE: {
    title: 'No compatible format',
    hint: 'No compatible downloadable format is available for this media. Re-analyze the link and pick another option.',
  },
  INVALID_FORMAT: { title: 'Format not available', hint: 'Re-analyze the link and pick another option.' },
  FFMPEG_MISSING: {
    title: 'FFmpeg unavailable',
    hint: 'This option merges the best video and audio streams, which needs FFmpeg installed on the server. Choose a combined format.',
  },
  YTDLP_UNAVAILABLE: {
    title: 'Engine unavailable',
    hint: 'The yt-dlp binary is not installed on the server, so analysis and downloads are disabled.',
  },
  ENGINE_BUSY: {
    title: 'Engine busy',
    hint: 'The download engine did not answer a startup check. Please try again in a moment.',
  },
  SERVER_BUSY: {
    title: 'Server busy',
    hint: 'Other downloads are still running. Your download is queued and will start shortly — or try again in a moment.',
  },
  DOWNLOAD_FAILED: { title: 'Download failed', hint: 'The engine could not produce a media file. Please try again or pick another format.' },
  TIMEOUT: { title: 'Timed out', hint: 'Processing took too long and was stopped. Please try again.' },
  UPSTREAM_TIMEOUT: { title: 'Source timed out', hint: 'The platform did not respond in time. Please try again.' },
  UPSTREAM_NETWORK: { title: 'Source unreachable', hint: 'The platform could not be reached from the server. Please try again.' },
  UPSTREAM_BLOCKED: {
    title: 'Source is blocking this server',
    hint: 'The video itself is probably fine — the platform has flagged this server\'s network, which is common on shared or datacenter hosting. Try again later, use a different source, or host TrueTube on a clean IP.',
  },
  RATE_LIMITED: { title: 'Rate limit reached', hint: 'Slow down for a moment — limits reset automatically every few minutes.' },
  // A cancellation is not a fault in the reader's link. Without an entry here
  // it fell through to the generic fallback and was announced as "Unable to
  // process this URL — please verify the link", which blamed the link for
  // something the reader did and nothing can be done about.
  CLIENT_CLOSED_REQUEST: {
    title: 'Download stopped',
    hint: 'The transfer was cancelled before it finished, so nothing was saved. Press Download again to retry.',
  },
  VALIDATION_ERROR: { title: 'Invalid request', hint: 'The request payload was rejected. Please try again.' },
  INVALID_JSON: { title: 'Invalid request', hint: 'The request body could not be read.' },
  PAYLOAD_TOO_LARGE: { title: 'Request too large', hint: 'The request exceeded the allowed size.' },
  NOT_FOUND: { title: 'Not found', hint: 'That endpoint does not exist.' },
  NETWORK_ERROR: { title: 'Network error', hint: 'The TrueTube API could not be reached. Check your connection and try again.' },
  BAD_RESPONSE: { title: 'Unexpected response', hint: 'The server replied with something unreadable. Please try again.' },
  // Deliberately does not blame the link. The request never reached an API at
  // all, so telling someone to check their URL sends them off to fix something
  // that was already correct.
  BACKEND_UNAVAILABLE: {
    title: 'Download service offline',
    hint: 'This copy of TrueTube is the interface only. Downloads need the service running behind it.',
  },
  INTERNAL_ERROR: { title: 'Server error', hint: 'Something went wrong on our side. Please try again.' },
};

const FALLBACK = { title: 'Unable to process this URL', hint: 'Please verify the link and try again.' };

export function describeError(error) {
  if (!error) return FALLBACK;
  const entry = CATALOG[error.code] || FALLBACK;
  return {
    code: error.code,
    title: entry.title,
    message: error.message || 'Please verify the link and try again.',
    hint: entry.hint,
    status: error.status ?? 0,
  };
}

export default describeError;
