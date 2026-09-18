# Knit App — Work Test

Two small, working proofs of concept for a mobile app for knitters, plus the
leadership write-ups. Both are **TypeScript**, both run **fully offline with no
API key**, and both put the same principle first: the AI understands and phrases,
but **deterministic code owns every number and pixel a knitter trusts**.

| Assignment | What it is | Details |
|---|---|---|
| **A — Trustworthy assistant** | Answers knitting questions (yarn quantity, needle size, tension) where every number comes from tested calculators, never the model. Declines rather than guessing. | **→ [`assignment-a/README.md`](assignment-a/README.md)** |
| **B — Swatch preview** | Generates a photorealistic knit swatch from structured input (stitch + colour); cable looks structurally different from rib, colour matches the hex (measured). | **→ [`assignment-b/README.md`](assignment-b/README.md)** |

## Repository layout

```
knit-worktest/
├── assignment-a/        # AI assistant, calculators, tests, eval script  → assignment-a/README.md
├── assignment-b/        # swatch preview + demo (HTML contact sheet)     → assignment-b/README.md
├── DECISIONS.md         # technical + product rationale (both assignments)
├── PLAN.md              # overall plan & tool decisions
├── LATENCY_NOTE.md      # (todo) making the swatch preview feel instant
├── DELIVERY_PLAN.md     # (todo) 6-week MVP plan (1 FE + 1 BE)
├── .env.example         # API key placeholders — copy to .env; no keys needed to run offline
└── README.md            # this file
```

## Quick start

Both assignments use **Node 18+** (developed on Node 20; see each `.nvmrc`) and
need no API key to run.

**Assignment A** — calculators, CLI, and the natural-language assistant:
```bash
cd assignment-a
npm install
npm test                                   # 35 tests
npm run cli -- ask "How much DK yarn for a 50x60cm blanket in stockinette?"
npm run eval                               # 20-question evaluation, offline
```
Full usage: **[`assignment-a/README.md`](assignment-a/README.md)**.

**Assignment B** — swatch preview demo:
```bash
cd assignment-b
npm install
npm run demo                               # writes output/index.html — open in a browser
npm test                                   # 13 tests
```
Full usage: **[`assignment-b/README.md`](assignment-b/README.md)**.

## Configuration (optional — everything runs without keys)

Copy [`.env.example`](.env.example) to `.env` and fill in only what you want to
exercise live:

| Variable | Used by | For |
|---|---|---|
| `ANTHROPIC_API_KEY` *(or `OPENAI_API_KEY`)* | Assignment A | LLM understanding + phrasing (numbers still come from code) |
| `OPENAI_API_KEY` | Assignment B | real `gpt-image-1` generation (`npm run demo -- --live`) |
| `RAVELRY_USERNAME` / `RAVELRY_PASSWORD` | Assignment B | live Ravelry reference photos (`npm run record-ravelry`) |

With no keys, Assignment A uses a rule-based offline parser and Assignment B uses
a procedural mock generator + a recorded Ravelry cassette — so the reviewer can
run and test everything for free.

## Architecture & decisions

- **Rationale (tech + product, and why):** [`DECISIONS.md`](DECISIONS.md)
- **Plan & tool choices:** [`PLAN.md`](PLAN.md)
- **Domain assumptions & sources:** [`assignment-a/assumptions.md`](assignment-a/assumptions.md)

## Status

- Assignment A — complete (calculators, assistant, eval; 35 tests).
- Assignment B — complete offline (demo, tint, cache, fallback, Ravelry cassette;
  13 tests). Live `gpt-image-1` batch and a real Ravelry capture run once keys are
  added.
- Leadership docs — `DECISIONS.md` done; `LATENCY_NOTE.md` and `DELIVERY_PLAN.md`
  to follow.
