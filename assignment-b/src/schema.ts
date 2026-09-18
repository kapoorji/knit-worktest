/**
 * Structured swatch input — the only thing the generator accepts.
 *
 * Everything downstream (prompt, cache key, tint) works from a *normalised*
 * input, so equivalent inputs (case, `#FFF` vs `#ffffff`) collapse to one cache
 * entry. Invalid inputs throw, so we never silently generate the wrong thing.
 */

export const STITCH_TYPES = ["stockinette", "garter", "rib", "seed", "moss", "cable", "lace"] as const;
export type StitchType = (typeof STITCH_TYPES)[number];

export const WEIGHT_CATEGORIES = ["lace", "super_fine", "fine", "light", "medium", "bulky", "super_bulky", "jumbo"] as const;
export type WeightCategory = (typeof WEIGHT_CATEGORIES)[number];

export interface SwatchInput {
  stitch_type: StitchType;
  colour_name: string;
  colour_hex: string; // normalised to #rrggbb lowercase
  weight_category: WeightCategory;
  fibre_content: string;
}

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

/** Expand `#fff` -> `#ffffff`, lowercase, validate. */
export function normaliseHex(hex: string): string {
  if (typeof hex !== "string") throw new InputError("colour_hex must be a string.");
  let h = hex.trim().toLowerCase();
  if (!h.startsWith("#")) h = "#" + h;
  if (/^#[0-9a-f]{3}$/.test(h)) {
    h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  }
  if (!/^#[0-9a-f]{6}$/.test(h)) throw new InputError(`Invalid colour_hex: '${hex}'. Expected #rgb or #rrggbb.`);
  return h;
}

/** Validate + normalise a raw input into a canonical SwatchInput. */
export function normalise(raw: Partial<SwatchInput>): SwatchInput {
  const stitch = String(raw.stitch_type ?? "").trim().toLowerCase().replace(/\s+/g, "");
  const stitch_type = STITCH_TYPES.find((s) => s === stitch || (stitch.includes("rib") && s === "rib"));
  if (!stitch_type) throw new InputError(`Unknown stitch_type: '${raw.stitch_type}'. Known: ${STITCH_TYPES.join(", ")}.`);

  const weight = String(raw.weight_category ?? "medium").trim().toLowerCase().replace(/\s+/g, "_");
  const weight_category = WEIGHT_CATEGORIES.find((w) => w === weight);
  if (!weight_category) throw new InputError(`Unknown weight_category: '${raw.weight_category}'. Known: ${WEIGHT_CATEGORIES.join(", ")}.`);

  return {
    stitch_type,
    colour_name: String(raw.colour_name ?? "").trim() || "unnamed",
    colour_hex: normaliseHex(raw.colour_hex ?? "#808080"),
    weight_category,
    fibre_content: String(raw.fibre_content ?? "100% wool").trim(),
  };
}
