/**
 * Luminance-preserving tint in OKLab.
 *
 * For each pixel we keep the target hex's a,b (hue + chroma **exactly**) and set
 * the OKLab lightness from the base's relief, centred on the base's MEAN
 * lightness so the swatch's mean maps to exactly the hex regardless of how
 * light/dark the stitch geometry is. Result: hue/chroma equal the hex, lightness
 * carries the 3-D relief, and the mean tone equals the hex. We measure ΔE2000
 * between the hex and the swatch's mean colour, so "colour matches the hex" is a
 * printed number.
 *
 * (sharp has no `colorize` and `.tint()` is a multiply — neither preserves hue in
 * shadows/highlights — so we operate on raw pixels directly.)
 */

import sharp from "sharp";
import { hexToRgb, rgbToOklab, oklabToRgb, rgbToLab, hexToLab, deltaE2000, clamp, type RGB } from "./colour.js";

const GAIN = 1.15; // relief amplitude
const SIZE = 512;

export interface TintResult {
  image: Buffer;
  meanDeltaE: number; // ΔE2000 between input hex and the swatch's mean colour
}

export async function tintToHex(base: Buffer, hex: string): Promise<TintResult> {
  const { data, info } = await sharp(base).resize(SIZE, SIZE, { fit: "cover" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const target = rgbToOklab(hexToRgb(hex));
  const out = Buffer.alloc(SIZE * SIZE * 3);
  const n = SIZE * SIZE;

  // Pass 1: base OKLab lightness per pixel + its mean (the relief anchor).
  const baseL = new Float64Array(n);
  let meanBaseL = 0;
  for (let i = 0, k = 0; k < n; i += ch, k++) {
    const l = rgbToOklab({ r: data[i]!, g: data[i + 1]!, b: data[i + 2]! }).L;
    baseL[k] = l;
    meanBaseL += l;
  }
  meanBaseL /= n;

  // Pass 2: keep hex hue+chroma, modulate lightness around the hex, centred on
  // the base mean so the swatch mean equals the hex.
  let sr = 0, sg = 0, sb = 0;
  for (let k = 0, p = 0; k < n; k++, p += 3) {
    const L = clamp(target.L + (baseL[k]! - meanBaseL) * GAIN, 0.03, 0.98);
    const rgb = oklabToRgb({ L, a: target.a, b: target.b });
    out[p] = rgb.r; out[p + 1] = rgb.g; out[p + 2] = rgb.b;
    sr += rgb.r; sg += rgb.g; sb += rgb.b;
  }

  const mean: RGB = { r: sr / n, g: sg / n, b: sb / n };
  const meanDeltaE = deltaE2000(rgbToLab(mean), hexToLab(hex));
  const image = await sharp(out, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toBuffer();
  return { image, meanDeltaE };
}
