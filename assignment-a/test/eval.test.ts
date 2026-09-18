/**
 * Locks the evaluation harness to 100% on the offline path, so a regression in
 * routing, the calculators, or the parser fails CI. Keyless.
 */

import { describe, it, expect } from "vitest";
import { runEval } from "../src/eval/run.js";
import { DATASET } from "../src/eval/dataset.js";
import { OfflineClient } from "../src/llm.js";

describe("evaluation harness (offline)", () => {
  it("has at least 15 cases", () => {
    expect(DATASET.length).toBeGreaterThanOrEqual(15);
  });

  it("passes every case offline", async () => {
    const report = await runEval(new OfflineClient());
    const failing = report.rows.filter((r) => !r.pass).map((r) => `#${r.id} ${r.note}`);
    expect(failing).toEqual([]);
    expect(report.summary.allPass).toBe(true);
    expect(report.summary.routingCorrect).toBe(report.summary.total);
    expect(report.summary.numbersCorrect).toBe(report.summary.answered);
    expect(report.summary.declineCorrect).toBe(report.summary.declineTotal);
  });
});
