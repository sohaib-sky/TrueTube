import path from 'node:path';
import { promises as fs } from 'node:fs';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import config from '../config.js';
import { BASE_ARGS, runYtDlp, parseJsonOutput, requireTool } from './ytdlp.js';
import { detectFfmpeg } from './dependencyDetector.js';
import { listJobFiles } from './tempFiles.js';

const MIMETYPES = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.mpg': 'video/mpeg',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.opus': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.m3u8': 'application/vnd.apple.mpegurl',
};

/** Format identifiers we generate ourselves; never taken from client input. */
export const BEST_PRESET = 'best';

/**
 * The default "best available" selector.
 *
 * The branches are ordered by how well the result plays, not by size. The naive
 * `bestvideo*+bestaudio` simply takes the largest stream of each kind, and on
 * most sites that means VP9 video and Opus audio. Muxing those into an MP4
 * produces a file which plays silent, or refuses to open at all, in a lot of
 * players — Windows Media Player rejects it outright (0xc00d5212) even though
 * the bytes are technically a valid MP4.
 *
 * So the first branch asks for a native H.264 MP4 paired with an M4A (AAC)
 * track: already a valid MP4, nothing to re-encode, plays everywhere. Only if
 * the source has no such pair do we fall back to the size-maximising selector,
 * and `--audio-codec aac` (see downloadMedia) guarantees the audio track is
 * still AAC in that case.
 */
const BEST_VIDEO_SELECTOR =
  'bestvideo[ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/' +
  'bestvideo[ext=mp4]+bestaudio[ext=m4a]/' +
  'bestvideo*+bestaudio/best';

const AUDIO_ONLY_EXTS = new Set(['m4a', 'mp3', 'opus', 'ogg', 'wav', 'flac', 'aac', 'weba']);
const STREAMING_EXTS = new Set(['m3u8', 'm3u8_native']);
/** Containers that hold real media on their own once downloaded. */
const PROGRESSIVE_EXTS = new Set(['mp4', 'm4v', 'webm', 'mkv', 'mov', 'mpg', 'mpeg', 'avi', 'flv', 'ts', '3gp']);

