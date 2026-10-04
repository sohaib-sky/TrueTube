// Generates the client-side copy of the supported-source list.
//
// The Platforms section reads its allowlist live from GET /api/supported, which
// is the right default: the page can never advertise a source the engine would
// reject. But it made the section entirely dependent on that request. With no
// backend reachable, the fetch failed, the data stayed null, and the page
// rendered a grid of empty glass tiles — which reads as a broken site rather
// than as an unavailable API.
//
// So the same list is emitted here at build time, from the same module the
// server uses. It is a fallback, never the primary source: the live request
// still wins whenever it succeeds. Generating it rather than hand-writing it
// means the two cannot drift apart.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listSupportedPlatforms } from '../server/src/utils/urlValidator.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'client', 'src', 'data');
const outFile = join(outDir, 'supportedFallback.json');

const platforms = listSupportedPlatforms();

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, `${JSON.stringify({ platforms }, null, 2)}\n`, 'utf8');

console.log(`wrote supportedFallback.json with ${platforms.length} platforms`);
