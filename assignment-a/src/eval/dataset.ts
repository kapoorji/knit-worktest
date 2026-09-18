/**
 * Evaluation dataset: realistic natural-language questions with a known-correct
 * expectation. Answered cases carry a `reference` that is computed by calling
 * the calculators directly — so the calculators are the *oracle* and the eval
 * checks the assistant's answer against an independent computation, not itself.
 *
 * All questions are phrased so the keyless offline parser can route them, so the
 * whole eval runs with no API key.
 */

import { estimateYarn } from "../yarn.js";
import { recommendNeedle } from "../needles.js";
import { diagnoseTension } from "../tension.js";
import { criticalNumbers, type Calculator } from "../assistant.js";

export type Expectation =
  | { type: "answer"; calculator: Calculator; reference: () => string[] }
  | { type: "decline"; reason: string };

export interface EvalCase {
  id: number;
  question: string;
  expect: Expectation;
}

const answer = (calculator: Calculator, result: unknown): Expectation => ({
  type: "answer",
  calculator,
  reference: () => criticalNumbers(calculator, result),
});
const decline = (reason: string): Expectation => ({ type: "decline", reason });

export const DATASET: EvalCase[] = [
  // --- yarn quantity ---
  { id: 1, question: "How much DK yarn do I need for a 50 x 60cm blanket in stockinette?",
    expect: answer("yarn", estimateYarn(50, 60, "dk", { stitch: "stockinette" })) },
  { id: 2, question: "How many balls of worsted do I need for a 40 x 40 cm cushion in cable?",
    expect: answer("yarn", estimateYarn(40, 40, "worsted", { stitch: "cable" })) },
  { id: 3, question: "How much bulky yarn do I need for a 30 by 100 cm scarf in garter?",
    expect: answer("yarn", estimateYarn(30, 100, "bulky", { stitch: "garter" })) },
  { id: 4, question: "How much lace weight yarn for an 80 x 80 cm shawl in lace?",
    expect: answer("yarn", estimateYarn(80, 80, "lace", { stitch: "lace" })) },
  { id: 5, question: "How much super bulky yarn do I need for a 45 x 70 cm blanket?",
    expect: answer("yarn", estimateYarn(45, 70, "super_bulky", { stitch: "stockinette" })) },

  // --- needle recommender ---
  { id: 6, question: "What needle size should I use for worsted yarn for a scarf?",
    expect: answer("needle", recommendNeedle("worsted", { fabric: "balanced", projectType: "scarf" })) },
  { id: 7, question: "Which needles should I use for DK yarn?",
    expect: answer("needle", recommendNeedle("dk", { fabric: "balanced" })) },
  { id: 8, question: "What needle size for sock yarn if I want a firm fabric?",
    expect: answer("needle", recommendNeedle("super_fine", { fabric: "firm" })) },
  { id: 9, question: "Recommend a needle for bulky yarn for a drapey wrap.",
    expect: answer("needle", recommendNeedle("bulky", { fabric: "drapey", projectType: "wrap" })) },
  { id: 10, question: "What needle size should I use for super bulky yarn?",
    expect: answer("needle", recommendNeedle("super_bulky", { fabric: "balanced" })) },

  // --- tension troubleshooter ---
  { id: 11, question: "My swatch is 24 stitches per 10cm but the pattern says 22. What's wrong?",
    expect: answer("tension", diagnoseTension(22, 24)) },
  { id: 12, question: "The pattern says 18 but I'm getting 16 stitches per 10cm. What should I change?",
    expect: answer("tension", diagnoseTension(18, 16)) },
  { id: 13, question: "My gauge is 30 sts per 10cm but it should be 28. Help?",
    expect: answer("tension", diagnoseTension(28, 30)) },
  { id: 14, question: "My tension is off — I'm getting 20 stitches per 10cm and the pattern calls for 22.",
    expect: answer("tension", diagnoseTension(22, 20)) },
  { id: 15, question: "My swatch is 27 stitches per 10cm but the pattern needs 24.",
    expect: answer("tension", diagnoseTension(24, 27)) },
  { id: 16, question: "My swatch is 22 stitches per 10cm and the pattern says 22 — am I ok?",
    expect: answer("tension", diagnoseTension(22, 22)) },

  // --- must decline (out of scope, or missing required inputs) ---
  { id: 17, question: "What colour of yarn should I choose for a baby blanket?",
    expect: decline("out of scope — colour choice") },
  { id: 18, question: "How much yarn do I need?",
    expect: decline("missing dimensions and weight") },
  { id: 19, question: "What needle size should I use?",
    expect: decline("missing yarn weight") },
  { id: 20, question: "Who invented knitting?",
    expect: decline("out of scope — trivia") },
];
