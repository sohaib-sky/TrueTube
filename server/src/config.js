import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const here = path.dirname(fileURLToPath(import.meta.url));

/** Project root (…/truetube) */
export const ROOT_DIR = path.resolve(here, '..', '..');
/** …/truetube/server */
export const SERVER_DIR = path.resolve(here, '..');
/** Built frontend output, served by the API in production. */
export const CLIENT_DIST_DIR = path.join(SERVER_DIR, 'public');

const argv = process.argv.slice(2);
const forcedProduction = argv.includes('--production') || argv.includes('start');

function toInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toBool(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function resolveFromRoot(value, fallback) {
  const target = value && String(value).trim() ? String(value).trim() : fallback;
  return path.isAbsolute(target) ? target : path.resolve(ROOT_DIR, target);
}

/**
 * Locate an external binary.
 *
 * A relative configured path is resolved from the project root, and when nothing
 * is configured the bundled `.tools/` copy is used if it is there. Only when
 * neither applies does this return an empty string, which is the signal for the
 * dependency detector to fall back to a plain PATH lookup.
 *
 * The point is portability: an absolute path baked into `.env` pins the project
 * to one machine, so the moment the folder is copied anywhere else the binary
 * silently disappears and every request fails with YTDLP_UNAVAILABLE.
 *
 * The bundled filename is platform-aware. Hard-coding `yt-dlp.exe` meant a
 * Linux deployment could never find its own tools directory and fell through to
 * PATH instead — the kind of thing that only shows up once the app runs
 * somewhere other than the machine it was built on.
 */
const IS_WINDOWS = process.platform === 'win32';

function resolveToolPath(value, toolName) {
  const raw = (value && String(value).trim()) ? String(value).trim() : '';
  if (raw) return path.isAbsolute(raw) ? raw : path.resolve(ROOT_DIR, raw);

  const bundled = path.join(ROOT_DIR, '.tools', IS_WINDOWS ? `${toolName}.exe` : toolName);
  return existsSync(bundled) ? bundled : '';
}

const nodeEnv = forcedProduction ? 'production' : (process.env.NODE_ENV || 'development');

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: toInt(process.env.PORT, 5000),
  clientUrl: (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  downloadDir: resolveFromRoot(process.env.DOWNLOAD_DIR, path.join('server', 'downloads')),
  trustProxy: toBool(process.env.TRUST_PROXY, false),
  ytdlpPath: resolveToolPath(process.env.YTDLP_PATH, 'yt-dlp'),
  ffmpegPath: resolveToolPath(process.env.FFMPEG_PATH, 'ffmpeg'),
  timeouts: {
    analyze: toInt(process.env.YTDLP_ANALYZE_TIMEOUT_MS, 45_000),
    // Downloads are long-running: a multi-gigabyte 4K file can take a while.
    download: toInt(process.env.YTDLP_DOWNLOAD_TIMEOUT_MS, 20 * 60_000),
    // Spare, because the version probe is only ever advisory: it must never be
    // the reason a request fails, and on a slow or busy host `yt-dlp --version`
    // can take several seconds just to start.
    detect: toInt(process.env.DETECT_TIMEOUT_MS, 20_000),
  },
  limits: {
    maxBuffer: toInt(process.env.YTDLP_MAX_BUFFER, 50 * 1024 * 1024),
    tempFileMaxAgeMinutes: toInt(process.env.TEMP_FILE_MAX_AGE_MINUTES, 30),
    bodySize: '8kb',
    /**
     * How many transfers may run at once. Each one is CPU and disk heavy, so
     * without a ceiling a few parallel requests starve every other request —
     * including the dependency probe the health endpoint waits on.
     */
    maxConcurrentDownloads: toInt(process.env.MAX_CONCURRENT_DOWNLOADS, 3),
    /** How long a queued download may wait before the client gives up. */
    downloadQueueTimeoutMs: toInt(process.env.DOWNLOAD_QUEUE_TIMEOUT_MS, 60_000),
  },
  /**
   * Per-IP request ceilings.
   *
   * These were hardcoded, which meant the only way to raise them for a public
   * deployment was to edit and rebuild the source. The defaults below are
   * unchanged, so nothing behaves differently unless it is asked to.
   *
   * They are per client IP, which is the whole reason TRUST_PROXY matters: with
   * a reverse proxy in front and the flag off, every visitor on the internet
   * shares one bucket.
   */
  rateLimit: {
    analyze: toInt(process.env.RATE_LIMIT_ANALYZE, 25),
    analyzeWindowMs: toInt(process.env.RATE_LIMIT_ANALYZE_WINDOW_MS, 10 * 60_000),
    download: toInt(process.env.RATE_LIMIT_DOWNLOAD, 10),
    downloadWindowMs: toInt(process.env.RATE_LIMIT_DOWNLOAD_WINDOW_MS, 10 * 60_000),
    api: toInt(process.env.RATE_LIMIT_API, 300),
    apiWindowMs: toInt(process.env.RATE_LIMIT_API_WINDOW_MS, 15 * 60_000),
    /**
     * Progress polling runs about once every 1.2s for the whole transfer, so
     * the ceiling has to cover a long download rather than a session. Anything
     * in the hundreds per minute is ample; below that the progress bar goes
     * quiet exactly on the slow downloads that need it most.
     */
    status: toInt(process.env.RATE_LIMIT_STATUS, 120),
    statusWindowMs: toInt(process.env.RATE_LIMIT_STATUS_WINDOW_MS, 60_000),
  },
  /** Metadata cache used to re-validate a chosen format before downloading. */
  metadataCache: {
    ttlMs: toInt(process.env.METADATA_CACHE_TTL_MS, 5 * 60_000),
    maxEntries: toInt(process.env.METADATA_CACHE_MAX, 200),
  },
};

export default config;