function isNone(value) {
  return !value || value === 'none' || value === 'NA';
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;
  const seconds = Math.round(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

/**
 * Map a raw yt-dlp format object onto the safe, minimal public shape.
 * Returns `null` for streams that cannot be offered as a real file.
 */
function mapFormat(raw) {
  const id = String(raw.format_id ?? '');
  if (!id || id === '0') return null;

  const ext = (raw.ext || '').toLowerCase();
  const protocol = String(raw.protocol || '').toLowerCase();
  const height = Number.isFinite(raw.height) ? raw.height : null;
  const size = Number.isFinite(raw.filesize) ? raw.filesize : Number.isFinite(raw.filesize_approx) ? raw.filesize_approx : null;

  // Adaptive HLS/DASH manifests are not files. They can only be assembled by
  // FFmpeg, so they are never advertised as a plain downloadable option.
  if (STREAMING_EXTS.has(ext) || protocol === 'm3u8' || protocol === 'm3u8_native') return null;
  if (ext === 'mhtml' || ext === 'json') return null;

  let hasVideo = !isNone(raw.vcodec);
  let hasAudio = !isNone(raw.acodec);

  // Several sources leave the codec fields blank instead of reporting "none",
  // and treating that as "no media" silently threw away genuinely
  // downloadable files.
  //
  // Streamable reports blank codecs but does give a resolution or a size, so a
  // container plus either of those was enough. Facebook goes further and
  // reports nothing at all — both of its formats come back as
  // `ext=mp4, vcodec='', acodec='', height=, filesize=` — which the old rule
  // rejected, so a video that yt-dlp downloads without complaint was offered to
  // nobody and the request answered FORMAT_UNAVAILABLE.
  //
  // The container extension is itself the source's statement that this is a
  // playable file, so that is enough on its own. PROGRESSIVE_EXTS holds only
  // real media containers — no image or storyboard types — so this cannot start
  // admitting thumbnails. A direct file protocol is required as well, so an
  // adaptive manifest is still rejected above.
  if (!hasVideo && !hasAudio) {
    const isDirectFile = protocol === '' || protocol.startsWith('http');
    const looksLikeMedia = PROGRESSIVE_EXTS.has(ext) && isDirectFile;
    if (!looksLikeMedia) return null;
    hasVideo = true;
    hasAudio = true;
  }

  let kind = 'muxed';
  if (!hasVideo && hasAudio) kind = 'audio';
  else if (hasVideo && !hasAudio) kind = 'video';

  // A video-only stream must be merged with an audio track before it is usable.
  const requiresFfmpeg = kind === 'video';

  let label;
  if (kind === 'audio') {
    const bitrate = Number.isFinite(raw.abr) ? `${Math.round(raw.abr)} kbps` : null;
    const extLabel = AUDIO_ONLY_EXTS.has(ext) ? ext.toUpperCase() : raw.format_note || ext || 'audio';
    label = [bitrate, extLabel].filter(Boolean).join(' · ');
  } else if (height) {
    label = `${height}p`;
  } else {
    // Facebook names its formats `sd` and `hd` with no resolution at all, so
    // the id is the only honest description of the quality on offer.
    label =
      raw.format_note ||
      raw.resolution ||
      (id.length <= 4 && /^[a-z]+$/i.test(id) ? id.toUpperCase() : null) ||
      ext.toUpperCase() ||
      'video';
  }

  const codecText = (value) => (isNone(value) ? null : String(value).split('.')[0]);

  return {
    id,
    kind,
    ext,
    label,
    formatNote: raw.format_note || null,
    resolution: raw.resolution || (height ? `${height}p` : null),
    width: Number.isFinite(raw.width) ? raw.width : null,
    height,
    fps: Number.isFinite(raw.fps) && raw.fps > 0 ? Math.round(raw.fps) : null,
    vcodec: hasVideo ? codecText(raw.vcodec) : null,
    acodec: hasAudio ? codecText(raw.acodec) : null,
    tbr: Number.isFinite(raw.tbr) ? Math.round(raw.tbr) : null,
    abr: Number.isFinite(raw.abr) ? Math.round(raw.abr) : null,
    filesize: size,
    filesizeText: formatBytes(size),
    requiresFfmpeg,
    language: raw.language || null,
  };
}

/**
 * HLS/DASH manifests.
 *
 * These are not files, but yt-dlp can genuinely fetch and remux them when
 * FFmpeg is installed, so on an HLS-only source they are the only real option
 * available. They are surfaced separately, and only when FFmpeg can actually
 * assemble them — otherwise the honest answer is that nothing is downloadable.
 */
function mapStreamFormat(raw) {
  const id = String(raw.format_id ?? '');
  if (!id || id === '0') return null;

  const ext = (raw.ext || '').toLowerCase();
  const protocol = String(raw.protocol || '').toLowerCase();
  if (!STREAMING_EXTS.has(ext) && protocol !== 'm3u8' && protocol !== 'm3u8_native') return null;
  if (!Number.isFinite(raw.height) && !Number.isFinite(raw.abr)) return null;

  const height = Number.isFinite(raw.height) ? raw.height : null;
  const size = Number.isFinite(raw.filesize) ? raw.filesize : Number.isFinite(raw.filesize_approx) ? raw.filesize_approx : null;

  return {
    id,
    kind: height ? 'muxed' : 'audio',
    ext: height ? 'mp4' : 'm4a',
    label: height ? `${height}p · HLS` : Number.isFinite(raw.abr) ? `${Math.round(raw.abr)} kbps · HLS` : 'HLS',
    formatNote: raw.format_note || 'HLS stream, remuxed with FFmpeg',
    resolution: height ? `${height}p` : null,
    width: Number.isFinite(raw.width) ? raw.width : null,
    height,
    fps: Number.isFinite(raw.fps) && raw.fps > 0 ? Math.round(raw.fps) : null,
    vcodec: height ? null : null,
    acodec: height ? null : null,
    tbr: Number.isFinite(raw.tbr) ? Math.round(raw.tbr) : null,
    abr: Number.isFinite(raw.abr) ? Math.round(raw.abr) : null,
    filesize: size,
    filesizeText: formatBytes(size),
    requiresFfmpeg: true,
    isStream: true,
    language: raw.language || null,
  };
}

function pickThumbnail(raw) {
  const candidates = [raw.thumbnail, ...(Array.isArray(raw.thumbnails) ? raw.thumbnails.map((t) => t.url) : [])];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.startsWith('http')) return candidate;
  }
  return null;
}

