/**
 * Assignment B unit tests — all keyless (mock generator + pure functions).
 */

import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { normalise, normaliseHex, InputError, type SwatchInput } from "../src/schema.js";
import { hexToRgb, rgbToOklab, oklabToRgb, rgbToLab, hexToLab, deltaE2000 } from "../src/colour.js";
import { structureKey, previewKey, clearCache, type StructureParams } from "../src/cache.js";
import { tintToHex } from "../src/tint.js";
import { getStructure, GenerationError } from "../src/generator.js";
import { placeholder } from "../src/fallback.js";

const P: StructureParams = { mode: "mock", model: "gpt-image-1", size: 512, promptVersion: "v1" };
const base = (over: Partial<SwatchInput> = {}): SwatchInput =>
  normalise({ stitch_type: "cable", colour_name: "x", colour_hex: "#5b3e96", weight_category: "medium", fibre_content: "100% wool", ...over });

describe("schema", () => {
  it("expands and lowercases hex", () => {
    expect(normaliseHex("#FFF")).toBe("#ffffff");
    expect(normaliseHex("5B3E96")).toBe("#5b3e96");
  });
  it("rejects bad hex and unknown stitch", () => {
    expect(() => normaliseHex("#zzzz")).toThrow(InputError);
    expect(() => normalise({ stitch_type: "bobble" as never, colour_hex: "#fff" })).toThrow(InputError);
  });
  it("defaults sensibly", () => {
    const s = normalise({ stitch_type: "rib", colour_hex: "#abc" });
    expect(s.weight_category).toBe("medium");
    expect(s.fibre_content).toBeTruthy();
  });
});

describe("colour", () => {
  it("round-trips sRGB <-> OKLab within 1 unit", () => {
    for (const hex of ["#5b3e96", "#e8e8e8", "#1a1a2e", "#c0392b"]) {
      const rgb = hexToRgb(hex);
      const back = oklabToRgb(rgbToOklab(rgb));
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(1);
    }
  });
  it("ΔE2000 is 0 for identical and large for black vs white", () => {
    expect(deltaE2000(hexToLab("#5b3e96"), hexToLab("#5b3e96"))).toBeCloseTo(0, 5);
    expect(deltaE2000(rgbToLab({ r: 0, g: 0, b: 0 }), rgbToLab({ r: 255, g: 255, b: 255 }))).toBeGreaterThan(95);
  });
});

describe("cache keys", () => {
  it("structure key EXCLUDES colour (two colours -> same key)", () => {
    const a = structureKey(base({ colour_hex: "#111111" }), P);
    const b = structureKey(base({ colour_hex: "#eeeeee" }), P);
    expect(a).toBe(b);
  });
  it("structure key changes with stitch, mode, model", () => {
    const k = structureKey(base(), P);
    expect(structureKey(base({ stitch_type: "rib" }), P)).not.toBe(k);
    expect(structureKey(base(), { ...P, mode: "real" })).not.toBe(k);
    expect(structureKey(base(), { ...P, model: "flux" })).not.toBe(k);
  });
  it("preview key changes with hex", () => {
    const sk = structureKey(base(), P);
    expect(previewKey(sk, "#111111")).not.toBe(previewKey(sk, "#eeeeee"));
  });
});

describe("tint", () => {
  it("mean colour matches the hex (ΔE2000 < 3) across colours", async () => {
    const struct = await getStructure(base({ stitch_type: "stockinette" }), {});
    for (const hex of ["#5b3e96", "#1a1a2e", "#e8e8e8", "#c0392b", "#0f7f4f"]) {
      const { image, meanDeltaE } = await tintToHex(struct.image, hex);
      expect(meanDeltaE).toBeLessThan(3);
      expect((await sharp(image).metadata()).format).toBe("png");
    }
  });
});

describe("generator", () => {
  beforeAll(async () => {
    await clearCache();
  });
  it("caches: second identical call is a HIT", async () => {
    const inp = base({ stitch_type: "seed" });
    const first = await getStructure(inp, {});
    const second = await getStructure(inp, {});
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
  });
  it("draws structurally distinct geometry per stitch (bytes differ)", async () => {
    const a = await getStructure(base({ stitch_type: "stockinette" }), {});
    const b = await getStructure(base({ stitch_type: "cable" }), {});
    expect(Buffer.compare(a.image, b.image)).not.toBe(0);
  });
  it("forceFail throws GenerationError (for the fallback path)", async () => {
    await clearCache();
    await expect(getStructure(base({ stitch_type: "garter" }), { forceFail: true })).rejects.toBeInstanceOf(GenerationError);
  });
});

describe("fallback", () => {
  it("returns a valid PNG placeholder", async () => {
    const png = await placeholder("#5b3e96");
    expect((await sharp(png).metadata()).format).toBe("png");
  });
});
