// Bakes the home route's head tags into the built index.html.
//
// The server injects a full head per route at request time, so the built HTML
// deliberately ships without one — every tag in it would otherwise belong to a
// single route while the file serves all of them. That is right for a host that
// runs the server, and wrong for a static one: served by Vercel or GitHub Pages
// nothing was injected, and the page reached a crawler with no title, no
// description and no canonical at all.
//
// So the home page's tags are written into the file after the build, from the
// same renderHead the server uses. Per-route tags still need the server; this
// only makes the static copy describe itself honestly instead of describing
// nothing.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { metaForPath, renderHead } from '../server/src/services/seoMeta.js';

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, '..', 'server', 'public', 'index.html');

const html = readFileSync(file, 'utf8');

if (/<title>/.test(html)) {
  console.log('index.html already has a title, left alone');
  process.exit(0);
}

// metaForPath, not DEFAULT_META: the canonical URL is added by the lookup and
// DEFAULT_META carries no `url` of its own, so rendering it directly wrote
// href="undefined" into the page — a canonical pointing at nothing, which is
// worse for crawlers than having none at all.
const meta = metaForPath('/');
if (!meta?.url) {
  console.error('metaForPath("/") returned no url; refusing to bake a broken head');
  process.exit(1);
}

const head = renderHead(meta);
if (head.includes('undefined')) {
  console.error('rendered head contains "undefined"; refusing to write it');
  process.exit(1);
}

const anchor = html.match(/<meta name="color-scheme"[^>]*>/);

if (!anchor) {
  console.error('could not find an anchor in <head> to insert after');
  process.exit(1);
}

writeFileSync(file, html.replace(anchor[0], `${anchor[0]}\n    ${head}`), 'utf8');
console.log(`baked home head into index.html (${head.length} chars, url ${meta.url})`);
