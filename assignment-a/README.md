# Assignment A — Knitting Assistant with Trustworthy Numbers (TypeScript)

Deterministic, tested knitting calculators plus a natural-language assistant that
**never invents a number**, with a command-line interface, in **TypeScript**.

The calculators are the **single source of truth for every number** the assistant
reports. They have **no runtime dependencies** and need **no API key**. The
assistant uses an LLM only to *understand* the question and *phrase* the answer —
and any phrasing is verified against the computed numbers before it is shown.
With no key set, it runs fully offline via a rule-based parser.

## What's here

```
assignment-a/
├── src/
│   ├── data.ts       # domain constants: yarn weights, needle table, factors
│   ├── yarn.ts       # yarn quantity calculator
│   ├── needles.ts    # needle size recommender
│   ├── tension.ts    # gauge / tension troubleshooter
│   ├── parse.ts      # keyless rule-based question parser (offline fallback)
│   ├── llm.ts        # LLM clients: offline / Anthropic / OpenAI (via fetch)
│   ├── env.ts        # .env loader + provider selection
│   ├── assistant.ts  # understand -> compute -> verify -> phrase / decline
│   ├── eval/         # evaluation harness: dataset (20 Qs) + runner + report
│   ├── index.ts      # public exports
│   └── cli.ts        # command-line interface
├── test/
│   ├── calculators.test.ts   # 23 tests
│   ├── assistant.test.ts     # 10 tests (offline, keyless)
│   └── eval.test.ts          # 2 tests — locks the eval to 100% offline
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

## The AI assistant (`ask`)

Ask a natural-language question. The assistant:

1. **Understands** — an LLM (or the keyless offline parser) extracts the intent
   and parameters.
2. **Computes** — the matching calculator produces the numbers. If inputs are
   missing or the question is out of scope, it **declines** — it never guesses.
3. **Phrases** — a deterministic template gives the canonical answer. If a real
   LLM is configured it may rephrase it, but only if **every computed number
   survives verification**; otherwise the trusted template is kept. Either way,
   the numbers you see are the code's.

```bash
npm run cli -- ask "How much DK yarn do I need for a 50 x 60cm blanket in stockinette?"
# For a 50 x 60 cm stockinette piece in Light (DK) yarn, you need about 600 m of
# yarn (~660 m with a 10% safety margin), which is about 6 ball(s) at ~120 m per ball.

npm run cli -- ask "My swatch is 24 stitches per 10cm but the pattern says 22. What's wrong?"
# You are knitting too tight (24 vs target 22 sts/10cm, minor). Left unchanged the
# piece would be about 8.3% smaller than intended. Fix: go up ~1 mm in needle size.

npm run cli -- ask "What colour of yarn should I choose?"   # out of scope -> declines
# I can help with yarn quantities, needle sizes, and gauge/tension problems...
```

Add `--json` to see full provenance — intent, extracted params, the raw
calculator result (numbers **and** the assumptions used), which provider phrased
it, and whether the numbers were verified. `--offline` forces the keyless parser.

### Choosing a provider (optional — it works with no key)

With **no key**, `ask` uses the offline parser — deterministic, free, and what the
tests run against. To use an LLM for understanding + phrasing, copy `.env.example`
to `.env` (at the repo root) and set **either**:

```bash
ANTHROPIC_API_KEY=...     # uses Claude Haiku (default model)
# or
OPENAI_API_KEY=...        # uses gpt-4o-mini
```

Selection: `ANTHROPIC_API_KEY` wins if both are set; override with
`KNIT_LLM_PROVIDER=anthropic|openai|offline` and `KNIT_LLM_MODEL=<model>`. If the
LLM call fails or times out, extraction falls back to the offline parser, so the
assistant degrades gracefully rather than breaking.

## Evaluation (`npm run eval`)

An end-to-end quality harness over a dataset of **20 realistic questions** (in
`src/eval/dataset.ts`). For each it reports the three things that matter:

- **routing** — was the right calculator used (or did it correctly decline)?
- **numbers** — do the numbers in the answer match an **independent** calculation?
  (The dataset computes the reference by calling the calculators directly, so the
  eval checks the assistant against the calculators, not against itself.)
- **ms** — response time, with min/avg/max across the run.

It runs **offline (keyless) by default** and exits non-zero if anything fails.

```bash
npm run eval
```
```
  #  expected  routing  numbers   ms   question
   1  yarn       ✓      ✓       1  How much DK yarn do I need for a 50 x 60cm blanke...
  ...
  20  decline    ✓      –       0  Who invented knitting?

  Summary
    Routing accuracy   20/20 (100%)
    Number accuracy    16/16 answered (100%)
    Declined correctly 4/4
    Latency            avg 0.2ms · min 0ms · max 1ms
    PASS — all cases correct
```

The dataset covers all three calculators with varied phrasing/units, an on-gauge
case, and four **must-decline** cases (out-of-scope and missing inputs) — so the
eval measures that the assistant *refuses to guess*, not just that it answers.
Add `--json` for a machine-readable report, or `--live` to run the same dataset
through the configured LLM (shows real latency and that accuracy holds with a
model in the loop).

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
Test Files  3 passed (3)
     Tests  35 passed (35)
```

The calculator tests lock the reference figures (e.g. the 50×60 cm DK blanket =
600 m / 6 balls) and the relationships that must hold (cable > stockinette > lace;
finer yarn needs more metres; firm needle < drapey needle; too-tight goes up,
too-loose goes down), plus clean errors on bad input. The assistant tests (keyless,
offline) cover the three example questions end-to-end and the decline paths
(out-of-scope, and missing required inputs).
