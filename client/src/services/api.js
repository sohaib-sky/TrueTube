/**
 * TrueTube API client.
 *
 * Every call hits the real backend. There are no mock responses: when the API
 * cannot be reached the caller receives an ApiError and the UI shows it.
 */

const API_BASE = '/api';

/** Error carrying the backend's stable error code and user-safe message. */
export class ApiError extends Error {
  constructor({ code, message, status, details }) {
    super(message || 'Something went wrong. Please try again.');
    this.name = 'ApiError';
    this.code = code || 'UNKNOWN_ERROR';
    this.status = status ?? 0;
    this.details = details ?? null;
  }
}

const NETWORK_MESSAGE =
  'Could not reach the TrueTube API. Check your connection and try again.';

async function toApiError(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (payload && payload.error) {
    return new ApiError({
      code: payload.error.code,
      message: payload.error.message,
      status: response.status,
      details: payload.error.details,
    });
  }

  if (response.status === 429) {
    return new ApiError({
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please wait a moment and try again.',
      status: response.status,
    });
  }

  // A 404 that is not our JSON envelope means the request never reached the
  // API — a static host serving the frontend with no backend behind it, or a
  // proxy answering on its behalf. Saying "unreadable response" there is
  // actively misleading: it reads like a busy server and sends people off to
  // retry something that cannot succeed until a backend exists.
  if (response.status === 404) {
    return new ApiError({
      code: 'BACKEND_UNAVAILABLE',
      message: 'The download service is not running. This page is only the interface.',
      status: response.status,
    });
  }

  return new ApiError({
    code: 'BAD_RESPONSE',
    message: 'The server returned an unexpected response.',
    status: response.status,
  });
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError({ code: 'NETWORK_ERROR', message: NETWORK_MESSAGE, status: 0 });
  }

  if (!response.ok) throw await toApiError(response);
  return response;
}

/** GET /api/supported — the live hostname allowlist. */
export async function getSupportedSources({ signal } = {}) {
  const response = await request('/supported', { signal });
  const payload = await response.json();
  return payload.data;
}

/** POST /api/analyze — returns real metadata and the real format list. */
export async function analyzeUrl(url, { signal } = {}) {
  const response = await request('/analyze', { method: 'POST', body: { url }, signal });
  const payload = await response.json();
  return payload.data;
}

function parseFilename(header) {
  if (!header) return null;
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      /* fall through to the plain filename */
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1].trim() : null;
}

/**
 * POST /api/download
 *
 * Streams the produced file through the browser. `onProgress` reports *real*
 * bytes received over the wire — never a simulated value.
 *
 * @returns {Promise<{ fileName: string, size: number }>}
 */
export async function downloadFormat({ url, formatId, kind, signal, onProgress, onStage } = {}) {
  // An opaque handle so the server can report what the engine is doing during
  // the window before any byte reaches the browser.
  const jobId = `job-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;

  const stagePoll = onStage ? startStagePolling(jobId, signal, onStage) : null;

  let response;
  try {
    response = await request('/download', {
      method: 'POST',
      body: { url, formatId, kind, jobId },
      signal,
    });
  } finally {
    stagePoll?.stop();
  }

  const total = Number.parseInt(response.headers.get('Content-Length') || '0', 10) || 0;
  const fileName = parseFilename(response.headers.get('Content-Disposition')) || 'truetube-download';

  if (!response.body || typeof response.body.getReader !== 'function') {
    const blob = await response.blob();
    onProgress?.({ received: blob.size, total: total || blob.size, ratio: 1 });
    return { fileName, size: blob.size, blob };
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress?.({ received, total, ratio: total > 0 ? Math.min(received / total, 1) : 0 });
  }

  const blob = new Blob(chunks, {
    type: response.headers.get('Content-Type') || 'application/octet-stream',
  });

  return { fileName, size: blob.size, blob };
}

/**
 * Human wording for each server-reported stage.
 *
 * These describe what the engine is genuinely doing — the server derives them
 * from yt-dlp's own output — so the wait is explained rather than blank.
 */
const STAGE_LABELS = {
  queued: 'Waiting for a free download slot',
  contacting: 'Contacting the source',
  downloading: 'Downloading from the source',
  merging: 'Combining the best audio and video',
  streaming: 'Sending the file to you',
  done: 'Download ready',
  failed: 'Download failed',
};

/**
 * Poll the server for what the engine is doing, so the pre-transfer window is
 * never an unexplained pause. Reports the real stage and real elapsed time.
 */
function startStagePolling(jobId, signal, onStage) {
  const tick = async () => {
    if (signal?.aborted) return;
    try {
      const res = await fetch(`/api/download/status?jobId=${encodeURIComponent(jobId)}`, { signal });
      if (!res.ok) return;
      const payload = await res.json();
      const data = payload?.data;
      if (!data || data.stage === 'streaming' || data.stage === 'done') return;
      onStage({ ...data, label: STAGE_LABELS[data.stage] ?? 'Working on it' });
    } catch {
      // A failed poll is not news; the transfer itself reports the outcome.
    }
  };

  // First report lands almost immediately, then settles into a steady rhythm.
  const timer = window.setInterval(tick, 1200);
  void tick();
  return { stop: () => window.clearInterval(timer) };
}

export { STAGE_LABELS };

/** Hand a completed blob to the browser as a real file download. */
export function saveBlob({ blob, fileName }) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
