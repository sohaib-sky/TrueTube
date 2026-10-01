import { z } from 'zod';
import { AppError } from '../utils/AppError.js';
import { validateMediaUrl, metadataKey } from '../utils/urlValidator.js';
import { assertPublicHostname } from '../utils/network.js';
import { analyzeMedia } from '../services/mediaService.js';
import { getCapabilities } from '../services/dependencyDetector.js';
import { getCachedMetadata, setCachedMetadata } from '../services/metadataStore.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const urlBody = z.object({
  url: z
    .string({ required_error: 'Enter a video URL to continue.', invalid_type_error: 'The URL must be text.' })
    .trim()
    .min(4, 'Enter a video URL to continue.')
    .max(2048, 'That URL is too long to process.'),
});

/** Validate a URL end-to-end: shape, allowlist, then DNS resolution. */
export async function resolveTarget(rawUrl) {
  const target = validateMediaUrl(rawUrl);
  await assertPublicHostname(target.host);
  return target;
}

/**
 * POST /api/validate
 * Client-side assistance endpoint: tells the caller whether a link would be
 * accepted, without invoking the download engine.
 */
export const validate = asyncHandler(async (req, res) => {
  const body = await parseBody(urlBody, req.body);

  let target;
  try {
    target = validateMediaUrl(body.url);
  } catch (error) {
    const appError = AppError.from(error, 'INVALID_URL', 'That URL is not valid.');
    return res.status(appError.status).json(appError.toJSON());
  }

  res.json({
    success: true,
    data: {
      valid: true,
      host: target.host,
      platform: target.platform,
      normalisedUrl: target.url,
    },
  });
});

/**
 * POST /api/analyze
 * Runs yt-dlp and returns the real metadata + available formats.
 */
export const analyze = asyncHandler(async (req, res) => {
  const body = await parseBody(urlBody, req.body);
  const target = await resolveTarget(body.url);

  const startedAt = Date.now();
  const metadata = await analyzeMedia(target.url);
  const capabilities = await getCapabilities();

  const enriched = {
    ...metadata,
    platform: target.platform,
    host: target.host,
    capabilities: {
      mergeAvailable: capabilities.canMergeStreams,
      engineReady: capabilities.ytDlp.available,
    },
  };

  setCachedMetadata(metadataKey(target.url), {
    id: metadata.id,
    title: metadata.title,
    formats: metadata.formats.map((f) => ({ id: f.id, kind: f.kind, ext: f.ext })),
  });

  logger.info('analysis complete', { host: target.host, formats: metadata.formats.length, ms: Date.now() - startedAt });

  res.json({ success: true, data: enriched });
});

/**
 * GET /api/formats?url=...
 * Convenience alias that returns only the format list of a real analysis.
 */
export const formats = asyncHandler(async (req, res) => {
  const body = await parseBody(urlBody, { url: req.query.url });
  const target = await resolveTarget(body.url);
  const metadata = await analyzeMedia(target.url);

  res.json({
    success: true,
    data: {
      id: metadata.id,
      title: metadata.title,
      platform: target.platform,
      formats: metadata.formats,
    },
  });
});

/** Read cached metadata for a URL, analysing it once if the cache is cold. */
export async function resolveMetadataFor(url) {
  const key = metadataKey(url);
  const cached = getCachedMetadata(key);
  if (cached) return cached;

  const metadata = await analyzeMedia(url);
  const entry = {
    id: metadata.id,
    title: metadata.title,
    formats: metadata.formats.map((f) => ({ id: f.id, kind: f.kind, ext: f.ext })),
  };
  setCachedMetadata(key, entry);
  return entry;
}

/** Shared zod parsing that always throws an AppError-safe error shape. */
export async function parseBody(schema, payload) {
  const result = schema.safeParse(payload ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const appError = new AppError('VALIDATION_ERROR', issue?.message || 'The request payload is invalid.', 400, {
      details: { field: issue?.path?.join('.') },
    });
    throw appError;
  }
  return result.data;
}
