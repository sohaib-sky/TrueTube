import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path, { basename } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import config from '../config.js';
import { createLimiter } from '../utils/limiter.js';
import {
  classifyFromDisk,
  classifyYtDlpLine,
  failJob,
  finishJob,
  PREPARATION_DEADLINE_MS,
  readJob,
  setRatio,
  setStage,
  startJob,
} from '../services/jobStatus.js';
import { downloadMedia, buildDownloadFilename, BEST_PRESET } from '../services/mediaService.js';
import { createJobDir, removeJobDir } from '../services/tempFiles.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { resolveTarget, resolveMetadataFor, parseBody } from './analyzeController.js';

/**
 * Transfers run a few at a time, never all at once. See createLimiter for why:
 * an unbounded number of concurrent downloads is what makes a small server look
 * randomly broken.
 */
const downloadSlots = createLimiter(config.limits.maxConcurrentDownloads);

const downloadBody = z.object({
  url: z
    .string({ required_error: 'Enter a video URL to continue.', invalid_type_error: 'The URL must be text.' })
    .trim()
    .min(4, 'Enter a video URL to continue.')
    .max(2048, 'That URL is too long to process.'),
  jobId: z
    .string()
    .trim()
    .min(8)
    .max(64)
    // Opaque client-side handle, used only to address this job's status. It
    // never reaches the engine or the filesystem.
    .regex(/^[A-Za-z0-9_-]+$/, 'That job reference is not valid.')
    .optional(),
  formatId: z
    .string({ required_error: 'Choose a format to download.', invalid_type_error: 'Invalid format selection.' })
    .trim()
    .min(1, 'Choose a format to download.')
    // Conservative character set: a format id can never contain a shell
    // metacharacter, whitespace or a path separator.
    .regex(/^(best|[A-Za-z0-9_.+-]{1,64})$/, 'That format identifier is not valid.'),
  kind: z
    .enum(['muxed', 'video', 'audio'])
    .optional()
    .describe('Stream composition hint; re-verified against real metadata.'),
});

/**
 * POST /api/download
 *
 * 1. validates the request and the URL,
 * 2. re-verifies that the requested format really exists for that URL,
 * 3. runs yt-dlp inside an isolated temporary directory,
 * 4. streams the produced file back as an attachment,
 * 5. removes the temporary directory (success, failure, timeout or client abort).
 */
