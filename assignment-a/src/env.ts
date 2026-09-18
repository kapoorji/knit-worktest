/**
 * Minimal .env loader + LLM configuration — no dependencies.
 *
 * Reads a .env file (repo root or this package) into process.env without
 * overwriting anything already set in the real environment. Just enough to pick
 * up API keys for the assistant; the calculators never need it.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // strip surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

let loaded = false;

/** Load .env from the repo root and this package, once. Real env wins. */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const candidates = [
    resolve(HERE, "../../.env"), // repo root (knit-worktest/.env)
    resolve(HERE, "../.env"), // assignment-a/.env
  ];
  for (const path of candidates) {
    try {
      const parsed = parseDotenv(readFileSync(path, "utf-8"));
      for (const [k, v] of Object.entries(parsed)) {
        if (process.env[k] === undefined) process.env[k] = v;
      }
    } catch {
      // no file here — fine
    }
  }
}

export type Provider = "anthropic" | "openai" | "offline";

export interface LlmConfig {
  provider: Provider;
  apiKey: string | null;
  model: string;
}

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
  offline: "offline",
};

/**
 * Decide which LLM provider to use.
 *   - KNIT_LLM_PROVIDER forces a choice (anthropic | openai | offline).
 *   - Otherwise: Anthropic if its key is set, else OpenAI if its key is set,
 *     else offline (keyless rule-based parser).
 */
export function resolveLlmConfig(): LlmConfig {
  loadEnv();
  const forced = (process.env.KNIT_LLM_PROVIDER ?? "").trim().toLowerCase();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim() || null;
  const openaiKey = process.env.OPENAI_API_KEY?.trim() || null;

  let provider: Provider;
  if (forced === "anthropic" || forced === "openai" || forced === "offline") {
    provider = forced;
  } else if (anthropicKey) {
    provider = "anthropic";
  } else if (openaiKey) {
    provider = "openai";
  } else {
    provider = "offline";
  }

  const apiKey = provider === "anthropic" ? anthropicKey : provider === "openai" ? openaiKey : null;
  const model =
    process.env.KNIT_LLM_MODEL?.trim() || DEFAULT_MODELS[provider];

  return { provider, apiKey, model };
}
