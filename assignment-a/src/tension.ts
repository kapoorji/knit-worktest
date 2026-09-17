/**
 * Tension / gauge troubleshooter.
 *
 * Compares a target gauge with the knitter's actual swatch gauge (both in
 * stitches per 10cm) and diagnoses too tight / too loose, severity, the effect
 * on finished size, and a needle-change fix.
 *
 * Rules of thumb (documented approximations, easy to change — see assumptions.md):
 *   - More stitches/10cm than target -> stitches too small -> TOO TIGHT -> go UP.
 *   - Fewer stitches/10cm than target -> stitches too big  -> TOO LOOSE -> go DOWN.
 *   - ~1 stitch/10cm of difference is corrected by ~0.5 mm of needle change.
 *   - If knitting continues off-gauge, finished width scales by target/actual.
 */

import { CalcError, roundTo } from "./data.js";

const MM_PER_STITCH = 0.5; // needle change per 1 stitch/10cm of difference
const ON_GAUGE_TOLERANCE = 0.5; // sts/10cm within which we call it on gauge

export type TensionProblem = "too_tight" | "too_loose" | "on_gauge";
export type Severity = "none" | "minor" | "moderate" | "major";

export interface TensionDiagnosis {
  problem: TensionProblem;
  severity: Severity;
  /** actual - target, per 10cm */
  differenceSts: number;
  /** signed: +up, -down; 0 if on gauge */
  needleChangeMm: number;
  /** finished width as a fraction of intended if left unchanged */
  sizeFactor: number;
  /** +larger / -smaller, percent */
  sizeDeltaPct: number;
  fix: string;
  inputs: { target: number; actual: number };
}

function severityFor(absDiff: number): Severity {
  if (absDiff <= ON_GAUGE_TOLERANCE) return "none";
  if (absDiff <= 2) return "minor";
  if (absDiff <= 4) return "moderate";
  return "major";
}

/** Diagnose a gauge mismatch. Throws CalcError on non-positive gauges. */
export function diagnoseTension(targetStsPer10cm: number, actualStsPer10cm: number): TensionDiagnosis {
  if (targetStsPer10cm === null || targetStsPer10cm === undefined || actualStsPer10cm === null || actualStsPer10cm === undefined) {
    throw new CalcError("Both target and actual gauge are required.");
  }
  if (targetStsPer10cm <= 0 || actualStsPer10cm <= 0) {
    throw new CalcError("Gauges must be positive stitches per 10cm.");
  }

  const diff = actualStsPer10cm - targetStsPer10cm; // +ve => too tight
  const absDiff = Math.abs(diff);
  const severity = severityFor(absDiff);

  let problem: TensionProblem;
  let needleChangeMm: number;
  let fix: string;

  if (severity === "none") {
    problem = "on_gauge";
    needleChangeMm = 0;
    fix = "Your gauge matches — carry on with your current needles.";
  } else if (diff > 0) {
    problem = "too_tight";
    needleChangeMm = roundTo(MM_PER_STITCH * Math.round(absDiff), 2); // go up
    fix = `Go up about ${needleChangeMm} mm in needle size and re-swatch.`;
  } else {
    problem = "too_loose";
    needleChangeMm = -roundTo(MM_PER_STITCH * Math.round(absDiff), 2); // go down
    fix = `Go down about ${Math.abs(needleChangeMm)} mm in needle size and re-swatch.`;
  }

  const sizeFactor = targetStsPer10cm / actualStsPer10cm;
  const sizeDeltaPct = roundTo((sizeFactor - 1) * 100, 1);

  return {
    problem,
    severity,
    differenceSts: roundTo(diff, 2),
    needleChangeMm,
    sizeFactor: roundTo(sizeFactor, 4),
    sizeDeltaPct,
    fix,
    inputs: { target: targetStsPer10cm, actual: actualStsPer10cm },
  };
}

export function formatTension(d: TensionDiagnosis): string {
  if (d.problem === "on_gauge") {
    return `Your gauge is on target (${d.inputs.actual} vs ${d.inputs.target} sts/10cm) — no change needed.`;
  }
  const direction = d.needleChangeMm > 0 ? "up" : "down";
  const smallerLarger = d.sizeDeltaPct < 0 ? "smaller" : "larger";
  return (
    `You are knitting ${d.problem.replace("_", " ")} (${d.inputs.actual} vs target ` +
    `${d.inputs.target} sts/10cm, ${d.severity}). Left unchanged the piece would be about ` +
    `${Math.abs(d.sizeDeltaPct)}% ${smallerLarger} than intended. Fix: go ${direction} ` +
    `~${Math.abs(d.needleChangeMm)} mm in needle size.`
  );
}
