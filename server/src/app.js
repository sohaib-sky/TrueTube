import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import config, { CLIENT_DIST_DIR } from './config.js';
import { DEFAULT_META, metaForPath, renderHead } from './services/seoMeta.js';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

export function createApp() {
  const app = express();

  // Correct client IPs (and therefore rate limits) only behind a trusted proxy.
  app.set('trust proxy', config.trustProxy ? 1 : false);
  app.disable('x-powered-by');
  app.set('etag', 'strong');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // React sets inline style attributes and Framer Motion injects styles.
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          // Media thumbnails are served by third-party CDNs.
          imgSrc: ["'self'", 'data:', 'https:'],
          mediaSrc: ["'self'", 'blob:'],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
          connectSrc: ["'self'", config.clientUrl],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: config.isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: config.isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
    }),
  );

  app.use(
    cors({
      origin: config.clientUrl,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
      maxAge: 600,
      credentials: false,
    }),
  );

  app.use(express.json({ limit: config.limits.bodySize, strict: true }));

  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) return next();
    res.setHeader('Cache-Control', 'no-store');
    logger.debug('request', { method: req.method, path: req.path, ip: req.ip });
    return next();
  });

  app.use('/api', apiRoutes);

  app.use('/api', notFoundHandler);

  app.use(serveStaticClient);

  app.use(notFoundHandler);

  app.use(errorHandler);

  return app;
}

/** Marker in index.html that the generated per-route head replaces. */
const SEO_HEAD_MARKER = '<!--seo-head-->';

/** How long the built index.html stays in memory; it changes only on a build. */
const INDEX_CACHE_MS = 60_000;

let indexCache = { at: 0, template: null };

/**
 * Read index.html and cache it, so a per-request head rewrite does not mean a
 * disk read on every page view.
 */
function readIndexTemplate() {
  const now = Date.now();
  if (indexCache.template && now - indexCache.at < INDEX_CACHE_MS) {
    return Promise.resolve(indexCache.template);
  }

  return fs
    .readFile(path.join(CLIENT_DIST_DIR, 'index.html'), 'utf8')
    .then((contents) => {
      if (!contents.includes(SEO_HEAD_MARKER)) {
        // A build that lost the marker would silently serve one head for every
        // route, which is the exact bug this rewrite exists to remove. Say so.
        throw new Error('index.html is missing the <!--seo-head--> marker');
      }
      indexCache = { at: now, template: contents };
      return contents;
    });
}

/**
 * Send the app shell with a head built for this specific route.
 *
 * `status` is 404 for an unknown path on purpose. The previous fallback
 * returned the home page with a 200 for every URL that was not a file, so any
 * mistyped or scraped link looked like a real page: an endless supply of thin
 * duplicates that compete with the pages that matter. The body is still the
 * shell, so a person gets the app's own not-found page, but the status line is
 * now truthful and the head asks not to be indexed.
 */
function sendShell(req, res, routePath) {
  const known = metaForPath(routePath);
  const meta = known
    ? { ...known }
    : {
        ...DEFAULT_META,
        title: 'Page not found — TrueTube',
        description: 'That page does not exist on TrueTube.',
        robots: 'noindex, follow',
        url: `${req.protocol}://${req.get('host') ?? 'localhost'}${routePath}`,
      };

  return readIndexTemplate()
    .then((template) => {
      const head = renderHead(meta);
      const html = template.includes(SEO_HEAD_MARKER)
        ? template.replace(SEO_HEAD_MARKER, head)
        : template;
      res.status(known ? 200 : 404);
      res.setHeader('Content-Type', MIME_TYPES['.html']);
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(html);
    })
    .catch((error) => {
      logger.error('failed to render the client shell', { reason: error.message });
      res.status(503).type('text/plain').send(
        'TrueTube frontend build not found. Run "npm run build" for production, or use "npm run dev" for development.',
      );
      return undefined;
    });
}

/**
 * Serves the production build when it exists, with an SPA fallback so
 * /privacy and /terms resolve to the client router.
 */
function serveStaticClient(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const indexPath = path.join(CLIENT_DIST_DIR, 'index.html');

  return fs
    .stat(indexPath)
    .then((stats) => {
      if (!stats.isFile()) throw new Error('not a file');

      const relative = path.normalize(req.path).replace(/^[/\\]+/, '');
      const requested = path.resolve(CLIENT_DIST_DIR, relative);
      const inside = requested === CLIENT_DIST_DIR || requested.startsWith(CLIENT_DIST_DIR + path.sep);
      const isAsset = relative !== '' && path.extname(requested) !== '';
      const target = inside && isAsset ? requested : indexPath;
      const resolvedIsAsset = target !== indexPath;

      if (!resolvedIsAsset) {
        return sendShell(req, res, req.path || '/');
      }

      res.setHeader('Content-Type', MIME_TYPES[path.extname(target)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      return fs
        .stat(target)
        .then(() => res.sendFile(target))
        .catch(() => {
          // Missing assets must 404 instead of silently returning HTML.
          res.status(404).type('text/plain').send('Not found');
          return undefined;
        });
    })
    .catch(() => {
      res.status(503).type('text/plain').send(
        'TrueTube frontend build not found. Run "npm run build" for production, or use "npm run dev" for development.',
      );
    });
}


export default createApp;
