import { execFile } from 'node:child_process';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import config from '../config.js';

const CACHE_TTL_MS = 60_000;
/** A failure is re-probed quickly; a success is trusted for the full TTL. */
const FAILURE_CACHE_TTL_MS = 3_000;

/** @type {Map<string, {ok: boolean, version: string|null, error: string|null, checkedAt: number}>} */
const cache = new Map();

/**
 * Run a version probe for an external binary.
 *
 * Uses execFile with an argument array (never a shell string) so the binary
 * path and its arguments cannot be interpreted by a shell.
 */
function probe(binary, versionArgs) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    execFile(
      binary,
      versionArgs,
      {
        timeout: config.timeouts.detect,
        windowsHide: true,
        maxBuffer: 1024 * 64,
        shell: false,
      },
      (error, stdout, stderr) => {
        if (!error) {
          const output = `${stdout || ''}${stderr || ''}`.trim();
          resolve({ ok: true, version: output.split(/\r?\n/)[0]?.slice(0, 120) || 'unknown' });
          return;
        }
        resolve({ ok: false, version: null, error: describeSpawnError(error), code: error?.code ?? null });
      },
    ).on('close', () => {
      logger.debug('dependency probe finished', { binary, ms: Date.now() - startedAt });
    });
  });
}

/**
 * Only ENOENT and EACCES prove the binary is unusable.
 *
 * Anything else — a timeout, a spawn failure, a busy machine, a file briefly
 * locked by an antivirus scan — is a hiccup, not a missing engine. Reporting a
 * hiccup as "the engine is not installed" takes the whole downloader offline and
 * tells the reader something flatly untrue about their own setup.
 */
function isGenuinelyMissing(result) {
  return result.code === 'ENOENT' || result.code === 'EACCES';
}

function describeSpawnError(error) {
  switch (error?.code) {
    case 'ENOENT':
      return 'binary not found on PATH';
    case 'EACCES':
      return 'permission denied';
    case 'ETIMEDOUT':
      return 'probe timed out';
    default:
      return error?.code ? String(error.code) : 'probe failed';
  }
}

async function detect(binary, explicitPath, versionArgs, label) {
  const resolvedPath = explicitPath || binary;
  const cached = cache.get(resolvedPath);
  const ttl = cached && !cached.ok ? FAILURE_CACHE_TTL_MS : CACHE_TTL_MS;
  if (cached && Date.now() - cached.checkedAt < ttl) {
    return cached;
  }

  // A single attempt. Probing twice doubles the worst-case wait on every
  // request, and since an unsettled probe no longer blocks anything, the retry
  // was buying nothing but latency.
  const result = await probe(resolvedPath, versionArgs);

  const entry = {
    ...result,
    label,
    executable: explicitPath ? 'configured path' : 'PATH',
    missing: !result.ok && isGenuinelyMissing(result),
    checkedAt: Date.now(),
  };
  cache.set(resolvedPath, entry);

  if (entry.ok) {
    logger.info(`${label} detected`, { version: entry.version });
  } else if (entry.missing) {
    logger.warn(`${label} unavailable`, { reason: entry.error, executable: entry.executable });
  } else {
    // Transient. Say so plainly instead of claiming the engine is gone.
    logger.warn(`${label} probe did not settle`, { reason: entry.error, executable: entry.executable });
  }

  return entry;
}

/** Is yt-dlp installed and runnable? */
export function detectYtDlp() {
  return detect('yt-dlp', config.ytdlpPath, ['--version'], 'yt-dlp');
}

/** Is FFmpeg installed and runnable? */
export function detectFfmpeg() {
  return detect('ffmpeg', config.ffmpegPath, ['-version'], 'ffmpeg');
}

/**
 * Resolve the executable to use, throwing a clear setup error when missing.
 * @param {'yt-dlp'|'ffmpeg'} tool
 */
export async function requireTool(tool) {
  const isYtdlp = tool === 'yt-dlp';
  const configured = config[isYtdlp ? 'ytdlpPath' : 'ffmpegPath'];
  const fallback = isYtdlp ? 'yt-dlp' : 'ffmpeg';
  const status = isYtdlp ? await detectYtDlp() : await detectFfmpeg();

  if (status.ok) return configured || fallback;

  // Only a binary that is genuinely absent is a real setup problem. A probe
  // that merely did not settle — a slow boot, a busy machine, an antivirus
  // holding the file — says nothing about whether the engine can do the job, so
  // it must not stop the request. The actual yt-dlp run is the authority: it
  // either works, or it fails with a precise error worth showing.
  if (!status.missing) {
    logger.warn(`${status.label} probe did not settle, proceeding anyway`, { reason: status.error });
    return configured || fallback;
  }

  if (isYtdlp) {
    throw new AppError(
      'YTDLP_UNAVAILABLE',
      'This service is not ready: the yt-dlp binary could not be found. Install yt-dlp on the server to enable analysis and downloads.',
      503,
      { details: { reason: status.error, expected: true } },
    );
  }

  throw new AppError(
    'FFMPEG_MISSING',
    'This format requires FFmpeg to merge audio and video, but FFmpeg is not available on this server. Choose a combined format instead.',
    503,
    { details: { reason: status.error, expected: true } },
  );
}

/** Capability snapshot used by /api/health and included in analyze responses. */
export async function getCapabilities() {
  const [ytdlp, ffmpeg] = await Promise.all([detectYtDlp(), detectFfmpeg()]);
  return {
    ytDlp: {
      available: ytdlp.ok,
      version: ytdlp.version,
      source: ytdlp.executable,
      reason: ytdlp.ok ? undefined : ytdlp.error,
    },
    ffmpeg: {
      available: ffmpeg.ok,
      version: ffmpeg.version,
      source: ffmpeg.executable,
      reason: ffmpeg.ok ? undefined : ffmpeg.error,
    },
    /** Merging a video-only stream with audio requires FFmpeg. */
    canMergeStreams: ffmpeg.ok,
  };
}
