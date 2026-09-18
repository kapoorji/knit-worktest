/** Minimal .env loader (no dependency). Real environment wins. */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
let loaded = false;

export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  for (const path of [resolve(HERE, "../../.env"), resolve(HERE, "../.env")]) {
    try {
      for (const raw of readFileSync(path, "utf-8").split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const k = line.slice(0, eq).trim();
        let v = line.slice(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (k && process.env[k] === undefined) process.env[k] = v;
      }
    } catch {
      /* no file here */
    }
  }
}

export function env(key: string): string | null {
  loadEnv();
  const v = process.env[key];
  return v && v.trim() ? v.trim() : null;
}
