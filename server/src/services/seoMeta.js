/**
 * Per-route document metadata, in one table.
 *
 * This has to be readable from two very different places: the server, which
 * renders the <head> that a crawler or a social unfurler actually receives, and
 * the browser, which has to correct the same values after a client-side
 * navigation. Keeping two hand-maintained copies of this data is how a page ends
 * up serving one route's canonical URL under another route's title, so both
 * sides import from here instead.
 *
 * The route keys must match the client's ROUTES table. Anything not listed is a
 * genuine 404 rather than another copy of the home page.
 */

/**
 * The public origin used for canonical tags, share images and the sitemap.
 *
 * Read from the environment because this value decides what a search engine
 * believes the site's address is. Left hardcoded, a deployment on a different
 * host would advertise someone else's domain, which is worse than having no
 * canonical at all: it actively tells crawlers to index the wrong address.
 */
export const SITE_URL = (process.env.SITE_URL || 'https://truetube.app').replace(/\/+$/, '');

export const DEFAULT_META = {
  path: '/',
  title: 'TrueTube — Modern Video Download Utility',
  description:
    'TrueTube is a modern media utility for analyzing supported video URLs, viewing the real formats a source offers and downloading the option you choose.',
  /** Long-tail phrases the page genuinely covers, used for the social blurb. */
  keywords:
    'video download utility, media downloader, format selection, yt-dlp, open source media tool',
  /** `noindex` on the 404 so a soft-404 never gets indexed as a real page. */
  robots: 'index, follow',
  ogType: 'website',
};

const ROUTE_META = [
  {
    path: '/',
    title: 'TrueTube — Modern Video Download Utility',
    description:
      'Analyze supported video URLs, see the real available formats, and download the option you choose. Works with YouTube, TikTok, Facebook, Twitch and 20+ other sources.',
  },
  {
    path: '/platforms',
    title: 'Supported Platforms — TrueTube',
    description:
      'Every source TrueTube accepts, with the exact hostnames that work for each one — YouTube, TikTok, Facebook, Twitch, Vimeo and more.',
  },
  {
    path: '/how',
    title: 'How It Works — TrueTube',
    description:
      'Paste a URL, see the real formats the source offers, pick one, and get a file with audio. What happens at each step and why it is honest.',
  },
  {
    path: '/features',
    title: 'Features — TrueTube',
    description:
      'Format previews, real progress, audio-first selection, honest errors and no account. What TrueTube does and deliberately does not do.',
  },
  {
    path: '/faq',
    title: 'Frequently Asked Questions — TrueTube',
    description:
      'Straight answers about formats, audio, failed downloads, what TrueTube will not do, and who is responsible for what you download.',
  },
  {
    path: '/privacy',
    title: 'Privacy — TrueTube',
    description:
      'What TrueTube stores, what it does not store, and what leaves your machine when you analyze or download a link.',
  },
  {
    path: '/terms',
    title: 'Terms of Use — TrueTube',
    description:
      'The conditions for using TrueTube, including your responsibility to download only content you have permission to download.',
  },
];

/** Absolute URL for a route, used for canonical, og:url and the sitemap. */
export function absoluteUrl(routePath) {
  const clean = routePath === '/' ? '' : String(routePath).replace(/\/+$/, '');
  return `${SITE_URL}${clean}/`;
}

/** Metadata for a known route, or null when the path is not part of the site. */
export function metaForPath(routePath) {
  const clean = routePath === '/' ? '/' : String(routePath || '/').replace(/\/+$/, '');
  const found = ROUTE_META.find((entry) => entry.path === clean);
  if (!found) return null;
  return { ...DEFAULT_META, ...found, url: absoluteUrl(clean) };
}

/** Every real route, for the sitemap. */
export function listRoutes() {
  // Defaults first, then the route's own values: the other way round, the
  // default's `path: '/'` would overwrite every route and they would all come
  // back looking like the home page.
  return ROUTE_META.map((entry) => ({ ...DEFAULT_META, ...entry, url: absoluteUrl(entry.path) }));
}

/** Escape for use inside a double-quoted HTML attribute. */
function attr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * JSON-LD describing the site as a web application.
 *
 * A single WebApplication rather than one per route: the tool is one product,
 * and repeating identical structured data across every URL is noise rather than
 * signal.
 */
function structuredData() {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'TrueTube',
    url: `${SITE_URL}/`,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    description: DEFAULT_META.description,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  });
}

/**
 * Build the route-specific head block.
 *
 * `og:image` is a PNG and carries explicit dimensions: Facebook, X and LinkedIn
 * do not render SVG for a share image, so an SVG here produces a blank preview
 * everywhere, and without the dimensions they guess the aspect ratio and crop.
 */
export function renderHead(meta) {
  const image = `${SITE_URL}/og-image.png`;
  return [
    `<title>${attr(meta.title)}</title>`,
    `<meta name="description" content="${attr(meta.description)}" />`,
    `<meta name="keywords" content="${attr(meta.keywords)}" />`,
    `<meta name="robots" content="${attr(meta.robots)}" />`,
    `<link rel="canonical" href="${attr(meta.url)}" />`,

    `<meta property="og:type" content="${attr(meta.ogType)}" />`,
    `<meta property="og:site_name" content="TrueTube" />`,
    `<meta property="og:title" content="${attr(meta.title)}" />`,
    `<meta property="og:description" content="${attr(meta.description)}" />`,
    `<meta property="og:url" content="${attr(meta.url)}" />`,
    `<meta property="og:image" content="${image}" />`,
    '<meta property="og:image:type" content="image/png" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta property="og:image:alt" content="TrueTube — Modern Video Download Utility" />',
    '<meta property="og:locale" content="en_US" />',

    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${attr(meta.title)}" />`,
    `<meta name="twitter:description" content="${attr(meta.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    '<meta name="twitter:image:alt" content="TrueTube — Modern Video Download Utility" />',

    `<script type="application/ld+json">${structuredData()}</script>`,
  ].join('\n    ');
}
