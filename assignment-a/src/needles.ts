/**
 * Needle size recommender.
 *
 * Given a yarn weight and a desired fabric hand (firm / balanced / drapey), pick
 * a metric needle size inside the weight's recommended range and snap it to the
 * nearest standard size, returning metric / US / UK.
 *
 *   firm     -> low end of the range   (tighter, denser fabric)
 *   balanced -> middle of the range
 *   drapey   -> high end of the range  (looser, softer drape)
 *
 * projectType is advisory only: it never changes the number, only adds a note
 * (e.g. socks are often worked firmer than the default).
 */

import { CalcError, resolveWeight, snapNeedle, roundTo } from "./data.js";

const FABRIC_POSITION: Record<string, number> = { firm: 0.15, balanced: 0.5, drapey: 0.85 };

const FIRM_PROJECTS = new Set(["socks", "sock", "hat", "beanie", "mittens", "gloves", "bag"]);
const DRAPEY_PROJECTS = new Set(["shawl", "scarf", "wrap", "blanket", "throw"]);

export interface NeedleRecommendation {
  metricMm: number;
  us: string;
  uk: string;
  fabric: string;
  inputs: { weight: string; weightLabel: string; projectType: string | null };
  assumptions: { needleRangeMm: [number, number]; fabricPosition: number; targetMmBeforeSnap: number };
  note: string | null;
}

export interface NeedleOptions {
  projectType?: string | null;
  fabric?: string;
}

/** Recommend a needle size. Throws CalcError on unknown weight/fabric. */
export function recommendNeedle(weight: string, options: NeedleOptions = {}): NeedleRecommendation {
  const { projectType = null, fabric = "balanced" } = options;
  const w = resolveWeight(weight);

  const fabricKey = String(fabric).trim().toLowerCase();
  const pos = FABRIC_POSITION[fabricKey];
  if (pos === undefined) {
    throw new CalcError(`Unknown fabric '${fabric}'. Use one of: firm, balanced, drapey.`);
  }

  const [lo, hi] = w.needleRangeMm;
  const targetMm = lo + pos * (hi - lo);
  const snapped = snapNeedle(targetMm);

  let note: string | null = null;
  if (projectType) {
    const pt = String(projectType).trim().toLowerCase();
    if (FIRM_PROJECTS.has(pt) && fabricKey !== "firm") {
      note = `For ${pt}, many knitters size down for a firmer, harder-wearing fabric — consider the firm option too.`;
    } else if (DRAPEY_PROJECTS.has(pt) && fabricKey !== "drapey") {
      note = `For a ${pt}, a softer drape is often preferred — the drapey option may suit better.`;
    }
  }

  return {
    metricMm: snapped.metricMm,
    us: snapped.us,
    uk: snapped.uk,
    fabric: fabricKey,
    inputs: { weight: w.slug, weightLabel: w.label, projectType },
    assumptions: {
      needleRangeMm: w.needleRangeMm,
      fabricPosition: pos,
      targetMmBeforeSnap: roundTo(targetMm, 3),
    },
    note,
  };
}

export function formatNeedle(r: NeedleRecommendation): string {
  const base = `For ${r.inputs.weightLabel} yarn with a ${r.fabric} fabric, use about ${r.metricMm} mm needles (US ${r.us} / UK ${r.uk}).`;
  return r.note ? `${base} ${r.note}` : base;
}
