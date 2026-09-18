/**
 * Offline, rule-based question parser.
 *
 * Extracts an *intent* (which calculator) and *parameters* from a natural-language
 * question using regexes and keyword matching — no LLM, no network. This is:
 *   1. the keyless fallback when no API key is present, and
 *   2. what the unit tests and the eval script run against, so the whole system
 *      is testable with no key and no cost.
 *
 * It is deliberately conservative: when it isn't confident, it returns intent
 * "unknown" so the assistant declines rather than guesses.
 */

import { STITCH_YARN_FACTOR } from "./data.js";

export type Intent = "yarn" | "needle" | "tension" | "unknown";

export interface Extraction {
  intent: Intent;
  params: Record<string, unknown>;
}

// Alphabetic yarn-weight aliases only (never bare digits — those clash with
// dimensions/gauge). Longest first so "super bulky" beats "bulky".
const WEIGHT_ALIASES = [
  "super fine", "superfine", "super bulky", "superbulky", "super chunky",
  "light worsted", "fingering", "worsted", "chunky", "bulky", "sport",
  "aran", "afghan", "roving", "cobweb", "thread", "lace", "sock", "baby",
  "fine", "light", "medium", "jumbo", "craft", "rug", "dk",
].sort((a, b) => b.length - a.length);

const STITCH_NAMES = Object.keys(STITCH_YARN_FACTOR).sort((a, b) => b.length - a.length);

function findWeight(q: string): string | undefined {
  for (const alias of WEIGHT_ALIASES) {
    if (new RegExp(`\\b${alias.replace(/ /g, "\\s+")}\\b`).test(q)) return alias;
  }
  return undefined;
}

function findStitch(q: string): string | undefined {
  for (const name of STITCH_NAMES) {
    if (new RegExp(`\\b${name.replace(/ /g, "\\s+")}\\b`).test(q)) return name;
  }
  return undefined;
}

function findFabric(q: string): string | undefined {
  if (/\b(firm|dense|stiff|sturdy|hard[- ]?wearing)\b/.test(q)) return "firm";
  if (/\b(drapey|drape|soft|flowy|floppy|loose)\b/.test(q)) return "drapey";
  if (/\b(balanced|standard|normal|regular)\b/.test(q)) return "balanced";
  return undefined;
}

const PROJECTS = ["blanket", "throw", "scarf", "shawl", "wrap", "socks", "sock", "hat", "beanie", "mittens", "gloves", "sweater", "cardigan", "bag"];
function findProject(q: string): string | undefined {
  return PROJECTS.find((p) => new RegExp(`\\b${p}\\b`).test(q));
}

function findDimensions(q: string): { width: number; height: number } | undefined {
  // "50 x 60cm", "50x60 cm", "50 by 60", "50cm x 60cm"
  const m = q.match(/(\d+(?:\.\d+)?)\s*(?:cm)?\s*(?:x|by|×|\*)\s*(\d+(?:\.\d+)?)\s*(?:cm)?/);
  if (!m) return undefined;
  return { width: Number(m[1]), height: Number(m[2]) };
}

function looksLikeYarn(q: string): boolean {
  return /\b(how much|how many)\b.*\b(yarn|balls?|skeins?|metres?|meters?|yards?|wool)\b/.test(q)
    || /\b(yarn|balls?|skeins?)\b.*\b(need|require|buy)\b/.test(q)
    || /\bhow (much|many)\b.*\b(need|require)\b/.test(q) && /\b(yarn|balls?|skeins?|wool)\b/.test(q);
}

function looksLikeNeedle(q: string): boolean {
  return /\bneedle(s)?\b/.test(q) && /\b(size|which|what|recommend|use)\b/.test(q);
}

function looksLikeTension(q: string): boolean {
  return /\b(tension|gauge)\b/.test(q)
    || /\bstitches?\s+per\s+10\s*cm\b/.test(q)
    || (/\bswatch\b/.test(q) && /\bpattern\b/.test(q));
}

function parseTension(q: string): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  // actual = the knitter's swatch; target = what the pattern asks for.
  const actualM = q.match(/(?:swatch\s+is|i(?:'m| am)?\s+getting|i\s+get|my\s+gauge\s+is|getting)\D{0,15}(\d+(?:\.\d+)?)/);
  const targetM = q.match(/(?:pattern\s+says|should\s+be|target|calls?\s+for|needs?|meant\s+to\s+be|supposed\s+to\s+be|asks?\s+for)\D{0,15}(\d+(?:\.\d+)?)/);
  if (actualM) params.actual = Number(actualM[1]);
  if (targetM) params.target = Number(targetM[1]);

  // Fallback: exactly two "N stitches" figures -> first is the swatch (actual),
  // second is the pattern (target). Common phrasing in the wild.
  if (params.actual === undefined || params.target === undefined) {
    const nums = [...q.matchAll(/(\d+(?:\.\d+)?)\s*(?:sts?|stitches)/g)].map((m) => Number(m[1]));
    if (nums.length >= 2) {
      if (params.actual === undefined) params.actual = nums[0];
      if (params.target === undefined) params.target = nums[1];
    }
  }
  return params;
}

/** Parse a question into an intent + parameters, offline. */
export function parseOffline(question: string): Extraction {
  const q = question.toLowerCase();

  // Order matters: needle and yarn are more specific than a bare gauge mention.
  if (looksLikeNeedle(q)) {
    const params: Record<string, unknown> = {};
    const weight = findWeight(q);
    if (weight) params.weight = weight;
    const fabric = findFabric(q);
    if (fabric) params.fabric = fabric;
    const project = findProject(q);
    if (project) params.projectType = project;
    return { intent: "needle", params };
  }

  if (looksLikeYarn(q)) {
    const params: Record<string, unknown> = {};
    const dims = findDimensions(q);
    if (dims) {
      params.width = dims.width;
      params.height = dims.height;
    }
    const weight = findWeight(q);
    if (weight) params.weight = weight;
    const stitch = findStitch(q);
    if (stitch) params.stitch = stitch;
    return { intent: "yarn", params };
  }

  if (looksLikeTension(q)) {
    return { intent: "tension", params: parseTension(q) };
  }

  return { intent: "unknown", params: {} };
}
