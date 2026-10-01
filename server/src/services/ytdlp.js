import { execFile, spawn } from 'node:child_process';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import config from '../config.js';
import { requireTool } from './dependencyDetector.js';

/**
 * yt-dlp integration.
 *
 * TrueTube uses upstream yt-dlp unmodified — the official project at
 * https://github.com/yt-dlp/yt-dlp — invoked with an argument array so that no
 * user input can ever reach a shell.
 */

/**
 * Flags applied to every yt-dlp invocation.
 *
 * Security relevant choices:
 *  - no cookie / credential options are ever accepted or forwarded, so private,
 *    members-only or account-gated media can never be extracted;
 *  - `--no-playlist` guarantees a single, predictable result;
 *  - `--no-cache-dir` keeps server-side caches free of user identifiers.
 *
 * Performance choices — without these a small file spends most of its time in
 * overhead rather than transfer:
 *  - `--concurrent-fragments` fetches HLS/DASH segments in parallel. These
 *    sources are only playable as a sequence of small segments, and pulling
 *    them one at a time is the single largest avoidable cost;
 *  - `--http-chunk-size` lets a single progressive file be fetched as parallel
 *    ranged requests instead of one long serial connection.
 */
const BASE_ARGS = [
  '--no-playlist',
  '--no-warnings',
  '--no-cache-dir',
  '--no-cookies',
  '--no-cookies-from-browser',
  '--ignore-config',
  '--no-progress',
  // Measured on this host over 6 interleaved A/B runs (order alternated to
  // cancel slow-start drift): median 35.2s at 8 fragments versus 25.9s at 16,
  // for the same 9.9 MB progressive stream. 16 won 4, tied 1, lost 1.
  //
  // This only helps progressive and DASH downloads. HLS is handed to FFmpeg,
  // which ignores both flags entirely - measured as pure noise (28-33s either
  // way), so do not expect a speed-up there.
  '--concurrent-fragments',
  '16',
  '--http-chunk-size',
  '32M',
  '--socket-timeout',
  '20',
  '--retries',
  '3',
  '--fragment-retries',
  '3',
  '--restrict-filenames',
  '--no-mtime',
];

/**
 * Map yt-dlp's stderr output onto stable, user-facing error codes.
 *
 * Order matters — the first matching pattern wins, and the bot/rate-limit
 * patterns deliberately sit ABOVE the authentication one. YouTube answers a
 * blocked datacenter IP with "Sign in to confirm you're not a bot", which
 * contains the word "sign in" but has nothing to do with the video being
 * gated: the video is public and the request is what was refused. Reporting
 * that as AUTH_REQUIRED tells the reader their link is the problem when the
 * server's network is, and it is the single most misleading thing this
 * mapping can do.
 */
