/**
 * LLM clients behind one interface.
 *
 * The model's job is narrow: understand the question (extract intent + params)
 * and phrase the final answer. It NEVER produces a number — numbers come from
 * the calculators, and phrasing is verified against them by the assistant.
 *
 *   - OfflineClient: keyless, rule-based. Always available; used for tests, for
 *     the eval script, and as the fallback when no key is set or an API fails.
 *   - AnthropicClient / OpenAiClient: real providers via fetch (no SDK dep).
 *     Their extraction falls back to the offline parser on any error, so the
 *     assistant degrades gracefully instead of breaking.
 */

import { parseOffline, type Extraction, type Intent } from "./parse.js";
import { resolveLlmConfig, type LlmConfig } from "./env.js";

export interface LlmClient {
  readonly name: string;
  /** Extract intent + params from the question. */
  extract(question: string): Promise<Extraction>;
  /** Rephrase a canonical answer in a friendly tone, or null if not supported. */
  phrase(question: string, canonicalAnswer: string): Promise<string> | null;
}

const VALID_INTENTS: Intent[] = ["yarn", "needle", "tension", "unknown"];

const EXTRACTION_SYSTEM = `You extract structured intent from a knitting question.
Return ONLY JSON: {"intent": <intent>, "params": <object>}. No prose, no code fences.

intent is one of:
  "yarn"    -> how much yarn / how many balls. params: {width, height (cm, numbers),
               weight (e.g. dk, worsted, lace), stitch (stockinette, garter, rib,
               seed, moss, cable, lace)}
  "needle"  -> which needle size. params: {weight, fabric (firm|balanced|drapey),
               projectType (e.g. scarf, socks)}
  "tension" -> gauge/tension problem. params: {target, actual} as stitches per 10cm,
               where actual = the knitter's swatch and target = what the pattern asks.
  "unknown" -> anything else, or if you are unsure. params: {}

Only include params you are confident about. Never invent numbers.`;

const PHRASE_SYSTEM = `You are a friendly, concise knitting assistant.
You are given the user's question and a trusted answer computed by code.
Rephrase the trusted answer in one or two warm, natural sentences.
You MUST keep every number and unit exactly as given. Never add, drop, round or
change any number. Do not add facts that are not in the trusted answer.`;

function extractJsonObject(text: string): Extraction {
  let t = text.trim();
  // strip ```json ... ``` fences if the model added them
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1]!.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in model output");
  const obj = JSON.parse(t.slice(start, end + 1));
  const intent: Intent = VALID_INTENTS.includes(obj.intent) ? obj.intent : "unknown";
  const params = obj.params && typeof obj.params === "object" ? obj.params : {};
  return { intent, params };
}

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms = 20000): Promise<T> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await p(ac.signal);
  } finally {
    clearTimeout(timer);
  }
}

// --------------------------------------------------------------------------- //

export class OfflineClient implements LlmClient {
  readonly name = "offline";
  async extract(question: string): Promise<Extraction> {
    return parseOffline(question);
  }
  phrase(): null {
    return null; // deterministic template is used as-is
  }
}

// --------------------------------------------------------------------------- //

export class AnthropicClient implements LlmClient {
  readonly name = "anthropic";
  constructor(private apiKey: string, private model: string) {}

  private async call(system: string, user: string): Promise<string> {
    return withTimeout(async (signal) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model: this.model, max_tokens: 400, system, messages: [{ role: "user", content: user }] }),
      });
      if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { content: Array<{ text?: string }> };
      return data.content?.map((c) => c.text ?? "").join("") ?? "";
    });
  }

  async extract(question: string): Promise<Extraction> {
    try {
      return extractJsonObject(await this.call(EXTRACTION_SYSTEM, question));
    } catch {
      return parseOffline(question); // graceful degradation
    }
  }

  phrase(question: string, canonicalAnswer: string): Promise<string> {
    return this.call(PHRASE_SYSTEM, `Question: ${question}\n\nTrusted answer: ${canonicalAnswer}`);
  }
}

// --------------------------------------------------------------------------- //

export class OpenAiClient implements LlmClient {
  readonly name = "openai";
  constructor(private apiKey: string, private model: string) {}

  private async call(system: string, user: string): Promise<string> {
    return withTimeout(async (signal) => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
      return data.choices?.[0]?.message?.content ?? "";
    });
  }

  async extract(question: string): Promise<Extraction> {
    try {
      return extractJsonObject(await this.call(EXTRACTION_SYSTEM, question));
    } catch {
      return parseOffline(question);
    }
  }

  phrase(question: string, canonicalAnswer: string): Promise<string> {
    return this.call(PHRASE_SYSTEM, `Question: ${question}\n\nTrusted answer: ${canonicalAnswer}`);
  }
}

// --------------------------------------------------------------------------- //

/** Build the client from environment/config. Falls back to offline with no key. */
export function getLlmClient(config: LlmConfig = resolveLlmConfig()): LlmClient {
  if (config.provider === "anthropic" && config.apiKey) return new AnthropicClient(config.apiKey, config.model);
  if (config.provider === "openai" && config.apiKey) return new OpenAiClient(config.apiKey, config.model);
  return new OfflineClient();
}