export const download = asyncHandler(async (req, res) => {
  const body = await parseBody(downloadBody, req.body);
  const target = await resolveTarget(body.url);

  const metadata = await resolveMetadataFor(target.url);

  /** @type {string} */
  let formatId = body.formatId;
  let kind = body.kind || 'muxed';
  let isStream = false;

  if (formatId !== BEST_PRESET) {
    const match = metadata.formats.find((format) => format.id === formatId);
    if (!match) {
      throw new AppError(
        'INVALID_FORMAT',
        'That format is not available for this media. Re-analyze the link and choose an available option.',
        400,
      );
    }
    // The client's hint is never trusted: the kind comes from real metadata.
    kind = match.kind;
    isStream = match.isStream === true;
  } else {
    kind = 'muxed';
  }

  // Wait for a free slot, but never indefinitely: a queue that grows without
  // bound is its own kind of failure, and the reader deserves a real answer.
  if (downloadSlots.queued > 0) {
    logger.info('download queued', { waiting: downloadSlots.queued, running: downloadSlots.active });
  }

  let queueTimer;
  const queueExpiry = new Promise((_, rejectQueue) => {
    queueTimer = setTimeout(
      () => rejectQueue(new AppError('SERVER_BUSY', 'The server is busy with other downloads. Please try again in a moment.', 503)),
      config.limits.downloadQueueTimeoutMs,
    );
  });

  let releaseSlot;
  try {
    releaseSlot = await Promise.race([downloadSlots.acquire(), queueExpiry]);
  } catch (error) {
    clearTimeout(queueTimer);
    throw error;
  }
  clearTimeout(queueTimer);

  const jobDir = await createJobDir();
  const jobId = body.jobId;
  if (jobId) startJob(jobId);

  // Abort yt-dlp as soon as the client goes away. killTree in the runner makes
  // sure the whole process goes with it, so an abandoned transfer stops pulling
  // bytes instead of running on unseen.
  const controller = new AbortController();
  let streamed = false;

  // Ground-truth progress. yt-dlp prints nothing for HLS/DASH because it hands
  // those to FFmpeg, so the stage is read off the job directory instead: a
  // growing partial file really is bytes arriving, and its size against the
  // size the source advertised really is a percentage.
  let expectedBytes = null;
  if (formatId !== BEST_PRESET) {
    const chosen = metadata.formats.find((f) => f.id === formatId);
    expectedBytes = Number.isFinite(chosen?.filesize) ? chosen.filesize : null;
  }

  const diskWatcher = jobId
    ? setInterval(async () => {
        if (streamed) return;
        try {
          const names = await readdir(jobDir);
          const files = await Promise.all(
            names.map(async (name) => {
              // Not named `stat`: that would shadow the import for the whole
              // block and throw a temporal-dead-zone error on every tick.
              const info = await stat(path.join(jobDir, name)).catch(() => null);
              return info?.isFile() ? { name, size: info.size } : null;
            }),
          );
          const present = files.filter(Boolean);
          // A zero-byte placeholder means the transfer has not really begun.
          const stage = classifyFromDisk(
            present.filter((f) => f.size > 0 || /\.part$|\.ytdl$/i.test(f.name)),
            expectedBytes,
          );
          setStage(jobId, stage.stage, stage.note);
          setRatio(jobId, stage.ratio);
        } catch (error) {
          // Swallowing this silently used to hide a real failure: the bar sat at
          // "contacting" forever and nothing said why.
          logger.warn('progress probe failed', { reason: error.message });
        }
      }, 700)
    : null;

  // The engine's own output is forwarded to the status record, and a deadline
  // bounds the dead window before any byte can reach the client. Without it a
  // request that is never going to finish simply hangs.
  const preparationDeadline = setTimeout(() => {
    if (streamed) return;
    // Wrapped deliberately: a timer that throws takes the whole process with
    // it, and losing the API over a log line is not an acceptable trade.
    try {
      logger.warn('preparation deadline exceeded', { host: target.host, jobDir: basename(jobDir) });
    } catch {
      /* logging must never be fatal */
    }
    if (jobId) setStage(jobId, 'failed', 'The source took too long to prepare this file.');
    controller.abort();
  }, PREPARATION_DEADLINE_MS);
  const cleanup = () => {
    if (!streamed) controller.abort();
    removeJobDir(jobDir).catch((error) => logger.error('cleanup failed', { reason: error.message }));
  };

  // Both sides matter. Before any header is sent, a client that hangs up shows
  // up as `aborted`/`close` on the REQUEST; `res` only closes reliably once the
  // response has actually started. Listening on `res` alone is how a timed-out
  // client leaves a multi-hundred-megabyte transfer running on the server.
  req.on('aborted', cleanup);
  req.on('close', () => {
    if (!req.complete) cleanup();
  });
  res.on('close', cleanup);

  try {
    const file = await downloadMedia({
      url: target.url,
      formatId,
      kind,
      isStream,
      jobDir,
      signal: controller.signal,
      onProgress: jobId
        ? (line) => {
            const stage = classifyYtDlpLine(line);
            if (stage) setStage(jobId, stage.stage, stage.note);
          }
        : undefined,
    });

    if (jobId) setStage(jobId, 'streaming');

    const filename = buildDownloadFilename({ title: metadata.title, id: metadata.id, fileName: file.fileName });

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.size));
    res.setHeader('Content-Disposition', contentDisposition(filename));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('X-Content-Digest-Media-Id', encodeURIComponent(String(metadata.id).slice(0, 64)));

    logger.info('download ready', { host: target.host, formatId, bytes: file.size });

    streamed = true;
    clearTimeout(preparationDeadline);
    if (jobId) finishJob(jobId);
    await pipeline(createReadStream(file.filePath), res);
  } catch (error) {
    if (res.headersSent) {
      // The client disconnected mid-transfer: nothing useful left to send.
      if (error?.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
        logger.warn('stream interrupted', { reason: error.code || error.message });
      }
      res.end();
      return;
    }
    if (jobId) {
      failJob(jobId, error?.code === 'CLIENT_CLOSED_REQUEST' ? undefined : error);
      if (error?.code === 'CLIENT_CLOSED_REQUEST') setStage(jobId, 'failed', 'The download was cancelled.');
    }
    throw error;
  } finally {
    clearTimeout(preparationDeadline);
    if (diskWatcher) clearInterval(diskWatcher);
    // The slot belongs to the request, not to the happy path. A slot leaked on
    // an error would shrink capacity on every failure until nothing could run.
    releaseSlot();
  }
});

/**
 * GET /api/download/status?jobId=...
 *
 * What the engine is actually doing right now. There is no response body to
 * read during preparation, so this is the only honest thing the client can show
 * instead of an unexplained pause.
 */
export const status = asyncHandler(async (req, res) => {
  const jobId = String(req.query.jobId ?? '').trim();
  if (!jobId || !/^[A-Za-z0-9_-]{8,64}$/.test(jobId)) {
    throw new AppError('VALIDATION_ERROR', 'That job reference is not valid.', 400, {
      details: { field: 'jobId' },
    });
  }

  const job = readJob(jobId);
  res.json({
    success: true,
    data: job ?? { stage: 'queued', elapsedMs: 0, note: null, error: null },
  });
});

function contentDisposition({ ascii, utf8 }) {
  return `attachment; filename="${ascii.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(utf8)}`;
}

export default download;
