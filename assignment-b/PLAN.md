# Assignment B — AI-Generated Knit Swatch Preview — Detailed Plan (v2)

Status: **Revised after dual review** (senior product + senior developer) · 2026-09-18
Language: **TypeScript (Node 20) + `sharp`** · Lead path: **Hybrid**

Goal: a proof of concept that generates a photorealistic close-up of a 10×10 cm
knitted swatch from **structured input only** (stitch + colour, plus secondary
weight/fibre), where **cable visibly differs from rib/stockinette** and the
**colour matches the given hex** — fast enough for a "tap a colour, see it update"
interface.

---

## Revision log — what changed after review

Two decisions locked (were open in v1):
- **Language → Node + `sharp`** (repo consistency with the TypeScript Assignment
  A). We satisfy the "notebook" deliverable with a generated **HTML contact
  sheet**, and mirror A's conventions: offline-first, mock default, typed schema,
  provider-agnostic via `fetch`, `vitest`.
- **Lead path → Hybrid.** Native generation is the trust path for the **preset
  colours** (pre-generated, cached → full-fidelity *and* instant on tap); the
  **tint** path delivers instant switching for custom/intermediate colours and
  the immediate placeholder while a native image warms. Both shown side by side
  with **ΔE and latency numbers**.

Seven changes folded in from the reviews (▶ = which review):
1. **Split cache keys** — structure key excludes colour (gates the API); preview
   key adds hex. Fixes the v1 §1/§4 contradiction that would have made every
   colour a cache miss. ▶ dev
2. **Fallback is transient** — never written under the structure key, or one
   forced failure poisons the cache. ▶ dev
3. **Honest colour claim + measurement** — OKLab luminance-preserving tint (hue &
   chroma = hex exactly, lightness carries relief, mid-tone = hex), proven by
   printing **ΔE2000** between input hex and swatch mid-tone. ▶ dev
4. **Ravelry cassette** — record one real response to a committed fixture, replay
   offline (labelled), hit live when keys are set; print real URL + status; show
   provenance (pattern, permalink, query); note it's a garment not a swatch. Fixes
   the "real call" vs "runs keyless" conflict. ▶ both
5. **Harder structure proof** — demo a confusable pair (rib vs stockinette, seed
   vs garter), not three easy stitches; add an honest self-assessment; the **mock
   generator draws real distinct geometry** per stitch (SVG→raster). ▶ both
6. **Scope** — include cost-at-scale estimate; content-safety = one-paragraph note
   only; the gated warm-up **is** the batch-pregeneration bonus. ▶ both
7. **Model** — gpt-image-1 primary (structural adherence is the graded axis);
   client stays provider-agnostic so Flux is a one-line swap. ▶ both

---

## 0. Success criteria (brief's evaluation table)

| Evaluator asks | How this plan satisfies it |
|---|---|
| Does it work / real output | Runnable script → PNGs + an HTML contact sheet, inline |
| Stitch structure actually differs | Structure-first prompts; **confusable-pair** demo; mock draws real geometry |
| Colour matches the hex | Colour applied **in code** (OKLab tint) + **ΔE2000 printed** as proof |
| Fallbacks actually trigger | `forceFail` switch → hex placeholder (transient, not cached) |
| Caching is real | Identical input skips API — MISS→HIT on the **structure key**, with timings |
| Ravelry comparison is real | Real call recorded to a cassette, replayed offline, live when keyed; provenance shown |
| Latency thought-through | Hybrid (native presets pre-warmed + tint) → LATENCY_NOTE.md |

Out of scope (brief): backend/REST service, auth, DB, real app UI, multi-colour
(Fair Isle).

---

## 1. Architecture — hybrid: native presets, tint for speed

```
                         ┌─ preset colour ─▶ native generate (cached) ─▶ full-fidelity, instant on repeat
input {stitch, hex,      │
       weight, fibre} ───┤─ custom/next colour ─▶ tint(base_structure, hex) ─▶ instant, exact hue/chroma
                         │
                         └─ while native warms ─▶ hex placeholder shown immediately (progressive reveal)
```

- **Native path** (product/trust): the image a user buys on. Preset colours are
  pre-generated natively and cached, so they are both trustworthy *and* instant
  (cache hit). ~6 stitches × ~6 presets ≈ 36 images, one-time, well under $5.
- **Tint path** (speed): generate one **neutral base structure per stitch** once,
  then colorize to any hex in code — exact hue/chroma, milliseconds, no API call.
  Used for instant switching, custom colours, and the loading placeholder.
- We show native vs tint **side by side** with ΔE + latency, honestly: tint nails
  hue/chroma and speed; native adds sheen/behaviour the tint can't (white cotton,
  very dark/saturated hexes). This *is* the product argument.

---

## 2. Data flow / modules (TypeScript)

