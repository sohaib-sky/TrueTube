/**
 * Turns the raw format list returned by the API into a compact, honest picker.
 *
 * Nothing is invented: every entry corresponds to a format the source really
 * offered. When two formats share a resolution, the most complete one wins
 * (combined audio+video before video-only, then higher bitrate).
 */

const BEST_PRESET = {
  id: 'best',
  kind: 'muxed',
  label: 'Best available',
  meta: 'Highest quality, audio merged',
  requiresFfmpeg: true,
};

function scoreFormat(format) {
  const complete = format.kind === 'muxed' ? 1 : 0;
  return complete * 1_000_000 + (format.tbr || 0) + (format.filesize || 0) / 1_000_000;
}

function pickBestPerKey(formats, keyOf) {
  const grouped = new Map();
  for (const format of formats) {
    const key = keyOf(format);
    const current = grouped.get(key);
    if (!current || scoreFormat(format) > scoreFormat(current)) grouped.set(key, format);
  }
  return [...grouped.values()];
}

function describe(format) {
  const parts = [];
  if (format.filesizeText) parts.push(format.filesizeText);
  if (format.fps && format.height && format.fps > 30) parts.push(`${format.fps}fps`);
  if (format.ext) parts.push(format.ext.toUpperCase());
  return parts.join(' · ');
}

function toOption(format) {
  return {
    id: format.id,
    kind: format.kind,
    label: format.label,
    meta: describe(format),
    requiresFfmpeg: Boolean(format.requiresFfmpeg),
    videoOnly: format.kind === 'video',
  };
}

export function buildFormatGroups(metadata) {
  const videoSource = metadata?.videoFormats ?? [];
  const audioSource = metadata?.audioFormats ?? [];

  const video = pickBestPerKey(videoSource, (format) => format.height || format.resolution || format.id)
    .sort((a, b) => (b.height || 0) - (a.height || 0))
    .map(toOption);

  const audio = pickBestPerKey(audioSource, (format) => format.abr || format.id)
    .sort((a, b) => (b.abr || 0) - (a.abr || 0))
    .slice(0, 4)
    .map(toOption);

  return {
    best: video.length > 0 ? BEST_PRESET : null,
    video,
    audio,
    total: videoSource.length + audioSource.length,
  };
}
