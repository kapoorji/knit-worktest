/**
 * Deterministic knitting calculators.
 *
 * Pure TypeScript, no runtime dependencies, fully tested. These functions are
 * the single source of truth for every number the AI assistant reports.
 */

export { estimateYarn, formatYarn } from "./yarn.js";
export type { YarnEstimate, YarnOptions } from "./yarn.js";

export { recommendNeedle, formatNeedle } from "./needles.js";
export type { NeedleRecommendation, NeedleOptions } from "./needles.js";

export { diagnoseTension, formatTension } from "./tension.js";
export type { TensionDiagnosis, TensionProblem, Severity } from "./tension.js";

export { CalcError, YARN_WEIGHTS, resolveWeight } from "./data.js";
export type { YarnWeight, NeedleSizes } from "./data.js";

export const VERSION = "0.1.0";