```
assignment-b/
├── src/
│   ├── schema.ts         # SwatchInput type, normalise(), validate()
│   ├── prompt.ts         # buildPrompt() + per-stitch structural clauses + PROMPT_VERSION
│   ├── generator.ts      # image client: mock (SVG→sharp) + real (gpt-image-1 via fetch);
│   │                     #   returns { image, source: 'mock'|'api'|'cache', fromCache }
│   ├── cache.ts          # structureKey()/previewKey(), atomic write, JSON sidecar
│   ├── colour.ts         # hex↔sRGB↔linear↔OKLab↔Lab, ΔE2000
│   ├── tint.ts           # OKLab luminance-preserving colorize to a hex
│   ├── fallback.ts       # transient hex placeholder (solid + simple stripes)
│   ├── ravelry.ts        # search + cassette replay + live; provenance
│   ├── safety.ts         # note-only stub (see §7)
│   ├── contact-sheet.ts  # writes output/index.html (the "notebook")
│   └── demo.ts           # orchestrates every required demo → output/
├── test/                 # vitest: tint ΔE, cache-key split, schema, fallback-not-cached
├── fixtures/ravelry/     # recorded cassette (request, status, JSON) + reference image
├── output/               # generated PNGs + index.html (gitignored) + a few committed samples
├── package.json / tsconfig.json
└── README.md
```

Run: `npm run demo` (offline by default) → writes `output/index.html`; open it to
see every demo. `npm run demo -- --live` uses real APIs when keys are set.

---

## 3. Prompt strategy (structure-first)