const STDERR_PATTERNS = [
  // --- Hard access controls: the content itself is gated. None of these are
  // --- ever worked around; TrueTube reports them and stops.
  {
    test: /private video|this video is private|video is private/i,
    code: 'PRIVATE_CONTENT',
    message: 'This video is private. TrueTube cannot access private or protected content.',
    status: 403,
  },
  {
    test: /members[- ]only|join this channel|available to this channel's members|available to members|premium members/i,
    code: 'MEMBERS_ONLY',
    message: 'This video is members-only. TrueTube does not access gated or paid content.',
    status: 403,
  },
  {
    test: /drm|protected by|widevine|fairplay|encrypted media|license server/i,
    code: 'DRM_PROTECTED',
    message: 'This media is DRM protected. TrueTube does not remove encryption or access controls.',
    status: 403,
  },
  {
    test: /confirm your age|inappropriate for some users|age[- ]restricted|age restricted/i,
    code: 'AGE_RESTRICTED',
    message: 'This video is age-restricted and cannot be accessed anonymously.',
    status: 403,
  },

  // --- The source refused US, not the reader. Must precede AUTH_REQUIRED.
  {
    test: /not a bot|sign in to confirm you|confirm you're not a bot/i,
    code: 'UPSTREAM_BLOCKED',
    message: 'The platform is refusing requests from this server.',
    status: 502,
  },
  {
    test: /too many requests|rate.?limit(?:ed|ing)|http error 429|returned error: 429/i,
    code: 'RATE_LIMITED',
    message: 'The source is rate limiting this server. Please wait a moment and try again.',
    status: 429,
  },
  {
    test: /data ?center ip|your ip may be blocked|ip (?:address )?(?:has been |is )?blocked|blocked by the/i,
    code: 'UPSTREAM_BLOCKED',
    message: 'The platform is refusing requests from this server.',
    status: 502,
  },

  // --- Genuine authentication requirements, reported honestly and never
  // --- bypassed: TrueTube sends no cookies, credentials or sessions.
  {
    test: /account authentication is required|requires authentication|sign in if you'?ve been granted|login required|requires a signed[- ]in account|this account is (?:not )?(?:yet )?(?:active|verified)/i,
    code: 'AUTH_REQUIRED',
    message: 'This video requires a signed-in account. TrueTube does not use credentials or session cookies.',
    status: 403,
  },

  {
    test: /not (?:made this video )?available in your country|not available in your country|blocked it in your country|geo[- ]restricted|geo restricted|not available from your location/i,
    code: 'GEO_BLOCKED',
    message: 'This video is not available from the server region.',
    status: 403,
  },
  {
    test: /video unavailable|video is unavailable|has been removed|no longer available|does not exist|page not found|http error 404|404: not found|returned error: 404/i,
    code: 'VIDEO_UNAVAILABLE',
    message: 'This video is unavailable. It may have been removed, renamed or made private.',
    status: 404,
  },
  {
    test: /returned error: 403|http error 403|forbidden/i,
    code: 'ACCESS_DENIED',
    message: 'The source refused this request. The video may be restricted for this client.',
    status: 403,
  },
  {
    test: /unable to download webpage/i,
    code: 'UPSTREAM_NETWORK',
    message: 'The source refused to serve this page. Please try again or use a different link.',
    status: 502,
  },
  {
    test: /unsupported url|no suitable extractor|is not a valid url/i,
    code: 'UNSUPPORTED_URL',
    message: 'TrueTube could not find an extractor for this link. Only supported public sources can be analyzed.',
    status: 400,
  },
  {
    test: /unable to extract|failed to parse json|extractor did not return|generic extraction failed|unable to parse|unsupported url/i,
    code: 'EXTRACTOR_ERROR',
    message: 'Metadata extraction failed. The source may have changed or is temporarily unavailable.',
    status: 422,
  },
  {
    test: /requested format is not available|format is not available|no video formats found|requested format not available/i,
    code: 'FORMAT_UNAVAILABLE',
    message: 'That format is no longer available. Re-analyze the URL and choose another option.',
    status: 409,
  },
  {
    test: /ffmpeg (is )?not (installed|found)|ffmpeg not found|you have requested merging.*ffmpeg/i,
    code: 'FFMPEG_MISSING',
    message: 'FFmpeg is required for this operation but is not installed on the server.',
    status: 503,
  },
  {
    test: /timed out|timeout|read timed out/i,
    code: 'UPSTREAM_TIMEOUT',
    message: 'The source took too long to respond. Please try again.',
    status: 504,
  },
  {
    test: /getaddrinfo|failed to resolve|connection (refused|reset)|network is unreachable|temporary failure in name resolution/i,
    code: 'UPSTREAM_NETWORK',
    message: 'The source could not be reached. Please try again in a moment.',
    status: 502,
  },
];

/** Translate a yt-dlp failure into a client-safe AppError. */
export function mapYtDlpError(error, stderr = '', elapsedMs) {
  // Carried on the error so callers can tell a quick refusal from a slow
  // failure without re-measuring.
  const mapped = translate(error, stderr);
  if (elapsedMs !== undefined) mapped.elapsedMs = elapsedMs;
  return mapped;
}