/**
 * Extract real metadata for a validated URL.
 *
 * @param {string} url already validated + normalised
 * @param {{ signal?: AbortSignal }} options
 */
/**
 * Transient refusals worth one more try.
 *
 * Platforms that rate-limit or bot-check a network often answer the first
 * request with a refusal and the next, moments later, with the real thing.
 * That is a reliability problem, not an access control, so retrying it is
 * legitimate. Anything that represents a genuine gate — private, members-only,
 * age-restricted, DRM, geo-blocked — is deliberately NOT retried, and nothing
 * here ever changes the request to carry credentials.
 */
const TRANSIENT_CODES = new Set(['UPSTREAM_BLOCKED', 'RATE_LIMITED', 'UPSTREAM_NETWORK', 'UPSTREAM_TIMEOUT']);

const RETRY_DELAYS_MS = [1500, 4000];

/**
 * A refusal that arrives faster than this is a soft block worth retrying.
 * Beyond it, the source is slow rather than refusing, and another full attempt
 * would only add minutes before the identical answer.
 */
const FAST_REFUSAL_MS = 12_000;

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new AppError('CLIENT_CLOSED_REQUEST', 'The request was cancelled.', 499));
      },
      { once: true },
    );
  });

export async function analyzeMedia(url, options = {}) {
  const executable = await requireTool('yt-dlp');

  const args = [
    ...BASE_ARGS,
    '--skip-download',
    '--dump-json',
    '--no-simulate',
    '--extractor-retries',
    '2',
    url,
  ];

  // Resolved up front: it decides whether an HLS-only source has any real
  // downloadable option at all.
  const ffmpeg = await detectFfmpeg();
  const ffmpegReady = ffmpeg.ok === true;

  logger.info('analyzing media', { executable, urlLength: url.length, ffmpegReady });

  let attempt = 0;
  for (;;) {
    try {
      const { stdout, stderr } = await runYtDlp(args, {
        timeout: config.timeouts.analyze,
        signal: options.signal,
      });

      const raw = parseJsonOutput(stdout, stderr);

      if (raw?._type === 'playlist' && Array.isArray(raw.entries) && raw.entries.length > 0) {
        // `--no-playlist` is set, but some extractors still answer with a wrapper.
        return analyzeEntry(raw.entries[0], url, stderr, ffmpegReady);
      }

      return analyzeEntry(raw, url, stderr, ffmpegReady);
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt];
      const fastRefusal = error?.elapsedMs !== undefined && error.elapsedMs < FAST_REFUSAL_MS;

      // Only a refusal that came back quickly is worth another attempt. That is
      // the shape of a soft block: the platform answers in a few seconds. A slow
      // failure is a timeout, and retrying it just triples the wait before the
      // reader gets the same answer.
      if (!TRANSIENT_CODES.has(error?.code) || delay === undefined || !fastRefusal) throw error;

      logger.warn('transient source refusal, retrying', {
        attempt: attempt + 1,
        delay,
        code: error.code,
        elapsedMs: error.elapsedMs,
      });
      attempt += 1;
      await sleep(delay, options.signal);
    }
  }
}

