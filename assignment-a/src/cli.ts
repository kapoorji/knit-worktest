#!/usr/bin/env -S npx tsx
/**
 * Command-line interface for the knitting calculators.
 *
 * Runs via tsx (no build step). No API key, no network.
 *
 * Examples
 * --------
 *   npm run cli -- yarn --width 50 --height 60 --weight dk --stitch stockinette
 *   npm run cli -- needle --weight worsted --project scarf --fabric drapey
 *   npm run cli -- tension --target 22 --actual 24
 *   npm run cli -- yarn --width 50 --height 60 --weight dk --json
 *
 * Add --json to any subcommand for the full structured result (numbers plus the
 * assumptions used), which is what the AI assistant consumes.
 */

import { parseArgs, type ParseArgsConfig } from "node:util";
import { estimateYarn, formatYarn } from "./yarn.js";
import { recommendNeedle, formatNeedle } from "./needles.js";
import { diagnoseTension, formatTension } from "./tension.js";
import { CalcError } from "./data.js";

const USAGE = `knit-calc — deterministic knitting calculators

Usage:
  yarn     --width <cm> --height <cm> --weight <name> [--stitch <s>] [--gauge <n>]
           [--metres-per-ball <n>] [--safety <f>] [--json]
  needle   --weight <name> [--project <type>] [--fabric firm|balanced|drapey] [--json]
  tension  --target <sts/10cm> --actual <sts/10cm> [--json]

Weights: lace, super_fine (sock/fingering), fine (sport), light/dk, medium/worsted,
         bulky, super_bulky, jumbo — or a CYC number 0-7.
Stitches: stockinette, garter, rib, seed, moss, cable, lace.`;

function num(value: string | undefined, flag: string): number {
  if (value === undefined) throw new CalcError(`Missing required option ${flag}.`);
  const n = Number(value);
  if (Number.isNaN(n)) throw new CalcError(`Option ${flag} must be a number, got '${value}'.`);
  return n;
}

function optNum(value: string | undefined, flag: string): number | null {
  if (value === undefined) return null;
  return num(value, flag);
}

function run(argv: string[]): number {
  const [command, ...rest] = argv;

  if (!command || command === "-h" || command === "--help") {
    console.log(USAGE);
    return command ? 0 : 1;
  }

  const configs: Record<string, ParseArgsConfig["options"]> = {
    yarn: {
      width: { type: "string" },
      height: { type: "string" },
      weight: { type: "string" },
      stitch: { type: "string" },
      gauge: { type: "string" },
      "metres-per-ball": { type: "string" },
      safety: { type: "string" },
      json: { type: "boolean" },
    },
    needle: {
      weight: { type: "string" },
      project: { type: "string" },
      fabric: { type: "string" },
      json: { type: "boolean" },
    },
    tension: {
      target: { type: "string" },
      actual: { type: "string" },
      json: { type: "boolean" },
    },
  };

  const options = configs[command];
  if (!options) {
    console.error(`Unknown command '${command}'.\n\n${USAGE}`);
    return 2;
  }

  const { values } = parseArgs({ args: rest, options, allowPositionals: false });
  const asJson = Boolean(values.json);

  const emit = (result: unknown, human: string): number => {
    console.log(asJson ? JSON.stringify(result, null, 2) : human);
    return 0;
  };

  switch (command) {
    case "yarn": {
      const r = estimateYarn(num(values.width as string, "--width"), num(values.height as string, "--height"), (values.weight as string) ?? "", {
        stitch: (values.stitch as string) ?? "stockinette",
        gaugeStsPer10cm: optNum(values.gauge as string, "--gauge"),
        metresPerBall: optNum(values["metres-per-ball"] as string, "--metres-per-ball"),
        safety: (values.safety as string) !== undefined ? num(values.safety as string, "--safety") : 0.1,
      });
      return emit(r, formatYarn(r));
    }
    case "needle": {
      const r = recommendNeedle((values.weight as string) ?? "", {
        projectType: (values.project as string) ?? null,
        fabric: (values.fabric as string) ?? "balanced",
      });
      return emit(r, formatNeedle(r));
    }
    case "tension": {
      const r = diagnoseTension(num(values.target as string, "--target"), num(values.actual as string, "--actual"));
      return emit(r, formatTension(r));
    }
    default:
      console.error(USAGE);
      return 2;
  }
}

function main(): number {
  try {
    return run(process.argv.slice(2));
  } catch (err) {
    if (err instanceof CalcError) {
      // Calculators throw CalcError on inputs they cannot handle. Surface it
      // plainly instead of crashing — mirroring the assistant's "say so" rule.
      console.error(`Cannot compute: ${err.message}`);
      return 2;
    }
    // Unknown-option / parse errors from parseArgs land here.
    console.error(`Error: ${(err as Error).message}`);
    return 2;
  }
}

process.exit(main());
