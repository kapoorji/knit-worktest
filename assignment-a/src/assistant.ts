/**
 * The assistant: natural-language question -> trustworthy answer.
 *
 * Pipeline:
 *   1. UNDERSTAND  the LLM (or offline parser) extracts intent + params.
 *   2. COMPUTE     the matching calculator produces the numbers. If params are
 *                  missing or the intent is unknown, the assistant DECLINES —
 *                  it never guesses a number.
 *   3. PHRASE      a deterministic template gives the canonical answer. If a real
 *                  LLM is available it may rephrase it — but only if every
 *                  computed number survives verification; otherwise we keep the
 *                  template. Either way the delivered numbers are the code's.
 */

import { estimateYarn, formatYarn } from "./yarn.js";
import { recommendNeedle, formatNeedle } from "./needles.js";
import { diagnoseTension, formatTension } from "./tension.js";
import { CalcError } from "./data.js";
import { type LlmClient, getLlmClient } from "./llm.js";
import type { Intent } from "./parse.js";

export interface AssistantAnswer {
  answer: string;
  declined: boolean;
  intent: Intent;
  params: Record<string, unknown>;
  calculator: "yarn" | "needle" | "tension" | null;
  result: unknown | null;
  provider: string;
  phrasing: "llm" | "template";
  /** true when the delivered answer's numbers are the calculator's (always so). */
  numbersVerified: boolean;
  latencyMs: number;
}

interface Routed {
  calculator: "yarn" | "needle" | "tension";
  result: unknown;
  canonical: string;
  /** the computed numbers that must appear in any rephrasing */
  criticalNumbers: string[];
}

function has(params: Record<string, unknown>, key: string): boolean {
  return params[key] !== undefined && params[key] !== null;
}

function n(params: Record<string, unknown>, key: string): number {
  return Number(params[key]);
}

/** Route to a calculator, or throw CalcError with a helpful "I need X" message. */
function route(intent: Intent, params: Record<string, unknown>): Routed {
  switch (intent) {
    case "yarn": {
      const missing: string[] = [];
      if (!has(params, "width") || !has(params, "height")) missing.push("the finished width and height in cm");
      if (!has(params, "weight")) missing.push("the yarn weight (e.g. DK, worsted)");
      if (missing.length) throw new CalcError(`To estimate yarn I need ${missing.join(" and ")}.`);
      const result = estimateYarn(n(params, "width"), n(params, "height"), String(params.weight), {
        stitch: has(params, "stitch") ? String(params.stitch) : "stockinette",
        gaugeStsPer10cm: has(params, "gauge") ? n(params, "gauge") : null,
      });
      return {
        calculator: "yarn",
        result,
        canonical: formatYarn(result),
        criticalNumbers: [String(result.metres), String(result.metresWithSafety), String(result.balls)],
      };
    }
    case "needle": {
      if (!has(params, "weight")) throw new CalcError("To recommend a needle size I need the yarn weight (e.g. DK, worsted).");
      const result = recommendNeedle(String(params.weight), {
        fabric: has(params, "fabric") ? String(params.fabric) : "balanced",
        projectType: has(params, "projectType") ? String(params.projectType) : null,
      });
      const crit = [String(result.metricMm)];
      if (result.us !== "-") crit.push(result.us);
      if (result.uk !== "-") crit.push(result.uk);
      return { calculator: "needle", result, canonical: formatNeedle(result), criticalNumbers: crit };
    }
    case "tension": {
      if (!has(params, "target") || !has(params, "actual")) {
        throw new CalcError("To diagnose tension I need both your swatch gauge and the pattern's gauge, in stitches per 10cm.");
      }
      const result = diagnoseTension(n(params, "target"), n(params, "actual"));
      const crit =
        result.problem === "on_gauge"
          ? [String(result.inputs.actual), String(result.inputs.target)]
          : [String(Math.abs(result.sizeDeltaPct)), String(Math.abs(result.needleChangeMm))];
      return { calculator: "tension", result, canonical: formatTension(result), criticalNumbers: crit };
    }
    default:
      throw new CalcError(
        "I can help with yarn quantities, needle sizes, and gauge/tension problems. Could you rephrase your question around one of those?",
      );
  }
}

/** Whether `token` appears in `text` as a standalone number (not part of another). */
function containsNumber(text: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\d.])${escaped}(?![\\d.])`).test(text);
}

/** Ask a question. Never throws for domain issues — it declines instead. */
export async function ask(question: string, client: LlmClient = getLlmClient()): Promise<AssistantAnswer> {
  const start = Date.now();
  const q = (question ?? "").trim();

  if (!q) {
    return {
      answer: "Please ask a knitting question — for example how much yarn you need, a needle size, or a gauge problem.",
      declined: true, intent: "unknown", params: {}, calculator: null, result: null,
      provider: client.name, phrasing: "template", numbersVerified: false, latencyMs: Date.now() - start,
    };
  }

  const { intent, params } = await client.extract(q);

  let routed: Routed;
  try {
    routed = route(intent, params);
  } catch (err) {
    if (err instanceof CalcError) {
      return {
        answer: err.message, declined: true, intent, params, calculator: null, result: null,
        provider: client.name, phrasing: "template", numbersVerified: false, latencyMs: Date.now() - start,
      };
    }
    throw err;
  }

  // Phrase: try the LLM, but keep the template unless every number survives.
  let answer = routed.canonical;
  let phrasing: "llm" | "template" = "template";
  const maybePhrase = client.phrase(q, routed.canonical);
  if (maybePhrase) {
    try {
      const rephrased = (await maybePhrase).trim();
      if (rephrased && routed.criticalNumbers.every((num) => containsNumber(rephrased, num))) {
        answer = rephrased;
        phrasing = "llm";
      }
      // else: verification failed -> keep the trusted template
    } catch {
      // LLM phrasing failed -> keep the trusted template
    }
  }

  return {
    answer,
    declined: false,
    intent,
    params,
    calculator: routed.calculator,
    result: routed.result,
    provider: client.name,
    phrasing,
    numbersVerified: true, // delivered numbers are always the calculator's
    latencyMs: Date.now() - start,
  };
}
