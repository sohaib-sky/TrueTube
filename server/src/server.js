import { createApp } from './app.js';
import config from './config.js';
import { logger } from './utils/logger.js';
import { ensureDownloadDir, startJobSweeper, sweepStaleJobs } from './services/tempFiles.js';
import { getCapabilities } from './services/dependencyDetector.js';

async function main() {
  await ensureDownloadDir();
  // Clean up anything left behind by a previous (possibly killed) process.
  await sweepStaleJobs();
  const stopSweeper = startJobSweeper();

  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info('TrueTube API listening', {
      url: `http://localhost:${config.port}`,
      env: config.nodeEnv,
      clientUrl: config.clientUrl,
      downloadDir: config.downloadDir,
    });

    getCapabilities()
      .then((capabilities) => {
        if (!capabilities.ytDlp.available) {
          logger.error(
            'yt-dlp is NOT available — /api/analyze and /api/download will return 503 YTDLP_UNAVAILABLE',
            { reason: capabilities.ytDlp.reason },
          );
        } else {
          logger.info('yt-dlp ready', { version: capabilities.ytDlp.version });
        }
        if (!capabilities.ffmpeg.available) {
          logger.warn('ffmpeg is NOT available — formats that merge audio and video will return 503');
        } else {
          logger.info('ffmpeg ready', { version: capabilities.ffmpeg.version });
        }
      })
      .catch((error) => logger.error('dependency detection failed', { reason: error.message }));
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`port ${config.port} is already in use. Set a different PORT in .env.`);
    } else {
      logger.error('server error', { reason: error.message });
    }
    process.exit(1);
  });

  server.headersTimeout = 65_000;
  server.requestTimeout = 0; // downloads are long-running; guarded by yt-dlp timeout instead

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`received ${signal}, shutting down`);
    stopSweeper();
    server.close(() => {
      logger.info('http server closed');
      process.exit(0);
    });
    setTimeout(() => {
      logger.warn('forcing shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled promise rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
  });
  process.on('uncaughtException', (error) => {
    logger.error('uncaught exception', { reason: error.message });
    shutdown('uncaughtException');
  });
}

main().catch((error) => {
  logger.error('failed to start TrueTube API', { reason: error.message });
  process.exit(1);
});
