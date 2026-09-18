/**
 * Ravelry reference lookup.
 *
 * Requirement tension: the call must be REAL, yet the notebook must run without
 * the reviewer's keys. Resolution: a recorded "cassette" (fixtures/ravelry/) is
 * replayed offline (clearly labelled), and the live API is hit when RAVELRY_*
 * credentials are present. `npm run record-ravelry` captures a fresh cassette.
 *
 * Honest framing: a Ravelry hit is a finished garment photo, not a 10x10cm
 * swatch, so the "comparison" is loose (as the brief allows).
 */

import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "..", "fixtures", "ravelry");

export interface RavelryReference {
  found: boolean;
  source: "live" | "cassette" | "none";
  query: string;
  status?: number;
  patternName?: string;
  permalink?: string;
  image?: Buffer;
  note: string;
  sample?: boolean; // true when the cassette is a synthetic placeholder
}

export async function getReference(stitch: string, opts: { live?: boolean } = {}): Promise<RavelryReference> {
  const query = stitch;
  const user = env("RAVELRY_USERNAME");
  const pass = env("RAVELRY_PASSWORD");

  if (opts.live && user && pass) {
    try {
      return await fetchLive(query, user, pass);
    } catch (e) {
      return { found: false, source: "none", query, note: `live fetch failed: ${(e as Error).message}` };
    }
  }

  // Offline: replay the recorded cassette.
  try {
    const cassette = JSON.parse(await fs.readFile(join(FIX, "cassette.json"), "utf-8"));
    const image = await fs.readFile(join(FIX, cassette.image));
    return {
      found: true,
      source: "cassette",
      query: cassette.query,
      status: cassette.status,
      patternName: cassette.patternName,
      permalink: cassette.permalink,
      image,
      sample: cassette.sample === true,
      note: cassette.note,
    };
  } catch {
    return { found: false, source: "none", query, note: "no cassette available and no live credentials" };
  }
}

async function fetchLive(query: string, user: string, pass: string): Promise<RavelryReference> {
  const auth = Buffer.from(`${user}:${pass}`).toString("base64");
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5000);
  try {
    const url = `https://api.ravelry.com/patterns/search.json?query=${encodeURIComponent(query)}&page_size=5&photoless=false`;
    const res = await fetch(url, { headers: { authorization: `Basic ${auth}` }, signal: ac.signal });
    const status = res.status;
    if (!res.ok) throw new Error(`Ravelry search ${status}`);
    const data = (await res.json()) as { patterns?: Array<{ name: string; permalink: string; first_photo?: { medium_url?: string; small_url?: string } }> };
    const p = (data.patterns ?? []).find((x) => x.first_photo?.medium_url || x.first_photo?.small_url);
    if (!p) return { found: false, source: "live", query, status, note: "no photo match" };
    const photo = p.first_photo!.medium_url || p.first_photo!.small_url!;
    const imgRes = await fetch(photo, { signal: ac.signal });
    const image = Buffer.from(await imgRes.arrayBuffer());
    return {
      found: true,
      source: "live",
      query,
      status,
      patternName: p.name,
      permalink: `https://www.ravelry.com/patterns/library/${p.permalink}`,
      image,
      note: "live Ravelry response",
    };
  } finally {
    clearTimeout(timer);
  }
}

// `npm run record-ravelry` — capture a real response into the cassette.
async function record(): Promise<number> {
  const user = env("RAVELRY_USERNAME");
  const pass = env("RAVELRY_PASSWORD");
  if (!user || !pass) {
    console.error("Set RAVELRY_USERNAME and RAVELRY_PASSWORD in .env to record a real cassette.");
    return 2;
  }
  const query = process.argv.includes("--query") ? process.argv[process.argv.indexOf("--query") + 1]! : "cable";
  const ref = await fetchLive(query, user, pass);
  if (!ref.found || !ref.image) {
    console.error(`No usable result for '${query}': ${ref.note}`);
    return 1;
  }
  await fs.mkdir(FIX, { recursive: true });
  await fs.writeFile(join(FIX, "reference.jpg"), ref.image);
  await fs.writeFile(
    join(FIX, "cassette.json"),
    JSON.stringify({ query: ref.query, status: ref.status, patternName: ref.patternName, permalink: ref.permalink, image: "reference.jpg", sample: false, note: "recorded real Ravelry response" }, null, 2),
  );
  console.log(`Recorded cassette for '${query}': ${ref.patternName} (${ref.permalink})`);
  return 0;
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes("--record")) {
  process.exit(await record());
}
