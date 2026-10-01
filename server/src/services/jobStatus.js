import { AppError } from '../utils/AppError.js';

/**
 * Live status of in-flight downloads.
 *
 * Between the click and the first response byte there is genuinely nothing to
 * send — the engine is still contacting the source, choosing a stream and
 * fetching it. A progress bar that sits at zero through that window reads as a
 * frozen app, so the engine's own output is translated into a small set of
 * stages the client can show, and the wait is given a deadline so a request
 * that is never going to finish fails with a real answer.
 *
 * Nothing here fabricates a percentage. The stage comes from what yt-dlp
 * printed, and the byte progress still comes from the file being streamed.
 */

/** @typedef {'queued'|'contacting'|'downloading'|'merging'|'streaming'|'done'|'failed'} Stage */

const STAGES = /** @type {Stage[]} */ ([
  'queued',
  'contacting',
  'downloading',
  'merging',
  'streaming',
  'done',
  'failed',
]);

/**
 * How long a job may sit in a pre-stream stage before we give up on it.
 *
 * This bound exists so a request that is never going to finish hangs for a
 * limited time instead of holding a download slot forever.
 *
 * It used to be 150 seconds, which looked reasonable and was wrong: the engine
 * spends this whole window downloading, and a 20 MB file on a connection moving
 * at a few hundred KB per second legitimately takes longer than that. The timer
 * was killing downloads that were on track and reporting it as a client
 * cancellation, which then surfaced to the reader as "unable to process this
 * URL" — blaming their link for the server being impatient.
 *
 * A slow connection is a real and common condition, so the budget has to cover
 * it. The download timeout is the real ceiling on a transfer; this is only a
 * backstop against a process that has genuinely stopped making progress.
 */
const PREPARATION_DEADLINE_MS = 15 * 60_000;

/** How long a finished job stays readable, so a slow poll still sees it. */
const RETAIN_MS = 60_000;

const jobs = new Map();

const now = () => Date.now();

function entry(jobId) {
  let job = jobs.get(jobId);
  if (!job) {
    job = { stage: 'queued', startedAt: now(), updatedAt: now(), note: null, error: null, ratio: null };
    jobs.set(jobId, job);
  }
  return job;
}

/** Begin tracking a job. Called as soon as the request is accepted. */
export function startJob(jobId) {
  const job = entry(jobId);
  job.startedAt = now();
  job.updatedAt = now();
  job.stage = 'queued';
  job.note = null;
  job.error = null;
  return job;
}

/**
 * How far along a job is. Stages only ever move forward.
 *
 * Two independent sources report them — the directory and the engine's own
 * output — and they interleave: a late "loading the page" line from the engine
 * can arrive after the fragments are already on disk. Letting that regress the
 * stage makes the progress bar jump backwards, so ordering is enforced here
 * instead of trusting every source to be well behaved.
 */
const STAGE_ORDER = { queued: 0, contacting: 1, downloading: 2, merging: 3, streaming: 4, done: 5 };

/**
 * Advance a job to a stage. Unknown stages are ignored rather than trusted, so
 * a stray line from the engine cannot invent a state the client does not know.
 */
export function setStage(jobId, stage, note = null) {
  if (!STAGES.includes(stage)) return;
  const job = entry(jobId);
  if (stage === 'failed') {
    job.stage = stage;
    job.note = note ?? job.note;
    job.updatedAt = now();
    return;
  }
  const current = STAGE_ORDER[job.stage] ?? 0;
  if ((STAGE_ORDER[stage] ?? 0) < current) return;
  job.stage = stage;
  job.note = note ?? job.note;
  job.updatedAt = now();
}

export function failJob(jobId, error) {
  const job = entry(jobId);
  job.stage = 'failed';
  job.error = error instanceof AppError ? { code: error.code, message: error.message } : { code: 'DOWNLOAD_FAILED', message: 'The download did not complete.' };
  job.updatedAt = now();
}

export function finishJob(jobId) {
  const job = entry(jobId);
  job.stage = 'done';
  job.updatedAt = now();
}