function analyzeEntry(raw, url, stderr, ffmpegReady) {
  if (!raw || typeof raw !== 'object' || raw.id === undefined) {
    throw new AppError('EXTRACTOR_ERROR', 'The source returned no usable metadata.', 502);
  }

  const rawFormats = Array.isArray(raw.formats) ? raw.formats : [];
  const formats = rawFormats.map(mapFormat).filter(Boolean);

  // Some sources publish nothing but HLS. Those streams are real and yt-dlp can
  // fetch them, but only FFmpeg can turn them into a file, so they are offered
  // exclusively when FFmpeg is actually installed.
  let streams = [];
  if (formats.length === 0) {
    streams = ffmpegReady ? rawFormats.map(mapStreamFormat).filter(Boolean) : [];
  }

  const all = formats.length ? formats : streams;

  const videoFormats = all.filter((f) => f.kind === 'video' || f.kind === 'muxed');
  const audioFormats = all.filter((f) => f.kind === 'audio');

  if (all.length === 0) {
    throw new AppError(
      'FORMAT_UNAVAILABLE',
      'No compatible downloadable format is available for this media.',
      422,
    );
  }

  const uploader = raw.uploader || raw.channel || raw.creator || raw.artist || null;
  const duration = Number.isFinite(raw.duration) ? raw.duration : null;

  return {
    id: String(raw.id),
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : `Media ${String(raw.id)}`,
    uploader,
    uploaderUrl: typeof raw.uploader_url === 'string' ? raw.uploader_url : null,
    uploaderId: raw.uploader_id || null,
    duration,
    durationText: formatDuration(duration),
    thumbnail: pickThumbnail(raw),
    webpageUrl: typeof raw.webpage_url === 'string' ? raw.webpage_url : url,
    extractor: raw.extractor_key || raw.extractor || null,
    extractorKey: raw.extractor_key || null,
    isLive: raw.is_live === true,
    wasLive: raw.was_live === true,
    viewCount: Number.isFinite(raw.view_count) ? raw.view_count : null,
    likeCount: Number.isFinite(raw.like_count) ? raw.like_count : null,
    ageLimit: Number.isFinite(raw.age_limit) ? raw.age_limit : null,
    license: raw.license || null,
    categories: Array.isArray(raw.categories) ? raw.categories.slice(0, 6) : [],
    formats: all,
    videoFormats,
    audioFormats,
    /** True when every option has to be remuxed by FFmpeg. */
    streamsOnly: formats.length === 0 && streams.length > 0,
    hasVideo: videoFormats.length > 0,
    hasAudio: audioFormats.length > 0,
  };
}

/**
 * Resolve a requested format into a concrete yt-dlp selector.
 *
 * @param {string} formatId either `best` or an identifier verified against real metadata
 * @param {'muxed'|'video'|'audio'} kind
 * @param {boolean} isStream true for an HLS/DASH manifest that FFmpeg must remux
 * @returns {{ selector: string, merge: boolean, needsFfmpeg: boolean, ext: string }}
 */
export function buildSelector(formatId, kind, isStream = false) {
  if (formatId === BEST_PRESET) {
    return { selector: BEST_VIDEO_SELECTOR, merge: true, needsFfmpeg: true, ext: 'mp4' };
  }

  // A video-only stream has to be paired with an audio track. Only an M4A (AAC)
  // track is accepted, because that is what makes the merged MP4 playable
  // everywhere — `bestaudio` alone prefers the largest stream, which is usually
  // Opus, and an Opus track inside an MP4 is what plays silent or not at all.
  if (kind === 'video') {
    return {
      selector: `${formatId}+bestaudio[ext=m4a]/bestaudio`,
      merge: true,
      needsFfmpeg: true,
      ext: 'mp4',
    };
  }

  // An HLS manifest is a playlist, not a file: yt-dlp needs FFmpeg to fetch the
  // segments and write a container. Without it this option simply cannot work.
  if (isStream) {
    return { selector: formatId, merge: false, needsFfmpeg: true, ext: 'mp4' };
  }

  return { selector: formatId, merge: false, needsFfmpeg: false, ext: null };
}

