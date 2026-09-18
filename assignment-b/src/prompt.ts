/**
 * Prompt construction — structure-first.
 *
 * The stitch structural clause leads, because "cable must look different from rib"
 * is the graded axis. Colour/weight/fibre follow as modifiers. PROMPT_VERSION is
 * part of the cache key, so changing any wording correctly invalidates caches.
 */

import type { SwatchInput, StitchType, WeightCategory } from "./schema.js";

export const PROMPT_VERSION = "v1";

const STITCH_CLAUSE: Record<StitchType, string> = {
  stockinette: "smooth uniform columns of V-shaped knit stitches stacked in neat vertical rows",
  garter: "horizontal ridged bumps running across the fabric, no V shapes, the same on every row",
  rib: "alternating raised and recessed vertical columns forming a corrugated, vertically ridged surface",
  seed: "an all-over bumpy irregular checkerboard texture with no directional lines",
  moss: "an all-over bumpy irregular checkerboard texture with no directional lines",
  cable: "twisted rope-like raised braids crossing over a flatter background, with strong three-dimensional relief",
  lace: "small regularly spaced open eyelet holes forming an airy, delicate pattern",
};

const WEIGHT_SCALE: Record<WeightCategory, string> = {
  lace: "very fine, small delicate stitches",
  super_fine: "fine, small stitches",
  fine: "small-to-medium stitches",
  light: "medium stitches",
  medium: "medium, clearly defined stitches",
  bulky: "large, chunky stitches",
  super_bulky: "very large, thick chunky stitches",
  jumbo: "enormous, very thick stitches",
};

function fibreClause(fibre: string): string {
  const f = fibre.toLowerCase();
  if (f.includes("cotton")) return "smooth, crisp cotton yarn with a slight matte finish";
  if (f.includes("alpaca") || f.includes("mohair")) return "very fuzzy yarn with a soft halo";
  if (f.includes("acrylic")) return "smooth even yarn with a subtle sheen";
  return "wool yarn with a visible twist and slight matte fuzz";
}

/**
 * Build a generation prompt. When `neutralBase` is true (the tint path), the
 * colour is neutral mid-grey so luminance carries the relief cleanly.
 */
export function buildPrompt(input: SwatchInput, opts: { neutralBase?: boolean } = {}): string {
  const structure = STITCH_CLAUSE[input.stitch_type];
  const scale = WEIGHT_SCALE[input.weight_category];
  const fibre = fibreClause(input.fibre_content);
  const colour = opts.neutralBase
    ? "in neutral mid-grey"
    : `in the colour ${input.colour_name} (hex ${input.colour_hex})`;

  return (
    `An extreme close-up, photorealistic macro photograph of a hand-knitted fabric swatch ${colour}, ` +
    `showing ${structure}. ${scale}, ${fibre}. ` +
    `Flat knitted fabric filling the entire frame, even soft studio lighting, sharp focus on the stitch texture, ` +
    `no knitting needles, no hands, no background, no text.`
  );
}
