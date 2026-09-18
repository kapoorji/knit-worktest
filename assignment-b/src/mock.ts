/**
 * Deterministic procedural geometry per stitch, as an SVG (rasterised by sharp).
 *
 * This is what a keyless reviewer sees. Each stitch draws genuinely different
 * geometry in neutral greys (so the tint path can colour it), which means
 * "cable looks different from rib looks different from stockinette" holds even
 * with no API key — the offline demo proves structure, not just colour.
 */

import type { StitchType } from "./schema.js";

const S = 512; // canvas px
const BASE = "#808080", HI = "#b0b0b0", LO = "#565656", HI2 = "#c8c8c8", LO2 = "#454545";

function frame(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">` +
    `<rect width="${S}" height="${S}" fill="${BASE}"/>${inner}</svg>`;
}

function stockinette(): string {
  const cols = 11, rows = 13, w = S / cols, h = S / rows;
  let s = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * w, y = r * h;
      // knit "V": two limbs meeting at the bottom, highlighted top edges.
      s += `<path d="M${x + w * 0.1} ${y} Q${x + w * 0.5} ${y + h * 0.55} ${x + w * 0.5} ${y + h} Q${x + w * 0.5} ${y + h * 0.55} ${x + w * 0.9} ${y}" fill="none" stroke="${HI}" stroke-width="${w * 0.22}" stroke-linecap="round"/>`;
      s += `<path d="M${x + w * 0.1} ${y + h * 0.15} Q${x + w * 0.5} ${y + h * 0.7} ${x + w * 0.5} ${y + h} Q${x + w * 0.5} ${y + h * 0.7} ${x + w * 0.9} ${y + h * 0.15}" fill="none" stroke="${LO}" stroke-width="${w * 0.08}" stroke-linecap="round"/>`;
    }
  }
  return frame(s);
}

function garter(): string {
  const rows = 9, h = S / rows;
  let s = "";
  for (let r = 0; r < rows; r++) {
    const y = r * h;
    // raised horizontal ridge (highlight) with a recessed shadow line between.
    s += `<rect x="0" y="${y}" width="${S}" height="${h * 0.72}" rx="${h * 0.36}" fill="${HI}"/>`;
    s += `<rect x="0" y="${y + h * 0.72}" width="${S}" height="${h * 0.28}" fill="${LO}"/>`;
    // little bumps along the ridge
    for (let x = 0; x < S; x += h * 0.9) {
      s += `<ellipse cx="${x + h * 0.45}" cy="${y + h * 0.36}" rx="${h * 0.34}" ry="${h * 0.3}" fill="${HI2}"/>`;
    }
  }
  return frame(s);
}

function rib(): string {
  const cols = 9, w = S / cols;
  let s = "";
  for (let c = 0; c < cols; c++) {
    const x = c * w;
    if (c % 2 === 0) {
      // raised column (knit)
      s += `<rect x="${x}" y="0" width="${w * 0.8}" height="${S}" rx="${w * 0.4}" fill="${HI}"/>`;
      s += `<rect x="${x + w * 0.28}" y="0" width="${w * 0.24}" height="${S}" fill="${HI2}"/>`;
    } else {
      // recessed column (purl gully)
      s += `<rect x="${x}" y="0" width="${w}" height="${S}" fill="${LO}"/>`;
    }
  }
  return frame(s);
}

function seed(): string {
  const cols = 12, rows = 12, w = S / cols, h = S / rows;
  let s = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * w, y = r * h;
      const raised = (r + c) % 2 === 0;
      s += `<rect x="${x + w * 0.12}" y="${y + h * 0.12}" width="${w * 0.76}" height="${h * 0.76}" rx="${w * 0.3}" fill="${raised ? HI : LO}"/>`;
      if (raised) s += `<ellipse cx="${x + w * 0.5}" cy="${y + h * 0.42}" rx="${w * 0.22}" ry="${h * 0.2}" fill="${HI2}"/>`;
    }
  }
  return frame(s);
}

function cable(): string {
  const cols = 4, w = S / cols;
  let s = `<rect width="${S}" height="${S}" fill="${LO}"/>`; // flatter recessed background
  for (let c = 0; c < cols; c++) {
    const cx = c * w + w / 2;
    const braid = w * 0.34;
    // rope braid: stacked crossing strands via S-curves
    for (let y = -w; y < S + w; y += w * 0.9) {
      s += `<path d="M${cx - braid} ${y} C${cx - braid} ${y + w * 0.3} ${cx + braid} ${y + w * 0.6} ${cx + braid} ${y + w * 0.9}" fill="none" stroke="${HI}" stroke-width="${braid * 1.2}" stroke-linecap="round"/>`;
      s += `<path d="M${cx + braid} ${y} C${cx + braid} ${y + w * 0.3} ${cx - braid} ${y + w * 0.6} ${cx - braid} ${y + w * 0.9}" fill="none" stroke="${HI2}" stroke-width="${braid * 0.9}" stroke-linecap="round"/>`;
    }
  }
  return frame(s);
}

function lace(): string {
  const cols = 10, rows = 12, w = S / cols, h = S / rows;
  let s = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * w, y = r * h;
      // faint knit texture
      s += `<path d="M${x + w * 0.15} ${y} Q${x + w * 0.5} ${y + h * 0.6} ${x + w * 0.85} ${y}" fill="none" stroke="${HI}" stroke-width="${w * 0.1}"/>`;
      // eyelet hole on a regular offset lattice
      if ((r + (c % 2)) % 2 === 0) {
        s += `<circle cx="${x + w * 0.5}" cy="${y + h * 0.55}" r="${Math.min(w, h) * 0.24}" fill="${LO2}"/>`;
        s += `<circle cx="${x + w * 0.5}" cy="${y + h * 0.5}" r="${Math.min(w, h) * 0.24}" fill="none" stroke="${HI2}" stroke-width="1.5"/>`;
      }
    }
  }
  return frame(s);
}

const BUILDERS: Record<StitchType, () => string> = {
  stockinette, garter, rib, seed, moss: seed, cable, lace,
};

/** SVG string of neutral-grey relief geometry for a stitch. */
export function mockSvg(stitch: StitchType): string {
  return BUILDERS[stitch]();
}