function translate(error, stderr) {

  if (error?.name === 'AbortError') {
    return new AppError('CLIENT_CLOSED_REQUEST', 'The request was cancelled.', 499, { cause: error });
  }

  if (error?.code === 'ENOENT') {
    return new AppError(
      'YTDLP_UNAVAILABLE',
      'This service is not ready: the yt-dlp binary could not be found on the server.',
      503,
      { cause: error, details: { reason: 'binary not found' } },
    );
  }

  if (error?.killed || error?.signal === 'SIGTERM') {
    return new AppError('TIMEOUT', 'Processing took too long and was stopped. Please try again.', 504, { cause: error });
  }

  if (error?.code === 'EACCES') {
    return new AppError('YTDLP_UNAVAILABLE', 'The yt-dlp binary cannot be executed by the server.', 503, { cause: error });
  }

  const haystack = String(stderr || error?.message || '');

  for (const pattern of STDERR_PATTERNS) {
    if (pattern.test.test(haystack)) {
      return new AppError(pattern.code, pattern.message, pattern.status);
    }
  }

  if (error?.code === 'ENOENT' || /no such file or directory/i.test(haystack)) {
    return new AppError('UPSTREAM_NETWORK', 'The source could not be reached. Please try again in a moment.', 502, {
      cause: error,
    });
  }

  logger.warn('unmapped yt-dlp failure', { code: error?.code, stderr: haystack.slice(0, 500) });

  return new AppError(
    'DOWNLOAD_FAILED',
    'The download engine could not complete this request. Please try again or use a different source.',
    502,
    { cause: error },
  );
}

/**
 * Kill a child and everything it started.
 *
 * yt-dlp spawns FFmpeg, and on Windows a plain `child.kill()` only signals the
 * direct process — the downloader survives, keeps pulling bytes, and keeps
 * writing into the job directory. A client that disconnected would then leave a
 * runaway transfer and a leaked temporary file behind, and enough of those
 * saturate the machine until even a `--version` probe times out. `taskkill /T`
 * takes the whole tree down.
 */
function killTree(child) {
  if (!child || child.killed || child.exitCode !== null) return;

  if (process.platform === 'win32' && child.pid) {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
    } catch {
      child.kill('SIGKILL');
    }
    return;
  }

  try {
    child.kill('SIGKILL');
  } catch {
    /* already gone */
  }
}

/**
 * Run yt-dlp with an argument array.
 *
 * @param {string[]} args
 * @param {{ timeout?: number, signal?: AbortSignal, onStderr?: (line: string) => void, onStdout?: (line: string) => void, maxBuffer?: number }} options
 * @returns {Promise<{ stdout: string, stderr: string, elapsedMs: number }>}
 */
export function runYtDlp(args, options = {}) {
  const executable = config.ytdlpPath || 'yt-dlp';
  const {
    timeout = config.timeouts.analyze,
    signal,
    onStderr,
    onStdout,
    maxBuffer = config.limits.maxBuffer,
  } = options;

  return new Promise((resolve, reject) => {
    let child = null;
    let aborted = false;
    const startedAt = Date.now();

    const onAbort = () => {
      aborted = true;
      killTree(child);
    };

    // Detach the listener as soon as the child settles, so a long-lived signal
    // never keeps this closure (and the child) alive.
    const cleanupSignal = () => signal?.removeEventListener('abort', onAbort);

    child = execFile(
      executable,
      args,
      {
        timeout,
        signal,
        windowsHide: true,
        maxBuffer,
        shell: false,
        cwd: config.downloadDir,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      },
      (error, stdout, stderr) => {
        cleanupSignal();
        if (error) {
          // A timeout or abort means the process is still winding down; make
          // sure nothing survives it before reporting the failure.
          if (aborted || error.killed || error.signal) killTree(child);
          reject(mapYtDlpError(error, stderr, Date.now() - startedAt));
          return;
        }
        resolve({ stdout: stdout || '', stderr: stderr || '', elapsedMs: Date.now() - startedAt });
      },
    );

    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }

    if (onStderr || onStdout) {
      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      if (onStdout) pipeLines(child.stdout, onStdout);
      if (onStderr) pipeLines(child.stderr, onStderr);
    }
  });
}

function pipeLines(stream, onLine) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) onLine(line);
  });
  stream.on('end', () => {
    if (buffer) onLine(buffer);
    buffer = '';
  });
}

/** Parse `--dump-json` output into an object, or throw a mapped error. */
export function parseJsonOutput(stdout, stderr) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw mapYtDlpError(new Error('yt-dlp produced no output'), stderr);
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new AppError('EXTRACTOR_ERROR', 'The metadata response could not be read. Please try again.', 502);
  }
}

export { BASE_ARGS, requireTool };
export default runYtDlp;
