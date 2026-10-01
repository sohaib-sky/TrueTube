import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { platformColors } from '../../utils/platformColors.js';

const WIDTH = 512;
const HEIGHT = 384;

/**
 * Builds the front-face texture for a platform card.
 *
 * The name is drawn into a canvas rather than loaded as a webfont in the 3D
 * scene, so the text is a real texture on a real material — no HTML overlay,
 * no network request, and it survives any device without the font.
 */
function drawCard(platform) {
  const name = String(platform);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');

  const { light, base, deep, ink } = platformColors(name);
  // Bright brand colours (a neon green, a golden yellow) cannot carry a white
  // label, so each palette entry states its own ink when it needs one.
  const labelInk = ink || '#ffffff';

  // Diagonal body gradient, matching the reference tiles.
  const body = ctx.createLinearGradient(0, 0, WIDTH * 0.85, HEIGHT);
  body.addColorStop(0, light);
  body.addColorStop(0.52, base);
  body.addColorStop(1, deep);
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Top-left key light.
  const key = ctx.createRadialGradient(WIDTH * 0.26, 0, 0, WIDTH * 0.26, 0, HEIGHT * 0.95);
  key.addColorStop(0, 'rgba(255,255,255,0.34)');
  key.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = key;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Specular cap along the top edge.
  const cap = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.46);
  cap.addColorStop(0, 'rgba(255,255,255,0.26)');
  cap.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = cap;
  ctx.fillRect(0, 0, WIDTH, HEIGHT * 0.46);

  // Bottom shading so the card reads as a solid, not a flat swatch.
  const shade = ctx.createLinearGradient(0, HEIGHT * 0.62, 0, HEIGHT);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, HEIGHT * 0.62, WIDTH, HEIGHT * 0.38);

  // Name — bold, centred, with a soft shadow for depth.
  const words = name.split(' ');
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), '');
  let size = 74;
  ctx.font = `800 ${size}px Inter, "Segoe UI", system-ui, sans-serif`;
  while (ctx.measureText(longest).width > WIDTH * 0.78 && size > 34) {
    size -= 3;
    ctx.font = `800 ${size}px Inter, "Segoe UI", system-ui, sans-serif`;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // The shadow is the opposite of the ink, so a dark label on a bright card
  // still separates from the surface instead of turning into a soft smudge.
  ctx.shadowColor = ink ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = labelInk;
  const lineHeight = size * 1.1;

  words.forEach((word, index) => {
    const y = HEIGHT / 2 - ((words.length - 1) * lineHeight) / 2 + index * lineHeight;
    ctx.fillText(word, WIDTH / 2, y);
  });

  return canvas;
}

/** Texture for the "+N MORE" glass tile. */
function drawMore(count) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');

  const body = ctx.createLinearGradient(0, 0, WIDTH * 0.8, HEIGHT);
  body.addColorStop(0, 'rgba(255,255,255,0.16)');
  body.addColorStop(1, 'rgba(255,255,255,0.04)');
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 14;

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 128px Inter, "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`+${count}`, WIDTH / 2, HEIGHT / 2 - 40);

  ctx.shadowBlur = 6;
  ctx.fillStyle = 'rgba(226,232,240,0.85)';
  ctx.font = '700 40px Inter, "Segoe UI", system-ui, sans-serif';
  ctx.letterSpacing = '8px';
  ctx.fillText('MORE', WIDTH / 2, HEIGHT / 2 + 74);

  return canvas;
}

function toTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/** Memoised front-face texture for one card. */
export function useCardTexture(key, count) {
  const texture = useMemo(() => {
    if (count) return toTexture(drawMore(count));
    return toTexture(drawCard(key));
  }, [key, count]);

  useEffect(() => () => texture.dispose(), [texture]);

  return texture;
}
