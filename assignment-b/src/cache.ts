/**
 * Filesystem cache with TWO keys.
 *
 *   structureKey — excludes colour. This is what GATES image generation, so all
 *                  colours of one stitch share a single base structure (the
 *                  "~6 structures ever generated" economy). Bug-fix from review:
 *                  colour must NOT be in the key or every colour is a miss.
 *   previewKey   — structureKey + hex. Optional cache of a finished preview.
 *
 * Writes are atomic (temp file + rename) so a reader never sees a half-written
 * PNG. A JSON sidecar records provenance for inspection.
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SwatchInput } from "./schema.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = join(HERE, "..", "cache");

export interface StructureParams {
  mode: "mock" | "real";
  model: string;
  size: number;
  promptVersion: string;
}

const sha = (obj: unknown): string => createHash("sha256").update(JSON.stringify(obj)).digest("hex").slice(0, 32);

/** Colour-independent key that gates generation. */
export function structureKey(input: SwatchInput, p: StructureParams): string {
  return sha({
    stitch: input.stitch_type,
    weight: input.weight_category,
    fibre: input.fibre_content.toLowerCase(),
    mode: p.mode,
    model: p.model,
    size: p.size,
    promptVersion: p.promptVersion,
  });
}

/** Colour-specific preview key (for caching tinted/native output). */
export function previewKey(structKey: string, hex: string): string {
  return sha({ structKey, hex });
}

export interface CacheMeta extends Record<string, unknown> {
  key: string;
  timestamp: string;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

export async function readImage(key: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(join(CACHE_DIR, `${key}.png`));
  } catch {
    return null;
  }
}

export async function writeImage(key: string, png: Buffer, meta: Omit<CacheMeta, "key" | "timestamp">): Promise<void> {
  await ensureDir();
  const pngPath = join(CACHE_DIR, `${key}.png`);
  const tmp = join(CACHE_DIR, `.${key}.${process.pid}.tmp`);
  await fs.writeFile(tmp, png);
  await fs.rename(tmp, pngPath); // atomic
  const full: CacheMeta = { key, timestamp: new Date().toISOString(), ...meta };
  await fs.writeFile(join(CACHE_DIR, `${key}.json`), JSON.stringify(full, null, 2));
}

export async function clearCache(): Promise<void> {
  await fs.rm(CACHE_DIR, { recursive: true, force: true });
}
