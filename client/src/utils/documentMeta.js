/**
 * The route table, and the document metadata that goes with it.
 *
 * The server renders a correct <head> for the URL that was actually requested,
 * using server/src/services/seoMeta.js. That head is immediately wrong the moment
 * a visitor clicks a link, because the router changes the URL without a request
 * — so the same values are re-applied here from the same source table.
 *
 * This is not about search engines. Without it, browsing to /terms would leave
 * the tab, the share sheet and the browser history all reading "TrueTube — Modern
 * Video Download Utility", which is a small thing that is wrong on every single
 * page of the site.
 */
/**
 * The public origin, taken from the page's own address.
 *
 * The server sends a head built from SITE_URL, but the browser has no build-time
 * knowledge of where it is deployed. Deriving the origin from the live location
 * means a client-side navigation corrects the canonical to the host actually
 * being viewed, with no second configuration to keep in sync — and it stays
 * correct on localhost, on a preview URL, and in production alike.
 */
const siteUrl = () => {
  if (typeof window === 'undefined') return 'https://truetube.app';
  return window.location.origin.replace(/\/+$/, '');
};

const ROUTES = {
  '/': {
    title: 'TrueTube — Modern Video Download Utility',
    description:
      'Analyze supported video URLs, see the real available formats, and download the option you choose. Works with YouTube, TikTok, Facebook, Twitch and 20+ other sources.',
  },
  '/platforms': {
    title: 'Supported Platforms — TrueTube',
    description:
      'Every source TrueTube accepts, with the exact hostnames that work for each one — YouTube, TikTok, Facebook, Twitch, Vimeo and more.',
  },
  '/how': {
    title: 'How It Works — TrueTube',
    description:
      'Paste a URL, see the real formats the source offers, pick one, and get a file with audio. What happens at each step and why it is honest.',
  },
  '/features': {
    title: 'Features — TrueTube',
    description:
      'Format previews, real progress, audio-first selection, honest errors and no account. What TrueTube does and deliberately does not do.',
  },
  '/faq': {
    title: 'Frequently Asked Questions — TrueTube',
    description:
      'Straight answers about formats, audio, failed downloads, what TrueTube will not do, and who is responsible for what you download.',
  },
  '/privacy': {
    title: 'Privacy — TrueTube',
    description:
      'What TrueTube stores, what it does not store, and what leaves your machine when you analyze or download a link.',
  },
  '/terms': {
    title: 'Terms of Use — TrueTube',
    description:
      'The conditions for using TrueTube, including your responsibility to download only content you have permission to download.',
  },
};

/** Falls back to the not-found wording, matching what the server serves. */
const NOT_FOUND_META = {
  title: 'Page not found — TrueTube',
  description: 'That page does not exist on TrueTube.',
};

/**
 * Set `content` on a meta tag, creating it if it is not there yet.
 *
 * Creating it matters: index.html ships a `<!--seo-head-->` marker rather than
 * hard-coded tags, because the tags are per route. During `npm run dev` there is
 * no server pass to fill them in, so the document genuinely has no description
 * until this runs.
 */
function setMeta(attrName, attrValue, content) {
  let node = document.head.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute(attrName, attrValue);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
}

function setCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/** Apply the metadata for a path to the live document. */
export function applyDocumentMeta(path) {
  if (typeof document === 'undefined') return;

  const clean = path === '/' ? '/' : String(path || '/').replace(/\/+$/, '');
  const known = Object.prototype.hasOwnProperty.call(ROUTES, clean);
  const meta = known ? ROUTES[clean] : NOT_FOUND_META;
  const origin = siteUrl();
  const url = `${origin}${clean === '/' ? '' : clean}/`;
  const image = `${origin}/og-image.png`;

  document.title = meta.title;
  setMeta('name', 'description', meta.description);

  setMeta('property', 'og:title', meta.title);
  setMeta('property', 'og:description', meta.description);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:image', image);

  setMeta('name', 'twitter:title', meta.title);
  setMeta('name', 'twitter:description', meta.description);
  setMeta('name', 'twitter:image', image);

  setCanonical(url);
}

export default applyDocumentMeta;
