/**
 * Graceful fallback swatch — a solid swatch in the EXACT requested hex with faint
 * stripes and a "preview unavailable" marker. Returned transiently when
 * generation fails; NEVER written to the cache (a cached fallback would poison
 * later real calls).
 */

import sharp from "sharp";
import { hexToRgb, rgbToOklab, oklabToRgb, clamp } from "./colour.js";

const SIZE = 512;

export async function placeholder(hex: string): Promise<Buffer> {
  // Slightly lighter stripe colour derived from the hex (keep hue).
  const t = rgbToOklab(hexToRgb(hex));
  const stripe = oklabToRgb({ L: clamp(t.L + 0.08, 0, 0.98), a: t.a, b: t.b });
  const stripeHex = `rgb(${stripe.r},${stripe.g},${stripe.b})`;
  const textColour = t.L > 0.6 ? "#00000088" : "#ffffffaa";

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">` +
    `<rect width="${SIZE}" height="${SIZE}" fill="${hex}"/>` +
    Array.from({ length: 14 }, (_, i) => {
      const x = i * (SIZE / 7) - SIZE;
      return `<rect x="${x}" y="0" width="${SIZE / 18}" height="${SIZE * 2}" fill="${stripeHex}" transform="rotate(30 ${SIZE / 2} ${SIZE / 2})"/>`;
    }).join("") +
    `<text x="${SIZE / 2}" y="${SIZE / 2}" fill="${textColour}" font-family="sans-serif" font-size="26" text-anchor="middle" dominant-baseline="middle">preview unavailable</text>` +
    `</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