One template, **structural clause first** (from the brief's reference table), then
colour/weight/fibre as modifiers. `PROMPT_VERSION` is part of the cache key.

| Stitch | Structural clause |
|---|---|
| Stockinette | smooth uniform columns of V-shaped knit stitches in neat vertical rows |
| Garter | horizontal ridged bumps across the fabric, no V shapes, same every row |
| Rib (1×1/2×2) | alternating raised and recessed vertical columns, corrugated vertical ridges |
| Seed / Moss | all-over bumpy irregular checkerboard texture, no directional lines |
| Cable | twisted rope-like raised braids crossing a flatter background, strong 3D relief |
| Lace | regularly spaced open eyelet holes, airy delicate pattern |

Suffix: "extreme close-up, photorealistic hand-knitted wool swatch, even studio
lighting, flat, filling frame, no needles/hands/background." Fibre → sheen/fuzz;
weight → stitch scale. **Stitch + colour are primary.** For the tint base, the
prompt asks for **neutral mid-grey wool** so luminance cleanly carries relief.

---

## 4. Caching (two keys — the fix)

- **structureKey** = sha256(normalise{ stitch, weight, fibre, mode (`mock`|`real`),
  model, size, PROMPT_VERSION }) — **no colour.** This gates image generation, so
  all colours of one stitch share one base → the "~6 structures" economy holds.
- **previewKey** = sha256(structureKey + normalised hex) — optional cache of a
  tinted/native preview.
- **Normalisation**: lowercase, expand hex (`#FFF`→`#ffffff`), trim + enum-validate
  fields, sorted keys. Swapping model/provider or bumping PROMPT_VERSION correctly
  invalidates.
- **Store**: `cache/<key>.png` + `cache/<key>.json` (input, prompt, model,
  timestamp, latency). **Atomic**: write temp then rename (no half-written PNG).
- **Demo**: first call logs `MISS` + API latency; identical call logs `HIT` +
  ~0 ms, `fromCache=true` — shown on the **structure key**.

---

## 5. Failure handling (must trigger on purpose)

- `generator` wraps the call; a `forceFail`/bad-key switch triggers it
  deliberately. On any error it returns `fallback.placeholder(hex)` — a solid
  swatch in the exact hex with light stripes and a "preview unavailable" marker.
- **The placeholder is returned transiently and never written under the structure
  key** (else one failure poisons all later real calls).
- Short timeouts on image + Ravelry calls. A notebook cell triggers each fallback.

---

## 6. Colour correctness (the graded claim, measured)

- **Tint** = OKLab luminance-preserving colorize: take the base's luminance L;
  for each pixel set OKLab `(L', a, b)` where `a,b` come from the **target hex**
  (exact hue + chroma) and `L'` modulates around the hex's L to carry relief
  (clamped so near-black/near-white still show structure). Implemented over
  `sharp` raw pixel buffers (sharp has no `colorize`; `.tint()` is a multiply and
  is **not** used). `colour.ts` implements sRGB↔linear↔OKLab directly (small,
  tested) — no heavy dependency.
- **Honest claim**: *hue and chroma equal the hex exactly; lightness carries the
  knit relief; the mid-tone equals the hex.*
- **Proof**: print **ΔE2000** between the input hex and the swatch's mid-tone for
  every generated swatch — turns "matches" into a measured number the evaluator
  can see.
- **Known-hard zones** (documented + handled): near-black (clamp min L), white/
  cotton sheen (a matte tint can't fake specular → add a screen highlight pass or
  prefer native), high saturation (OKLab holds chroma where naive RGB fails).

---

## 7. Required demos (rendered to the HTML contact sheet)

1. **Colour switching** — one stitch, ≥3 hexes side by side via tint; print
   per-image ms; comment on how instant it feels vs native.
2. **Stitch variation** — includes a **confusable pair** (rib vs stockinette; seed
   vs garter) in one colour, side by side, + a one-line honest self-assessment of
   which pairs read as clearly distinct.
3. **Cache hit** — same input twice; MISS then HIT with timings (structure key).
4. **Fallback** — `forceFail` → hex placeholder shown.
5. **Ravelry** — real search by stitch keyword; show fetched photo + provenance
   (pattern name, permalink, query) beside our swatch; graceful no-match/timeout.
6. **The thesis figure** — one swatch three ways under a single caption: native
   (real latency printed), tint/warmed (near-zero printed), hex fallback — the
   trust + speed argument in one image.

---

## 8. Tech choices

| Concern | Choice | Notes |
|---|---|---|
| Language/runtime | **TypeScript, Node 20** | Matches Assignment A; `vitest`, typed schema |
| Image lib | **`sharp`** | Raster, compositing, SVG→raster for the mock; raw buffers for tint |
| Display | **Generated HTML contact sheet** (`output/index.html`) | The "notebook" stand-in; opens in any browser |
| Image model | **gpt-image-1** (via `fetch`) | Structural adherence; provider-agnostic, Flux = 1-line swap |
| Tint | **OKLab colorize over raw pixels** | Exact hue/chroma; ΔE2000-verified |
| Cache | Filesystem PNG + JSON sidecar, atomic write, 2 keys | Inspectable, demonstrable |
| Ravelry | REST (HTTP Basic, free dev key), **cassette** replay | `GET /patterns/search.json?query=<stitch>` → `first_photo` |
| Secrets | `.env` + `.env.example`, mock default | Runs with no keys |
| Cost | Real published pricing × ~2,000 previews/day | Shows caching/warming collapses it |
| Safety | **One-paragraph note only** | Inputs are structured enums → little to moderate |

---

## 9. Runs-without-keys (ground rule)

- **Mock generator** builds a **structurally distinct SVG per stitch** (V-columns,
  horizontal ridges, vertical corrugation, rope crossings, eyelets) and rasterises
  via `sharp`, so the whole pipeline — prompts, cache, tint, ΔE, fallback, demos,
  contact sheet — runs and renders **with no API key**, and the offline output
  still visibly shows structure differing.
- **Ravelry cassette** replays a recorded real response offline (labelled), prints
  the real endpoint + HTTP status, and hits live when `RAVELRY_*` is set.
- A handful of **real pre-rendered PNGs** are committed so a reviewer sees genuine
  model output without keys. Real generation runs in one **gated** batch (§10.7).

---

## 10. Build order (~4–6h)

1. Scaffold `assignment-b/` (TS, `sharp`), `schema.ts`, `.env`, mock generator
   (SVG geometry per stitch). (~50m)
2. `prompt.ts` + structural clauses + PROMPT_VERSION. (~30m)
3. `cache.ts` (two keys, atomic write, MISS/HIT demo). (~40m)
4. `colour.ts` (OKLab + ΔE2000) + `tint.ts` + `fallback.ts` (transient). (~60m)
5. `contact-sheet.ts` + `demo.ts`: colour-switch, stitch-variation (confusable
   pair), cache-hit, fallback, thesis figure (mock first). (~50m)
6. `ravelry.ts` + cassette record/replay + provenance. (~40m)
7. **Gated real-API batch**: native presets + base structures + a couple of
   comparison images. (~30m)
8. LATENCY_NOTE.md, cost estimate, safety paragraph, README. (~40m)

Priority if short: requirements 1–7 core + LATENCY_NOTE; cut cost/safety extras
last and say so. Bonuses (greyscale-tint comparison, batch warm framing) largely
fall out of the hybrid build for free.

---

## 11. Top risks

- **R1 Stitch realism / mock geometry** — if native cable underwhelms or the mock
  looks like noise, "structure differs" fails. Mitigation: structure-first
  prompts; real SVG geometry in the mock; confusable-pair demo; gpt-image-1.
- **R2 Tint fidelity on hard hexes** — near-white sheen, near-black, saturated.
  Mitigation: OKLab + clamped L + screen highlight; ΔE printed; native path for
  presets; documented limits.
- **R3 sharp tint math** — no built-in colorize; must be correct over raw buffers.
  Mitigation: `colour.ts` unit-tested (round-trips + ΔE on known values).
- **R4 Ravelry real-vs-keyless** — mitigated by the cassette (§9); print real
  URL/status; honest "garment not swatch" note.
- **R5 Cost/latency at go-live** — covered in LATENCY_NOTE + cost estimate;
  preset pre-warming is the answer.

---

## 12. LATENCY_NOTE outline (so it stays concrete)

- Separate the two interactions: **first view** of a swatch costs a multi-second
  native generation → answer is **pre-warming the known presets** (batch, cached).
  **Switching among known/preset colours** is instant → cache hit or tint.
- Progressive reveal: show the **hex placeholder immediately**, swap in the real
  image when ready (the fallback asset earns double duty).
- Faster-tier model / smaller size for the warm; tint for arbitrary custom colours.
- Numbers: native latency vs tint/cache latency measured in the demo, cited here.
```
