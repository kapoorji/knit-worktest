# Assignment A — Knitting Calculators (Part 1: calculators + CLI)

Deterministic, tested knitting calculators with a command-line interface, in **TypeScript**.

These calculators are the **single source of truth for every number** the AI
assistant will report. They have **no runtime dependencies** and need **no API
key** — they run fully offline. The natural-language assistant and evaluation
script build on top of this module (added in later steps).

## What's here

```
assignment-a/
├── src/
│   ├── data.ts       # domain constants: yarn weights, needle table, factors
│   ├── yarn.ts       # yarn quantity calculator
│   ├── needles.ts    # needle size recommender
│   ├── tension.ts    # gauge / tension troubleshooter
│   ├── index.ts      # public exports
│   └── cli.ts        # command-line interface
├── test/
│   └── calculators.test.ts   # Vitest unit tests (23 tests)
├── assumptions.md    # domain research, constants and sources
├── package.json
├── tsconfig.json
└── README.md         # this file
```

The three calculators:

| Calculator | Inputs | Returns |
|---|---|---|
| **Yarn quantity** | width, height, yarn weight, stitch pattern, optional gauge | metres, metres + safety margin, number of balls |
| **Needle recommender** | yarn weight, project type, desired fabric (firm/balanced/drapey) | metric mm + US + UK size |
| **Tension troubleshooter** | target gauge, actual gauge (sts/10cm) | too tight / loose, severity, size impact, needle-change fix |

See [assumptions.md](assumptions.md) for the domain constants, the formulas, and
sources (primarily the Craft Yarn Council Standard Yarn Weight System).

## Setup

Requires **Node 18+** (developed on Node 20 — see `.nvmrc`). No API key needed.

```bash
cd assignment-a
npm install          # dev tooling only: typescript, tsx, vitest
```

Scripts:

| Command | Does |
|---|---|
| `npm run cli -- <args>` | run the CLI (via tsx, no build step) |
| `npm test` | run the unit tests |
| `npm run typecheck` | strict `tsc --noEmit` type check |

## CLI usage

Three subcommands: `yarn`, `needle`, `tension`. Everything after `--` is passed
to the CLI. Add `--json` to any subcommand for the full structured result
(numbers **plus the assumptions used**) — exactly what the assistant consumes.

### Yarn quantity

```bash
npm run cli -- yarn --width 50 --height 60 --weight dk --stitch stockinette
```
```
For a 50 x 60 cm stockinette piece in Light (DK) yarn, you need about 600 m of
yarn (~660 m with a 10% safety margin), which is about 6 ball(s) at ~120 m per ball.
```

Options: `--stitch` (stockinette, garter, rib, seed, moss, cable, lace),
`--gauge` (your sts/10cm, optional), `--metres-per-ball` (override the default
for your exact yarn), `--safety` (margin, default `0.10`).

### Needle recommender

```bash
npm run cli -- needle --weight worsted --project scarf --fabric drapey
```
```
For Medium (Worsted/Aran) yarn with a drapey fabric, use about 5.5 mm needles
(US 9 / UK 5).
```

`--fabric` is one of `firm`, `balanced` (default), `drapey`. `--project` is
advisory (adds a note, e.g. socks are often worked firmer).

### Tension troubleshooter

```bash
npm run cli -- tension --target 22 --actual 24
```
```
You are knitting too tight (24 vs target 22 sts/10cm, minor). Left unchanged the
piece would be about 8.3% smaller than intended. Fix: go up ~1 mm in needle size.
```

### JSON output (what the assistant consumes)

```bash
npm run cli -- yarn --width 50 --height 60 --weight worsted --stitch cable --json
```
```json
{
  "metres": 585,
  "metresWithSafety": 644,
  "balls": 8,
  "metresPerBall": 90,
  "inputs": { "widthCm": 50, "heightCm": 60, "weight": "medium",
              "weightLabel": "Medium (Worsted/Aran)", "stitch": "cable",
              "gaugeStsPer10cm": null, "safety": 0.1 },
  "assumptions": { "metresPerCm2": 0.15, "stitchFactor": 1.3,
                   "gaugeFactor": 1, "typicalGaugeStsPer10cm": 18 }
}
```

### When it can't answer

Bad or unknown inputs don't guess — they explain and exit non-zero (exit code
`2`). This mirrors the assistant's "say so rather than guess" rule.

```bash
npm run cli -- yarn --width 0 --height 60 --weight dk
# Cannot compute: Dimensions must be positive.

npm run cli -- needle --weight "spider silk"
# Cannot compute: Unknown yarn weight: 'spider silk'. Known weights: Bulky, Fine, ...
```

## Using the calculators as a library

```ts
import { estimateYarn, recommendNeedle, diagnoseTension } from "./src/index.js";

const est = estimateYarn(50, 60, "dk", { stitch: "stockinette" });
console.log(est.metres, est.balls); // 600 6
console.log(est);                   // full numbers + assumptions

const rec = recommendNeedle("worsted", { fabric: "balanced" });
console.log(rec.metricMm, rec.us, rec.uk); // 5 8 6

const diag = diagnoseTension(22, 24);
console.log(diag.problem, diag.needleChangeMm); // too_tight 1
```

Invalid inputs throw a typed `CalcError` you can catch to decline cleanly.

## Running the tests

```bash
npm test
```
```
Test Files  1 passed (1)
     Tests  23 passed (23)
```

The tests lock the reference calculations (e.g. the 50×60 cm DK blanket = 600 m /
6 balls), the monotonic relationships (cable > stockinette > lace; finer yarn
needs more metres; firm needle < drapey needle; too-tight goes up, too-loose goes
down), and that invalid inputs throw cleanly.
