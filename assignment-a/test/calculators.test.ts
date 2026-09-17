/**
 * Unit tests for the deterministic calculators.
 *
 * These lock the numeric behaviour the assistant relies on. Run with:
 *   npm test
 */

import { describe, it, expect } from "vitest";
import { estimateYarn, recommendNeedle, diagnoseTension, resolveWeight, CalcError } from "../src/index.js";

describe("yarn quantity", () => {
  it("matches the reference DK blanket", () => {
    // 50 x 60 cm DK stockinette: 3000 cm2 * 0.20 m/cm2 * 1.0 * 1.0 = 600 m.
    const r = estimateYarn(50, 60, "dk", { stitch: "stockinette", safety: 0.1 });
    expect(r.metres).toBe(600);
    expect(r.metresWithSafety).toBe(660); // +10%
    expect(r.balls).toBe(Math.ceil(660 / 120)); // 6 balls
    expect(r.balls).toBe(6);
  });

  it("treats weight aliases as equal", () => {
    const a = estimateYarn(30, 30, "dk");
    const b = estimateYarn(30, 30, "light");
    const c = estimateYarn(30, 30, "3");
    expect(a.metres).toBe(b.metres);
    expect(b.metres).toBe(c.metres);
  });

  it("uses more yarn for cable than stockinette", () => {
    const plain = estimateYarn(40, 40, "worsted", { stitch: "stockinette" });
    const cable = estimateYarn(40, 40, "worsted", { stitch: "cable" });
    expect(cable.metres).toBeGreaterThan(plain.metres);
  });

  it("uses less yarn for a lace stitch pattern", () => {
    const plain = estimateYarn(40, 40, "worsted", { stitch: "stockinette" });
    const lace = estimateYarn(40, 40, "worsted", { stitch: "lace" });
    expect(lace.metres).toBeLessThan(plain.metres);
  });

  it("needs more metres for finer yarn at the same size", () => {
    const lace = estimateYarn(40, 40, "lace");
    const bulky = estimateYarn(40, 40, "bulky");
    expect(lace.metres).toBeGreaterThan(bulky.metres);
  });

  it("scales with area", () => {
    const small = estimateYarn(20, 20, "worsted");
    const big = estimateYarn(40, 40, "worsted"); // 4x area
    expect(big.metres).toBeCloseTo(small.metres * 4, 0);
  });

  it("uses more yarn at a tighter gauge", () => {
    const typical = resolveWeight("worsted").typicalGauge;
    const loose = estimateYarn(40, 40, "worsted", { gaugeStsPer10cm: typical - 4 });
    const tight = estimateYarn(40, 40, "worsted", { gaugeStsPer10cm: typical + 4 });
    expect(tight.metres).toBeGreaterThan(loose.metres);
  });

  it.each([
    [0, 10],
    [10, 0],
    [-5, 10],
  ])("rejects bad dimensions (%s x %s)", (w, h) => {
    expect(() => estimateYarn(w, h, "dk")).toThrow(CalcError);
  });

  it("rejects an unknown weight", () => {
    expect(() => estimateYarn(30, 30, "spider silk")).toThrow(CalcError);
  });
});

describe("needle recommender", () => {
  it("recommends the balanced worsted size", () => {
    // Worsted range 4.5-5.5 mm, balanced midpoint 5.0 -> US 8 / UK 6.
    const r = recommendNeedle("worsted", { fabric: "balanced" });
    expect(r.metricMm).toBe(5.0);
    expect(r.us).toBe("8");
    expect(r.uk).toBe("6");
  });

  it("picks a smaller needle for firm than drapey", () => {
    const firm = recommendNeedle("worsted", { fabric: "firm" });
    const drapey = recommendNeedle("worsted", { fabric: "drapey" });
    expect(firm.metricMm).toBeLessThan(drapey.metricMm);
  });

  it("returns all three sizing systems", () => {
    const r = recommendNeedle("dk");
    expect(r.metricMm).toBeGreaterThan(0);
    expect(r.us).toBeTruthy();
    expect(r.uk).toBeTruthy();
  });

  it("adds a firmness note for socks", () => {
    const r = recommendNeedle("super_fine", { projectType: "socks", fabric: "balanced" });
    expect(r.note).not.toBeNull();
    expect(r.note!.toLowerCase()).toContain("firm");
  });

  it("rejects an unknown fabric", () => {
    expect(() => recommendNeedle("dk", { fabric: "squishy" })).toThrow(CalcError);
  });
});

describe("tension troubleshooter", () => {
  it("flags too tight and goes up (brief example 24 vs 22)", () => {
    const d = diagnoseTension(22, 24);
    expect(d.problem).toBe("too_tight");
    expect(d.needleChangeMm).toBeGreaterThan(0);
    expect(d.sizeDeltaPct).toBeLessThan(0); // piece comes out smaller
  });

  it("flags too loose and goes down", () => {
    const d = diagnoseTension(22, 20);
    expect(d.problem).toBe("too_loose");
    expect(d.needleChangeMm).toBeLessThan(0);
    expect(d.sizeDeltaPct).toBeGreaterThan(0); // piece comes out larger
  });

  it("reports on-gauge within tolerance", () => {
    const d = diagnoseTension(22, 22);
    expect(d.problem).toBe("on_gauge");
    expect(d.severity).toBe("none");
    expect(d.needleChangeMm).toBe(0);
  });

  it("scales severity with the difference", () => {
    expect(diagnoseTension(22, 23).severity).toBe("minor");
    expect(diagnoseTension(22, 30).severity).toBe("major");
  });

  it.each([
    [0, 22],
    [22, 0],
    [-1, 22],
  ])("rejects bad gauges (%s, %s)", (t, a) => {
    expect(() => diagnoseTension(t, a)).toThrow(CalcError);
  });
});
