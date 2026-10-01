import os from 'node:os';
import config from '../config.js';
import { getCapabilities } from '../services/dependencyDetector.js';
import { listSupportedHosts, listSupportedPlatforms } from '../utils/urlValidator.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const API_VERSION = 'v1';

/**
 * GET /api/health
 * Reports real service state, including whether yt-dlp and FFmpeg are usable.
 */
export const health = asyncHandler(async (req, res) => {
  const capabilities = await getCapabilities();
  const healthy = capabilities.ytDlp.available;

  res.status(healthy ? 200 : 503).json({
    success: true,
    data: {
      status: healthy ? 'ok' : 'degraded',
      healthy,
      service: 'truetube-api',
      version: API_VERSION,
      environment: config.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      node: process.version,
      platform: `${os.platform()} ${os.arch()}`,
      capabilities,
      limits: {
        analyzeWindowMs: 10 * 60_000,
        analyzeMax: 25,
        downloadWindowMs: 10 * 60_000,
        downloadMax: 10,
      },
    },
  });
});

/**
 * GET /api/supported
 * Publishes the hostname allowlist so the client never advertises more than
 * the backend will actually attempt.
 */
export const supported = asyncHandler(async (req, res) => {
  const capabilities = await getCapabilities();

  res.json({
    success: true,
    data: {
      hosts: listSupportedHosts(),
      platforms: listSupportedPlatforms(),
      engineReady: capabilities.ytDlp.available,
      mergeAvailable: capabilities.canMergeStreams,
      note: 'Availability depends on the installed yt-dlp version and the source. Unsupported links return a real error.',
    },
  });
});
