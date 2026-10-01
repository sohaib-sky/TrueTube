// Regenerates sitemap.xml from the server's route table.
//
// The sitemap was hand-maintained, which is exactly how it ended up listing
// pages the router does not serve. Generating it from the same table the server
// uses means a new route is discoverable by adding one entry, and a renamed route
// cannot be left behind in a stale sitemap.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listRoutes } from '../server/src/services/seoMeta.js';

const here = dirname(fileURLToPath(import.meta.url));
const outFile = join(here, '..', 'client', 'public', 'sitemap.xml');

// A build date is more useful than a constant: it tells a crawler the file was
// regenerated. Only the date changes, never the URL set, so a daily rebuild
// cannot falsely signal that every page changed.
const today = new Date().toISOString().slice(0, 10);

const urls = listRoutes()
  .map((route) => {
    const priority = route.path === '/' ? '1.0' : '0.4';
    const changefreq = route.path === '/' ? 'weekly' : 'yearly';
    return [
      '  <url>',
      `    <loc>${route.url}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority}</priority>`,
      '  </url>',
    ].join('\n');
  })
  .join('\n');

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  urls,
  '</urlset>',
  '',
].join('\n');

writeFileSync(outFile, xml, 'utf8');
console.log(`wrote sitemap.xml with ${listRoutes().length} routes`);
