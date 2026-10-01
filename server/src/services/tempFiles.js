import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import config from '../config.js';
import { logger } from '../utils/logger.js';

const JOB_PREFIX = 'job-';
/** Renamed leftovers that could not be deleted yet (Windows file locks). */
const TRASH_PREFIX = 'trash-';
const MANAGED_PREFIXES = [JOB_PREFIX, TRASH_PREFIX];

let sweeperStarted = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function ensureDownloadDir() {
  await fs.mkdir(config.downloadDir, { recursive: true, mode: 0o700 });
  return config.downloadDir;
}

/**
 * Create an isolated directory for one download job.
 *
 * Filenames inside are produced by yt-dlp from the media id, never from the
 * user supplied title, so a malicious title cannot influence the path.
 */
export async function createJobDir() {
  await ensureDownloadDir();
  const name = `${JOB_PREFIX}${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`;
  const dir = path.join(config.downloadDir, name);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  return dir;
}

/**
 * Remove a job directory.
 *
 * The directory is first renamed out of the way, so it disappears from the
 * download folder immediately even when the OS still holds file handles (the
 * child process may be a moment behind the timeout). Node's own `maxRetries`
 * covers EBUSY/EPERM, and anything that survives is picked up by the sweeper.
 */
export async function removeJobDir(dir) {
  if (!dir || !dir.startsWith(config.downloadDir)) return;

  let target = dir;
  const renamed = path.join(
    config.downloadDir,
    path.basename(dir).replace(JOB_PREFIX, TRASH_PREFIX),
  );

  try {
    await fs.rename(dir, renamed);
    target = renamed;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn('could not stage job directory for deletion', { reason: error.code });
    }
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await fs.rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
      return;
    } catch (error) {
      if (error.code === 'ENOENT') return;
      logger.warn('failed to remove job directory', {
        dir: path.basename(target),
        attempt,
        reason: error.code,
      });
      await sleep(300 * (attempt + 1));
    }
  }

  logger.warn('job directory left for the sweeper', { dir: path.basename(target) });
}

/** List files in a job directory, largest first. */
export async function listJobFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.part') || entry.name.endsWith('.ytdl')) continue;
    const filePath = path.join(dir, entry.name);
    const stats = await fs.stat(filePath);
    files.push({ name: entry.name, path: filePath, size: stats.size });
  }
  return files.sort((a, b) => b.size - a.size);
}

/**
 * Remove abandoned job directories (crashes, restarts, killed processes).
 * Only directories created by this service (job- and trash- prefixes) are touched.
 */
export async function sweepStaleJobs() {
  const maxAgeMs = config.limits.tempFileMaxAgeMinutes * 60_000;
  let removed = 0;

  let entries;
  try {
    entries = await fs.readdir(config.downloadDir, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!MANAGED_PREFIXES.some((prefix) => entry.name.startsWith(prefix))) continue;

    const dir = path.join(config.downloadDir, entry.name);
    try {
      const stats = await fs.stat(dir);
      if (Date.now() - stats.mtimeMs > maxAgeMs) {
        await fs.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
        removed += 1;
      }
    } catch (error) {
      logger.warn('stale job cleanup failed', { dir: entry.name, reason: error.code });
    }
  }

  if (removed > 0) logger.info('removed stale download jobs', { removed });
  return removed;
}

/** Start the periodic sweeper (idempotent). */
export function startJobSweeper(intervalMs = 10 * 60_000) {
  if (sweeperStarted) return () => {};
  sweeperStarted = true;

  const tick = () => {
    sweepStaleJobs().catch((error) => logger.error('sweeper failed', { reason: error.message }));
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  logger.info('temporary file sweeper started', { intervalMs, maxAgeMinutes: config.limits.tempFileMaxAgeMinutes });

  return () => {
    clearInterval(timer);
    sweeperStarted = false;
  };
}
