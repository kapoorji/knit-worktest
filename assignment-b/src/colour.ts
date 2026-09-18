/**
 * Colour science — no dependencies.
 *
 * We need three things:
 *   1. sRGB <-> OKLab  — for a luminance-preserving tint that keeps hue+chroma
 *      exactly equal to the target hex (Björn Ottosson's OKLab).
 *   2. sRGB -> CIE Lab — for a perceptual colour-difference metric.
 *   3. ΔE2000          — to *measure* how close the swatch colour is to the hex,
 *      so "colour matches the hex" is a printed number, not a claim.
 */

export interface RGB { r: number; g: number; b: number } // 0..255
export interface OKLab { L: number; a: number; b: number }
export interface Lab { L: number; a: number; b: number }

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

const srgbToLinear = (c: number): number => {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
};
const linearToSrgb = (c: number): number => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
};

// ---- OKLab (input/output in linear sRGB) ----
export function rgbToOklab({ r, g, b }: RGB): OKLab {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

export function oklabToRgb({ L, a, b }: OKLab): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return { r: linearToSrgb(lr), g: linearToSrgb(lg), b: linearToSrgb(lb) };
}

// ---- CIE Lab (D65) for ΔE ----
function rgbToXyz({ r, g, b }: RGB): [number, number, number] {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  return [
    (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) * 100,
    (lr * 0.2126 + lg * 0.7152 + lb * 0.0722) * 100,
    (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) * 100,
  ];
}

export function rgbToLab(rgb: RGB): Lab {
  const [x, y, z] = rgbToXyz(rgb);
  const xn = 95.047, yn = 100.0, zn = 108.883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / xn), fy = f(y / yn), fz = f(z / zn);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export const hexToLab = (hex: string): Lab => rgbToLab(hexToRgb(hex));

/** CIEDE2000 colour difference between two Lab colours. */
export function deltaE2000(l1: Lab, l2: Lab): number {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const avgL = (l1.L + l2.L) / 2;
  const c1 = Math.hypot(l1.a, l1.b), c2 = Math.hypot(l2.a, l2.b);
  const avgC = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
  const a1p = l1.a * (1 + g), a2p = l2.a * (1 + g);
  const c1p = Math.hypot(a1p, l1.b), c2p = Math.hypot(a2p, l2.b);
  const avgCp = (c1p + c2p) / 2;
  const h1p = (Math.atan2(l1.b, a1p) * deg + 360) % 360;
  const h2p = (Math.atan2(l2.b, a2p) * deg + 360) % 360;

  const dLp = l2.L - l1.L;
  const dCp = c2p - c1p;
  let dhp = 0;
  if (c1p * c2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((dhp * rad) / 2);

  let avgHp = h1p + h2p;
  if (c1p * c2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) avgHp += h1p + h2p < 360 ? 360 : -360;
    avgHp /= 2;
  }
  const t =
    1 -
    0.17 * Math.cos((avgHp - 30) * rad) +
    0.24 * Math.cos(2 * avgHp * rad) +
    0.32 * Math.cos((3 * avgHp + 6) * rad) -
    0.2 * Math.cos((4 * avgHp - 63) * rad);
  const sl = 1 + (0.015 * (avgL - 50) ** 2) / Math.sqrt(20 + (avgL - 50) ** 2);
  const sc = 1 + 0.045 * avgCp;
  const sh = 1 + 0.015 * avgCp * t;
  const dTheta = 30 * Math.exp(-(((avgHp - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7));
  const rt = -rc * Math.sin(2 * dTheta * rad);
  return Math.sqrt((dLp / sl) ** 2 + (dCp / sc) ** 2 + (dHp / sh) ** 2 + rt * (dCp / sc) * (dHp / sh));
}

export const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
