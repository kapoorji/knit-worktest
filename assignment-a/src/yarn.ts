/**
 * Yarn quantity calculator.
 *
 * Model (all steps explicit and easy to change — see assumptions.md):
 *
 *   metres = area_cm2 * metresPerCm2(weight) * stitchFactor * gaugeFactor
 *
 * where
 *   area_cm2      = widthCm * heightCm
 *   metresPerCm2  = per-weight constant (finer yarn -> more metres per area)
 *   stitchFactor  = relative usage of the stitch pattern vs stockinette
 *   gaugeFactor   = userGauge / typicalGauge (knitting tighter uses more yarn)
 *
 * Balls/skeins = ceil( metresWithSafety / metresPerBall ).
 */

import { CalcError, resolveWeight, resolveStitchFactor, roundTo } from "./data.js";

export interface YarnEstimate {
  metres: number;
  metresWithSafety: number;
  balls: number;
  metresPerBall: number;
  inputs: {
    widthCm: number;
    heightCm: number;
    weight: string;
    weightLabel: string;
    stitch: string;
    gaugeStsPer10cm: number | null;
    safety: number;
  };
  assumptions: {
    metresPerCm2: number;
    stitchFactor: number;
    gaugeFactor: number;
    typicalGaugeStsPer10cm: number;
  };
}

export interface YarnOptions {
  stitch?: string;
  gaugeStsPer10cm?: number | null;
  metresPerBall?: number | null;
  safety?: number;
}

/**
 * Estimate yarn required for a flat rectangular piece.
 * Throws CalcError on invalid inputs so the assistant can decline cleanly.
 */
export function estimateYarn(
  widthCm: number,
  heightCm: number,
  weight: string,
  options: YarnOptions = {},
): YarnEstimate {
  const { stitch = "stockinette", gaugeStsPer10cm = null, metresPerBall = null, safety = 0.1 } = options;

  if (widthCm === null || widthCm === undefined || heightCm === null || heightCm === undefined) {
    throw new CalcError("Both widthCm and heightCm are required.");
  }
  if (widthCm <= 0 || heightCm <= 0) {
    throw new CalcError("Dimensions must be positive.");
  }
  if (safety < 0) {
    throw new CalcError("Safety margin cannot be negative.");
  }

  const w = resolveWeight(weight);
  const [stitchName, stitchFactor] = resolveStitchFactor(stitch);

  let gaugeFactor = 1.0;
  if (gaugeStsPer10cm !== null && gaugeStsPer10cm !== undefined) {
    if (gaugeStsPer10cm <= 0) throw new CalcError("Gauge must be positive.");
    gaugeFactor = gaugeStsPer10cm / w.typicalGauge;
  }

  const area = widthCm * heightCm;
  const metres = area * w.metresPerCm2 * stitchFactor * gaugeFactor;
  const metresWithSafety = metres * (1 + safety);

  const mpb = metresPerBall ?? w.metresPerBall;
  if (mpb <= 0) throw new CalcError("metresPerBall must be positive.");
  const balls = Math.ceil(metresWithSafety / mpb);

  return {
    metres: Math.round(metres),
    metresWithSafety: Math.round(metresWithSafety),
    balls,
    metresPerBall: mpb,
    inputs: {
      widthCm,
      heightCm,
      weight: w.slug,
      weightLabel: w.label,
      stitch: stitchName,
      gaugeStsPer10cm,
      safety,
    },
    assumptions: {
      metresPerCm2: w.metresPerCm2,
      stitchFactor,
      gaugeFactor: roundTo(gaugeFactor, 3),
      typicalGaugeStsPer10cm: w.typicalGauge,
    },
  };
}

export function formatYarn(e: YarnEstimate): string {
  const i = e.inputs;
  return (
    `For a ${i.widthCm} x ${i.heightCm} cm ${i.stitch} piece in ${i.weightLabel} yarn, ` +
    `you need about ${e.metres} m of yarn (~${e.metresWithSafety} m with a ` +
    `${Math.round(i.safety * 100)}% safety margin), which is about ${e.balls} ball(s) ` +
    `at ~${e.metresPerBall} m per ball.`
  );
}