/** @returns {{ stage: Stage, elapsedMs: number, note: string|null, ratio: number|null, error: object|null }|null} */
export function readJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  if (now() - job.updatedAt > RETAIN_MS && job.stage !== 'queued') {
    jobs.delete(jobId);
    return null;
  }
  return {
    stage: job.stage,
    elapsedMs: now() - job.startedAt,
    note: job.note,
    ratio: job.ratio,
    error: job.error,
  };
}

/**
 * Derive a stage from what is actually on disk.
 *
 * yt-dlp's own progress lines are unusable here: for HLS and DASH — which is
 * most of what people download — it hands the transfer to FFmpeg and prints
 * nothing at all, so parsing its output leaves the client staring at a frozen
 * bar. The job directory, on the other hand, is ground truth: a growing `.part`
 * file means bytes are genuinely arriving, and several finished streams with no
 * partial means FFmpeg is genuinely combining them.
 *
 * @param {Array<{name: string, size: number}>} files
 * @param {number|null} expectedBytes total size if the source reported one
 * @returns {{ stage: Stage, note: string, ratio: number|null }}
 */
export function classifyFromDisk(files, expectedBytes) {
  if (!files.length) {
    return { stage: 'contacting', note: 'Contacting the source', ratio: null };
  }

  const partial = files.find((f) => f.name.endsWith('.part') || f.name.endsWith('.ytdl'));
  const done = files.filter((f) => !f.name.endsWith('.part') && !f.name.endsWith('.ytdl'));
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  // A partial file that is still growing is the download in progress, and its
  // size against the size the source advertised is a real percentage.
  if (partial) {
    const ratio =
      expectedBytes && expectedBytes > 0 ? Math.min(partial.size / expectedBytes, 0.99) : null;
    return { stage: 'downloading', note: 'Downloading from the source', ratio };
  }

  // Several complete streams and no partial: they are being combined.
  if (done.length > 1) {
    return { stage: 'merging', note: 'Combining audio and video', ratio: null };
  }

  if (totalBytes > 0) {
    const ratio =
      expectedBytes && expectedBytes > 0 ? Math.min(totalBytes / expectedBytes, 0.99) : null;
    return { stage: 'merging', note: 'Finishing up the file', ratio };
  }

  return { stage: 'contacting', note: 'Contacting the source', ratio: null };
}

/** Record a ratio alongside the stage, when the source gave us a total. */
export function setRatio(jobId, ratio) {
  if (ratio === null || ratio === undefined) return;
  const job = entry(jobId);
  job.ratio = Math.max(0, Math.min(ratio, 0.99));
  job.updatedAt = now();
}

/**
 * Translate a line of yt-dlp's own output into a stage.
 *
 * Returns null for anything unrecognised: silence is better than a wrong stage,
 * and the byte progress is what carries the detail.
 */
export function classifyYtDlpLine(line) {
  const text = String(line);
  if (!text) return null;

  // The machine-readable path print is not progress; it is the answer we read
  // the produced filename from.
  if (/^after_move:/i.test(text.trim())) return null;

  if (/\[Merger\]|\[mergeformats\]|Merging formats|merging formats/i.test(text)) {
    return { stage: 'merging', note: 'Combining audio and video' };
  }
  if (/\[ExtractAudio\]|Destination:.*\.(?:m4a|mp3|opus|ogg)/i.test(text)) {
    return { stage: 'merging', note: 'Preparing the audio track' };
  }
  if (/\[download\] Destination:|\[download\] Writing|has already been downloaded|\[download\] Downloading video/i.test(text)) {
    return { stage: 'downloading', note: 'Downloading from the source' };
  }
  if (/Requesting|Loading|Extracting|fetching|Deleting original|\[download\] Fetching/i.test(text)) {
    return { stage: 'contacting', note: 'Contacting the source' };
  }
  // yt-dlp's own percentage line, e.g. "[download]  42.1% of 13.79MiB".
  if (/\[\s*download\s*\].*\d{1,3}(?:\.\d)?%/.test(text)) {
    return { stage: 'downloading', note: 'Downloading from the source' };
  }
  if (/\d{1,3}(?:\.\d)?%/.test(text)) {
    return { stage: 'downloading', note: 'Downloading from the source' };
  }
  return null;
}

export { PREPARATION_DEADLINE_MS, STAGES };
