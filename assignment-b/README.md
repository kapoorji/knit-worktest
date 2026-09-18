# Assignment B — AI-Generated Knit Swatch Preview (TypeScript)

Generates a photorealistic close-up of a 10×10 cm knit swatch from **structured
input only** (stitch + colour + weight + fibre), where **cable looks structurally
different from rib/stockinette** and the **colour matches the given hex**.

Runs **fully offline with no API key** (a procedural mock generator + a recorded
Ravelry cassette). Real generation (gpt-image-1) and live Ravelry switch on when
keys are present.

## Quick start

```bash
cd assignment-b
npm install
npm run demo          # offline; writes output/index.html — open it in a browser
```

Then open `output/index.html`. Every required behaviour is rendered inline:
caching (MISS→HIT), stitch-structure variation, colour switching with timings,
the forced-failure fallback, the Ravelry comparison, ΔE2000 colour accuracy, and
the "one swatch, three ways" product figure.

| Command | Does |
|---|---|
| `npm run demo` | offline demo (mock generator + Ravelry cassette) → `output/index.html` |
| `npm run demo -- --live` | real gpt-image-1 + live Ravelry (needs keys in `.env`) |
| `npm run record-ravelry` | capture a real Ravelry response into the cassette (needs keys) |
| `npm test` | 13 unit tests (keyless) |
| `npm run typecheck` | strict `tsc --noEmit` |

## The core idea — hybrid: native for trust, tint for speed

Exact hex is unreliable from any image model, and per-colour generation is slow.
So:

- Generate **one neutral-grey structure per stitch** (cached), then **tint to any
  hex in code** (OKLab) — exact hue/chroma, milliseconds, no API call. This powers
  instant colour switching, custom colours, and the loading placeholder.
- For the trust-critical **preset** colours (what a knitter buys on), generate
  **natively** and cache them — full fidelity *and* instant on tap (cache hit).

The demo shows native vs tint side by side with **ΔE2000 + latency**, honestly:
tint nails hue/chroma and speed; native adds sheen the tint can't.

## How the trust claim is proved, not asserted

Colour is applied **in code**, so "the colour matches the hex" is measurable:
- The tint keeps the target hex's hue + chroma exactly and modulates only
  lightness (for relief), centred so the swatch **mean equals the hex**.
- The demo prints **ΔE2000** between the input hex and the swatch's mean colour
  for every swatch — typically **< 2** (below the ~2.3 just-noticeable threshold).

## Modules (`src/`)

| File | Role |
|---|---|
| `schema.ts` | typed `SwatchInput`, normalisation (hex expand, enum validate) |
| `prompt.ts` | structure-first prompt per stitch + `PROMPT_VERSION` |
| `mock.ts` | procedural SVG geometry per stitch (distinct, keyless) |
| `generator.ts` | base-structure generator: mock + gpt-image-1 (`fetch`), cache-gated |
| `cache.ts` | **two keys** — structure (no colour, gates the API) + preview; atomic writes |
| `colour.ts` | sRGB↔OKLab↔Lab, ΔE2000 (no deps) |
| `tint.ts` | OKLab luminance-preserving tint to a hex, with ΔE measurement |
| `fallback.ts` | transient hex placeholder (never cached) |
| `ravelry.ts` | real search + cassette replay + live + `--record` |
| `contact-sheet.ts` | writes the self-contained `output/index.html` |
| `demo.ts` | orchestrates every required demo |

## Design decisions (matching the reviewed plan)

- **Two cache keys.** The structure key **excludes colour**, so all colours of a
  stitch share one generated base (the "~6 structures" economy). The colour-
  specific preview key is separate. Writes are atomic (temp + rename).
- **Fallback is transient** — a forced failure returns a hex placeholder and is
  **never** written to the cache (a cached fallback would poison later real calls).
- **Ravelry runs both real and keyless.** A recorded cassette is replayed offline
  (labelled), and the live API is hit when `RAVELRY_*` are set. A Ravelry hit is a
  finished garment, not a swatch, so the comparison is loose (as the brief allows).
  The committed cassette here is a **labelled SAMPLE placeholder** — run
  `npm run record-ravelry` (or `--live`) to capture a genuine response.
- **Mock draws real geometry**, so the offline output still visibly proves that
  cable ≠ rib ≠ stockinette without any API key.

## Keys (optional)

Copy `.env.example` (repo root) to `.env`. Assignment B uses `OPENAI_API_KEY`
(image generation) and `RAVELRY_USERNAME` / `RAVELRY_PASSWORD` (reference photos).
Nothing here needs a key to run the offline demo or the tests.

## Requirements coverage

Generate ✓ · structure-first prompt ✓ · cache with demonstrated MISS→HIT ✓ ·
graceful forced-failure fallback ✓ · colour-switch demo (timings) ✓ ·
stitch-variation demo (confusable pairs) ✓ · real Ravelry call + graceful
degradation ✓ · runs without keys ✓ · ΔE colour-accuracy evidence ✓.
