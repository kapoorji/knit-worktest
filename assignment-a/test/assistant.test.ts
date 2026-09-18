/**
 * Assistant + offline-parser tests. These run with NO API key: they use the
 * OfflineClient, so the whole understand -> compute -> phrase -> decline pipeline
 * is covered keyless and for free.
 */

import { describe, it, expect } from "vitest";
import { ask, parseOffline } from "../src/index.js";
import { OfflineClient } from "../src/llm.js";

const offline = new OfflineClient();
const askOffline = (q: string) => ask(q, offline);

describe("offline parser — intent + params", () => {
  it("parses the yarn-quantity example", () => {
    const e = parseOffline("How much DK yarn do I need for a 50 x 60cm blanket in stockinette?");
    expect(e.intent).toBe("yarn");
    expect(e.params).toMatchObject({ width: 50, height: 60, weight: "dk", stitch: "stockinette" });
  });

  it("parses the needle example", () => {
    const e = parseOffline("What needle size should I use for worsted yarn for a scarf?");
    expect(e.intent).toBe("needle");
    expect(e.params).toMatchObject({ weight: "worsted", projectType: "scarf" });
  });

  it("parses the tension example (swatch=actual, pattern=target)", () => {
    const e = parseOffline("My swatch is 24 stitches per 10cm but the pattern says 22. What's wrong?");
    expect(e.intent).toBe("tension");
    expect(e.params).toMatchObject({ actual: 24, target: 22 });
  });

  it("returns unknown for out-of-scope questions", () => {
    expect(parseOffline("What colour of yarn should I choose for a baby blanket?").intent).toBe("unknown");
    expect(parseOffline("Who invented knitting?").intent).toBe("unknown");
  });
});

describe("assistant — answers use the calculators' numbers", () => {
  it("answers the yarn example with the computed figures", async () => {
    const a = await askOffline("How much DK yarn do I need for a 50 x 60cm blanket in stockinette?");
    expect(a.declined).toBe(false);
    expect(a.calculator).toBe("yarn");
    expect(a.provider).toBe("offline");
    expect(a.numbersVerified).toBe(true);
    expect((a.result as { metres: number }).metres).toBe(600);
    expect((a.result as { balls: number }).balls).toBe(6);
    expect(a.answer).toContain("600");
    expect(a.answer).toContain("6 ball");
  });

  it("answers the needle example", async () => {
    const a = await askOffline("What needle size should I use for worsted yarn for a scarf?");
    expect(a.declined).toBe(false);
    expect(a.calculator).toBe("needle");
    expect((a.result as { metricMm: number }).metricMm).toBe(5.0);
    expect(a.answer).toContain("US 8");
  });

  it("answers the tension example (too tight, go up)", async () => {
    const a = await askOffline("My swatch is 24 stitches per 10cm but the pattern says 22. What's wrong?");
    expect(a.declined).toBe(false);
    expect(a.calculator).toBe("tension");
    expect((a.result as { problem: string }).problem).toBe("too_tight");
    expect(a.answer.toLowerCase()).toContain("too tight");
  });
});

describe("assistant — declines rather than guessing", () => {
  it("declines out-of-scope questions with no numbers", async () => {
    const a = await askOffline("What colour of yarn should I choose?");
    expect(a.declined).toBe(true);
    expect(a.calculator).toBeNull();
    expect(a.answer).not.toMatch(/\d/); // no invented numbers
  });

  it("declines when required inputs are missing", async () => {
    const a = await askOffline("How much yarn do I need?");
    expect(a.declined).toBe(true);
    expect(a.intent).toBe("yarn");
    expect(a.answer.toLowerCase()).toContain("width");
  });

  it("declines an empty question", async () => {
    const a = await askOffline("   ");
    expect(a.declined).toBe(true);
  });
});
