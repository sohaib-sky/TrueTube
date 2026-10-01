/**
 * Per-platform brand colours.
 *
 * Each card is meant to be recognisable at a glance, so the tones are the real
 * brand colours rather than a decorative rainbow: YouTube is red, Reddit is
 * orange, Bilibili is pink, TikTok is black with its cyan/pink signature, and so
 * on. `light` / `base` / `deep` drive the 3D card's front-face canvas texture,
 * its body material and its rim light.
 *
 * `ink` is the label colour. It is only needed where the brand is light enough
 * that white would not be readable — a bright green card with white text is
 * worse than no card at all. Platforms that are not listed fall back to a stable
 * generated hue, so a newly supported source still renders as a distinct object.
 */

const PALETTE = {
  YouTube: { light: '#ff5f52', base: '#e50000', deep: '#990000' },
  TikTok: { light: '#3df5f0', base: '#101014', deep: '#fe2c55' },
  Facebook: { light: '#6ea8ff', base: '#1877f2', deep: '#0b4fb0' },
  X: { light: '#8f8f96', base: '#16161a', deep: '#4a4a52' },
  Reddit: { light: '#ff8b52', base: '#f45000', deep: '#b83600' },
  Twitch: { light: '#c9a3ff', base: '#9146ff', deep: '#6a2fc4' },
  Vimeo: { light: '#7ddcf7', base: '#1ab7ea', deep: '#0f86b0' },
  SoundCloud: { light: '#ff9666', base: '#ff5500', deep: '#cc4000' },
  Dailymotion: { light: '#5f9be0', base: '#0066dc', deep: '#00428f' },
  Bilibili: { light: '#ffadc6', base: '#fb7299', deep: '#cc4a6e' },
  LinkedIn: { light: '#5ba2e2', base: '#0a66c2', deep: '#064a94' },
  Bandcamp: { light: '#a9ccd6', base: '#4d7f8c', deep: '#2f5864', ink: '#0b1c22' },
  Flickr: { light: '#ff5cad', base: '#f5007a', deep: '#b00059' },
  'Internet Archive': { light: '#9ed3de', base: '#2c6e7f', deep: '#1b4b58' },
  Kick: { light: '#b6ff90', base: '#53fc18', deep: '#2c9c0a', ink: '#0f2a06' },
  Kickstarter: { light: '#6ee89a', base: '#0cc24b', deep: '#067a2e', ink: '#052413' },
  Tumblr: { light: '#7a8aa5', base: '#36465d', deep: '#1e2736' },
  Mixcloud: { light: '#9cc6f0', base: '#4a90d9', deep: '#2f66a0' },
  Rumble: { light: '#c2e69a', base: '#6fae2c', deep: '#4a7a19', ink: '#122103' },
  Odysee: { light: '#ffd166', base: '#e09b00', deep: '#9c6f00', ink: '#241a00' },
  TED: { light: '#ff8079', base: '#e62b1e', deep: '#a81a11' },
  VK: { light: '#6babff', base: '#0077ff', deep: '#0052bb' },
  'OK.ru': { light: '#ffb45c', base: '#ee8208', deep: '#b35f04' },
  Streamable: { light: '#74c4ff', base: '#0f90fa', deep: '#0a6ab5' },
};

function hueToRgb(p, s, l) {
  // Small HSL → hex helper, only used for the generated fallback hue.
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + p / 30) % 12;
    const value = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * value);
  };
  return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function fallbackPalette(name) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 360;
  }
  return {
    light: hueToRgb(hash / 360, 0.78, 0.66),
    base: hueToRgb(((hash + 18) % 360) / 360, 0.7, 0.5),
    deep: hueToRgb(((hash + 34) % 360) / 360, 0.66, 0.36),
    ink: '#ffffff',
  };
}

export function platformColors(name) {
  return PALETTE[name] || fallbackPalette(name);
}

export default platformColors;