/**
 * Download a real file into an isolated job directory.
 *
 * @returns {Promise<{ filePath: string, fileName: string, size: number, mimeType: string }>}
 */
export async function downloadMedia({ url, formatId, kind, isStream = false, jobDir, signal, onProgress }) {
  await requireTool('yt-dlp');

  const { selector, merge, needsFfmpeg, ext: targetExt } = buildSelector(formatId, kind, isStream);

  if (needsFfmpeg) {
    const ffmpeg = await detectFfmpeg();
    if (!ffmpeg.ok) {
      throw new AppError(
        'FFMPEG_MISSING',
        'This option needs FFmpeg to combine the best video and audio streams, but FFmpeg is not installed on the server. Choose a combined format instead.',
        503,
        { details: { reason: ffmpeg.error } },
      );
    }
    await requireTool('ffmpeg');
  }

  const args = [
    ...BASE_ARGS.filter((arg) => arg !== '--no-progress'),
    '--newline',
    '--no-simulate',
    '--print',
    'after_move:%(filepath)s',
    '--paths',
    jobDir,
    '--output',
    '%(id)s.%(ext)s',
    '--format',
    selector,
    // yt-dlp's own recipe for an MP4 target: merge into MP4, then remux so the
    // container is written properly. Compatibility comes from the selector,
    // which only ever accepts an M4A (AAC) audio track — there is no
    // `--audio-codec` flag in yt-dlp, and passing one aborts the whole run.
    ...(merge ? ['--merge-output-format', targetExt, '--remux-video', targetExt] : []),
    url,
  ];

  logger.info('starting download', { selector, merge, jobDir: path.basename(jobDir) });

  // The engine's own chatter is the only honest source of "what is happening
  // right now". It is forwarded rather than swallowed so the client can show a
  // real stage instead of an unexplained pause.
  //
  // Both streams are watched on purpose: yt-dlp writes progress to STDOUT and
  // diagnostics to STDERR, and `--no-warnings` leaves the latter almost empty,
  // so watching stderr alone would show nothing at all. The final stdout is
  // still returned intact, which is where the resulting file path is read from.
  const { stdout } = await runYtDlp(args, {
    timeout: config.timeouts.download,
    signal,
    maxBuffer: 1024 * 1024,
    onStdout: onProgress ? (line) => onProgress(line) : undefined,
    onStderr: onProgress ? (line) => onProgress(line) : undefined,
  });

  const reported = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('after_move:'))
    .map((line) => line.slice('after_move:'.length).trim())
    .filter(Boolean)
    .pop();

  let filePath = null;
  if (reported && !path.isAbsolute(reported)) {
    filePath = path.join(jobDir, reported);
  } else if (reported && path.resolve(reported).startsWith(path.resolve(jobDir))) {
    filePath = reported;
  }

  if (!filePath) {
    const files = await listJobFiles(jobDir);
    filePath = files[0]?.path ?? null;
  }

  if (!filePath) {
    throw new AppError('DOWNLOAD_FAILED', 'The download finished but no media file was produced.', 502);
  }

  const stats = await fs.stat(filePath);
  if (!Number.isFinite(stats.size) || stats.size === 0) {
    throw new AppError('DOWNLOAD_FAILED', 'The produced file was empty. Please try another format.', 502);
  }

  const fileName = path.basename(filePath);
  const ext = path.extname(fileName).toLowerCase();

  return {
    filePath,
    fileName,
    size: stats.size,
    mimeType: MIMETYPES[ext] || 'application/octet-stream',
  };
}

/**
 * Build a safe, human friendly download filename.
 *
 * The value is derived from the media title but is fully sanitised, and the
 * filesystem path is never derived from user input.
 */
export function buildDownloadFilename({ title, id, fileName }) {
  const ext = path.extname(fileName || '') || '.mp4';
  const cleaned = String(title || 'truetube-download')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  const base = cleaned || `truetube-${id}`;
  const ascii = base.replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '').trim() || `truetube-${id}`;
  return { ascii: `${ascii}${ext}`, utf8: `${base}${ext}` };
}
