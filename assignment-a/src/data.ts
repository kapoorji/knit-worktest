/**
 * Domain constants for the knitting calculators.
 *
 * Every number the assistant ever reports ultimately comes from here or from the
 * formulas in the sibling modules. These constants are *explicit, documented
 * approximations* (per the brief: reasonable approximations are fine as long as
 * they are explicit and easy to change). Sources: assignment-a/assumptions.md.
 *
 * Primary source: Craft Yarn Council (CYC) "Standard Yarn Weight System".
 * Needle metric->US->UK equivalences: standard published conversion charts.
 */

/** Thrown for inputs we cannot handle, so callers can decline rather than guess. */
export class CalcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalcError";
  }
}

export interface YarnWeight {
  slug: string;
  cycNumber: number;
  label: string;
  /** typical stockinette gauge, stitches per 10cm */
  typicalGauge: number;
  /** [min, max] stitches per 10cm */
  gaugeRange: [number, number];
  /** recommended metric needle range [min, max] mm */
  needleRangeMm: [number, number];
  /** typical put-up, metres per standard ball (default, overridable) */
  metresPerBall: number;
  /** yarn length consumed per cm^2 of stockinette fabric */
  metresPerCm2: number;
}

/**
 * CYC categories. gauge/needle ranges follow the CYC standard chart; the
 * metresPerCm2 and metresPerBall figures are documented approximations
 * calibrated to typical real-world projects (see assumptions.md).
 */
export const YARN_WEIGHTS: Record<string, YarnWeight> = {
  lace:        { slug: "lace",        cycNumber: 0, label: "Lace",                   typicalGauge: 36.0, gaugeRange: [33, 40], needleRangeMm: [1.5, 2.25],  metresPerBall: 400, metresPerCm2: 0.55 },
  super_fine:  { slug: "super_fine",  cycNumber: 1, label: "Super Fine",             typicalGauge: 29.5, gaugeRange: [27, 32], needleRangeMm: [2.25, 3.25], metresPerBall: 200, metresPerCm2: 0.40 },
  fine:        { slug: "fine",        cycNumber: 2, label: "Fine",                   typicalGauge: 24.5, gaugeRange: [23, 26], needleRangeMm: [3.25, 3.75], metresPerBall: 155, metresPerCm2: 0.28 },
  light:       { slug: "light",       cycNumber: 3, label: "Light (DK)",             typicalGauge: 22.5, gaugeRange: [21, 24], needleRangeMm: [3.75, 4.5],  metresPerBall: 120, metresPerCm2: 0.20 },
  medium:      { slug: "medium",      cycNumber: 4, label: "Medium (Worsted/Aran)",  typicalGauge: 18.0, gaugeRange: [16, 20], needleRangeMm: [4.5, 5.5],   metresPerBall: 90,  metresPerCm2: 0.15 },
  bulky:       { slug: "bulky",       cycNumber: 5, label: "Bulky",                  typicalGauge: 13.5, gaugeRange: [12, 15], needleRangeMm: [5.5, 8.0],   metresPerBall: 60,  metresPerCm2: 0.10 },
  super_bulky: { slug: "super_bulky", cycNumber: 6, label: "Super Bulky",            typicalGauge: 9.0,  gaugeRange: [7, 11],  needleRangeMm: [8.0, 12.75], metresPerBall: 40,  metresPerCm2: 0.07 },
  jumbo:       { slug: "jumbo",       cycNumber: 7, label: "Jumbo",                  typicalGauge: 5.0,  gaugeRange: [6, 6],   needleRangeMm: [12.75, 20.0], metresPerBall: 30, metresPerCm2: 0.045 },
};

/** Alias -> canonical slug. Includes trade names and the CYC number as a string. */
const YARN_ALIASES: Record<string, string> = {
  "0": "lace", lace: "lace", cobweb: "lace", thread: "lace",
  "1": "super_fine", "super fine": "super_fine", superfine: "super_fine",
  sock: "super_fine", fingering: "super_fine", baby: "super_fine",
  "2": "fine", fine: "fine", sport: "fine",
  "3": "light", light: "light", dk: "light", "light worsted": "light",
  "4": "medium", medium: "medium", worsted: "medium", aran: "medium", afghan: "medium",
  "5": "bulky", bulky: "bulky", chunky: "bulky", craft: "bulky", rug: "bulky",
  "6": "super_bulky", "super bulky": "super_bulky", superbulky: "super_bulky",
  "super chunky": "super_bulky", roving: "super_bulky",
  "7": "jumbo", jumbo: "jumbo",
};

