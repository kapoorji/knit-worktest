/**
 * Base-structure generator.
 *
 * Produces the neutral-grey relief structure for a stitch (the thing the tint
 * path colours). Cache-gated on the *structure key*, so a repeat call skips
 * generation. Two backends:
 *   - mock: procedural SVG geometry via sharp — keyless, deterministic, and
 *     structurally distinct per stitch (so the offline demo proves structure).
 *   - real: gpt-image-1 via fetch, only when `live` and OPENAI_API_KEY are set.
 *
 * On failure (including the deliberate `forceFail` switch) it throws
 * GenerationError; the caller turns that into a transient fallback swatch.
 */

import sharp from "sharp";
import { mockSvg } from "./mock.js";
import { buildPrompt, PROMPT_VERSION } from "./prompt.js";
import { structureKey, readImage, writeImage, type StructureParams } from "./cache.js";
import { env } from "./env.js";
import type { SwatchInput } from "./schema.js";

export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationError";
  }
}

export interface GenOptions {
  live?: boolean; // use the real API if a key is present
  forceFail?: boolean; // deliberately trigger the failure path
  model?: string;
  size?: number;
}

export interface GenResult {
  image: Buffer; // neutral-grey structure
  source: "cache" | "mock" | "api";
  fromCache: boolean;
  latencyMs: number;
  key: string;
  prompt: string;
}

const SIZE = 512;

async function renderMock(input: SwatchInput): Promise<Buffer> {
  return sharp(Buffer.from(mockSvg(input.stitch_type))).resize(SIZE, SIZE).png().toBuffer();
}

async function renderApi(input: SwatchInput, model: string): Promise<Buffer> {
  const key = env("OPENAI_API_KEY");
  if (!key) throw new GenerationError("OPENAI_API_KEY not set — cannot use the live image API.");
  const prompt = buildPrompt(input, { neutralBase: true });
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 60000);
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      signal: ac.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, prompt, size: "1024x1024", n: 1 }),
    });
    if (!res.ok) throw new GenerationError(`Image API ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { data: Array<{ b64_json?: string }> };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new GenerationError("Image API returned no image.");
    return sharp(Buffer.from(b64, "base64")).resize(SIZE, SIZE).png().toBuffer();
  } finally {
    clearTimeout(timer);
  }
}

export async function getStructure(input: SwatchInput, opts: GenOptions = {}): Promise<GenResult> {
  const mode: "mock" | "real" = opts.live ? "real" : "mock";
  const model = opts.model ?? "gpt-image-1";
  const params: StructureParams = { mode, model, size: opts.size ?? SIZE, promptVersion: PROMPT_VERSION };
  const key = structureKey(input, params);
  const prompt = buildPrompt(input, { neutralBase: true });

  const t0 = Date.now();

  const cached = await readImage(key);
  if (cached) return { image: cached, source: "cache", fromCache: true, latencyMs: Date.now() - t0, key, prompt };

  if (opts.forceFail) throw new GenerationError("Forced failure (forceFail=true) for fallback demonstration.");

  const image = mode === "real" ? await renderApi(input, model) : await renderMock(input);
  await writeImage(key, image, { stitch: input.stitch_type, weight: input.weight_category, fibre: input.fibre_content, mode, model, promptVersion: PROMPT_VERSION, prompt });
  return { image, source: mode === "real" ? "api" : "mock", fromCache: false, latencyMs: Date.now() - t0, key, prompt };
}