/**
 * Relative yarn usage per unit area vs stockinette (=1.0). Documented
 * approximations: denser textured stitches consume more; open lace consumes less.
 */
export const STITCH_YARN_FACTOR: Record<string, number> = {
  stockinette: 1.0,
  garter: 1.15,
  rib: 1.1,
  "1x1 rib": 1.1,
  "2x2 rib": 1.1,
  seed: 1.15,
  moss: 1.15,
  cable: 1.3,
  lace: 0.85, // lace *stitch pattern* (open eyelets), distinct from lace *weight*
};

/** Standard needle conversions: [metric_mm, US, UK]. "-" = no standard equivalent. */
export const NEEDLE_TABLE: Array<[number, string, string]> = [
  [2.0, "0", "14"],
  [2.25, "1", "13"],
  [2.75, "2", "12"],
  [3.0, "-", "11"],
  [3.25, "3", "10"],
  [3.5, "4", "-"],
  [3.75, "5", "9"],
  [4.0, "6", "8"],
  [4.5, "7", "7"],
  [5.0, "8", "6"],
  [5.5, "9", "5"],
  [6.0, "10", "4"],
  [6.5, "10.5", "3"],
  [7.0, "-", "2"],
  [7.5, "-", "1"],
  [8.0, "11", "0"],
  [9.0, "13", "00"],
  [10.0, "15", "000"],
  [12.0, "17", "-"],
  [15.0, "19", "-"],
  [20.0, "36", "-"],
];

/**
 * Resolve a user-supplied weight name/number to a canonical YarnWeight.
 * Throws CalcError for anything we don't recognise, so the assistant can
 * decline rather than guess.
 */
export function resolveWeight(name: string | null | undefined): YarnWeight {
  if (name === null || name === undefined || String(name).trim() === "") {
    throw new CalcError("No yarn weight given.");
  }
  const key = String(name).trim().toLowerCase();
  const direct = YARN_WEIGHTS[key];
  if (direct) return direct; // canonical slug passed directly
  const slug = YARN_ALIASES[key];
  if (!slug) {
    const known = [...new Set(Object.values(YARN_WEIGHTS).map((w) => w.label))].sort();
    throw new CalcError(`Unknown yarn weight: '${name}'. Known weights: ${known.join(", ")}.`);
  }
  return YARN_WEIGHTS[slug]!;
}

/** Return [canonicalStitchName, yarnFactor]. Defaults to stockinette. */
export function resolveStitchFactor(stitch: string | null | undefined): [string, number] {
  if (stitch === null || stitch === undefined || String(stitch).trim() === "") {
    return ["stockinette", STITCH_YARN_FACTOR.stockinette!];
  }
  const key = String(stitch).trim().toLowerCase();
  const factor = STITCH_YARN_FACTOR[key];
  if (factor === undefined) {
    const known = Object.keys(STITCH_YARN_FACTOR).sort().join(", ");
    throw new CalcError(`Unknown stitch pattern: '${stitch}'. Known: ${known}.`);
  }
  return [key, factor];
}

export interface NeedleSizes {
  metricMm: number;
  us: string;
  uk: string;
}

/** Snap a metric size to the nearest standard needle and return all systems. */
export function snapNeedle(metricMm: number): NeedleSizes {
  let nearest = NEEDLE_TABLE[0]!;
  for (const row of NEEDLE_TABLE) {
    if (Math.abs(row[0] - metricMm) < Math.abs(nearest[0] - metricMm)) {
      nearest = row;
    }
  }
  return { metricMm: nearest[0], us: nearest[1], uk: nearest[2] };
}

/** Round to a given number of decimals (half away from zero, like most charts). */
export function roundTo(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}
