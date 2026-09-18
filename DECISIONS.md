# DECISIONS — technical & product rationale

This document explains **what we chose, why, and the trade-offs** across both
assignments. It is written to be read alongside the code; each claim points at
the file that implements it. Two product values from the brief drive nearly every
decision:

- **Trust.** Knitters buy real yarn based on the app's numbers and images, and the
  community is sceptical of AI. Wrong or invented output damages the product fast.
- **Speed / flow.** The app is a calm, uninterrupted experience. Janky or slow
  interactions break it.

Almost every decision below is a direct expression of one of these two.

---

## 0. Cross-cutting principles (both assignments)

| Principle | Why | Where |
|---|---|---|
| **Offline-first / keyless** | A reviewer must run everything without our keys (brief ground rule), and it lets us develop and test at zero cost. | A: rule-based parser; B: mock generator + Ravelry cassette |
| **Deterministic core** | Trust requires reproducibility — the same input must give the same answer, testably. | A: pure calculators; B: procedural mock, fixed colour math |
| **Typed + tested** | Catches whole classes of error before a user sees them; `strict` TS + unit tests. | 35 tests (A), 13 tests (B), `tsc --noEmit` clean |
| **Provider-agnostic via `fetch`** | Avoids SDK lock-in and heavy deps; swapping LLM/image provider is a small, isolated change. | A: Anthropic/OpenAI clients; B: gpt-image-1 client |
| **Cost-gated** | Real paid calls only happen deliberately, after the offline path is proven. | Both mock by default; `--live` opt-in |

### Language: TypeScript for both
Assignment A is a calculation + orchestration problem where **static types are a
trust asset** — the numeric contracts are checked at compile time. Assignment B's
language was genuinely open (Python+Pillow is image-ergonomic); we chose
**TypeScript + `sharp`** for **repo consistency** — one toolchain, one test runner,
one set of conventions across the submission — after weighing it in the dual
review. The only thing Python would have bought (inline notebook images) we
replaced with a **generated HTML contact sheet**, so nothing was lost.

---

## 1. Assignment A — trustworthy AI assistant

### 1.1 The central decision: the LLM never produces a number
Pipeline (`src/assistant.ts`): **understand → compute → verify → phrase / decline.**

- An LLM (or a keyless rule-based parser) does *only* natural-language →
  `{intent, params}` extraction.
- A **deterministic calculator** produces every number.
- The answer is a template filled from the computed numbers. If a live LLM
  rephrases it, the rephrasing is **shown only if every computed number survives
  verification** (`containsNumber`); otherwise we keep the trusted template.
- If the intent is unknown or inputs are missing, the assistant **declines** — it
  never guesses.

**Why:** this is exactly what the brief grades ("numbers come from your code, not
the model, and the assistant says so when it can't"). By construction, the number
in the reply is the number the code computed — not a hope that the model did the
arithmetic. The verification step means we get the LLM's friendly phrasing without
surrendering the trust guarantee.

**Trade-off:** occasionally the template is shown instead of a livelier LLM
sentence (when verification rejects a rephrase). We accept a slightly plainer
answer over any risk of a wrong number. That is the correct bias for this product.

### 1.2 LLM provider: Claude Haiku default, provider-agnostic, keyless fallback
- Default **Anthropic Claude Haiku** — cheap, strong at structured extraction; the
  model's job here is narrow so a small fast model suffices.
- **Provider-agnostic**: `OPENAI_API_KEY` selects gpt-4o-mini instead; forced via
  `KNIT_LLM_PROVIDER`. No SDK — direct `fetch`, and extraction **falls back to the
  offline parser on any API error** (resilience the brief asks for).
- **Offline rule-based parser** (`src/parse.ts`) means tests and the eval run with
  no key and no cost.

**Why:** the provider is a swappable detail, not the product. The offline parser is
what makes the whole thing runnable and testable for free, and doubles as the
graceful-degradation path if the LLM is down.

### 1.3 Calculators are the single source of truth
Three deterministic functions (`src/yarn.ts`, `needles.ts`, `tension.ts`), pure,
no dependencies, driven by constants in one editable file (`src/data.ts`).

**How numeric accuracy is guaranteed:**
1. All numbers originate here, from documented constants (Craft Yarn Council
   standard) — see `assignment-a/assumptions.md` for sources and confidence.
2. Unit tests lock reference figures (50×60 cm DK blanket = 600 m / 6 balls) and
   the relationships that must hold (cable > stockinette > lace; finer yarn needs
   more metres; firm needle < drapey; too-tight → up, too-loose → down).
3. Invalid input raises a typed `CalcError` → the assistant declines, never coerces
   a nonsense answer.

**Domain assumptions (explicit, easy to change):** yarn quantity is
`area × metres_per_cm² × stitch_factor × gauge_factor`. Gauge/needle ranges are
high-confidence (CYC). `metres_per_cm²` is the main modelling approximation
(calibrated so a worsted blanket lands at realistic yardage) and is the number
most worth refining with real sales data. A 10% safety margin is added before
rounding balls **up**, because running out of a dye lot mid-project is a real,
costly failure — a product-trust decision baked into the maths.

### 1.4 Evaluation harness with an independent oracle
`src/eval/` runs 20 realistic questions and reports **routing / number-match /
latency** (100% offline). The dataset computes each expected answer by calling the
calculators **directly**, so the eval checks the assistant against an *independent*
computation, not against itself. Four cases **must decline** (out-of-scope +
missing inputs), so "refuses to guess" is measured, not assumed.

**Why:** "real metrics" is graded. An oracle that is independent of the code under
test is the difference between evidence and circular self-congratulation.

---

## 2. Assignment B — AI swatch preview

### 2.1 The central decision: hybrid (native for trust, tint for speed)
Exact hex is unreliable from any image model, and native per-colour generation is
several seconds each — the brief's stated tension. Options considered:

| Option | Trust | Speed | Cost | Verdict |
|---|---|---|---|---|
| Native per colour only | high fidelity | seconds per tap | per-colour spend | Fails the flow value |
| Tint only (structure once, colour in code) | tinted grey misfires on white cotton/navy/saturated | instant | ~6 images total | Fails the trust value on common yarns |
| **Hybrid (chosen)** | native for presets | tint for switching/custom | cheap | Serves both |

**Chosen (after dual review):** generate **one neutral-grey structure per stitch**
(cached) and **tint to any hex in code** for instant switching, custom colours, and
the loading placeholder; generate the **preset colours natively** (the images a
knitter actually buys on) and cache them, so those are full-fidelity *and* instant
on tap. The demo shows native vs tint side by side with **ΔE + latency**, honestly.

**Why:** the product reviewer's key point — a tinted approximation is a *trust*
liability for a purchase decision — is real; the developer reviewer's point — tint
is the correct latency lever — is also real. The hybrid is the only option that
doesn't sacrifice one value for the other.

### 2.2 Colour applied in code, and *measured*
`src/tint.ts` works in **OKLab**: it keeps the target hex's `a,b` (hue + chroma)
**exactly** and modulates only lightness for relief, centred on the base's mean so
the **swatch mean equals the hex**. We print **ΔE2000** between the input hex and
the swatch mean for every swatch — all currently **≤ 2**, below the ~2.3
just-noticeable-difference threshold.

**Why OKLab, not `sharp.tint()` or naive multiply:** a multiply desaturates
shadows/highlights and drifts hue; OKLab holds hue+chroma constant while lightness
carries the 3-D relief. **Why measured:** "colour matches the hex" is graded — a
printed ΔE turns a claim into evidence.

**Honest limitation:** a matte grey base can't fake specular sheen (white cotton),
so for those the **native path** is the answer; the tint's sheen gap is documented,
not hidden. Near-black/near-white are handled by clamping lightness so relief
survives.

### 2.3 Two cache keys (the structure key excludes colour)
`src/cache.ts`: `structureKey` = hash of `{stitch, weight, fibre, mode, model,
size, promptVersion}` — **no colour** — and this is what gates generation, so all
colours of a stitch share one base (the "~6 structures ever generated" economy).
`previewKey` = `structureKey + hex` for optional preview caching. Writes are
atomic (temp + rename).

**Why:** putting colour in the key (the v1 mistake the developer review caught)
would make every colour a cache miss and destroy the entire latency insight.

### 2.4 Fallback is transient and never cached
`generator.getStructure` throws `GenerationError` on failure (including a
deliberate `forceFail` switch); the caller returns a solid-hex placeholder
**transiently**. It is **never written under the structure key**.

**Why:** a cached fallback would poison every later real call for that input — one
transient outage becomes a permanent wrong image. Caught in review.

### 2.5 Mock generator draws real geometry
`src/mock.ts` builds a **structurally distinct SVG per stitch** (V-columns,
horizontal ridges, vertical corrugation, rope crossings, eyelets), rasterised by
`sharp`. Verified in-browser: cable ≠ rib ≠ stockinette with **no API key**.

**Why:** the offline demo is what a keyless reviewer sees. If the mock were seeded
noise, "structure actually differs" would visibly fail offline — the single
requirement most likely to be failed as planned.

### 2.6 Ravelry: real call *and* keyless-runnable
`src/ravelry.ts` hits the live API (HTTP Basic, 5s timeout, graceful no-match) when
`RAVELRY_*` are set, and otherwise **replays a recorded cassette** offline. Shows
provenance (pattern name, permalink, query, status). A Ravelry hit is a finished
garment, not a swatch, so the comparison is explicitly loose (brief allows).

**Why:** the "real call" requirement and the "runs keyless" ground rule conflict;
the cassette satisfies both. (The committed cassette is a labelled **SAMPLE** until
captured live with `npm run record-ravelry`.)

### 2.7 Image model: gpt-image-1
Primary because **structural instruction-following** ("cable = twisted rope braids
over a flatter background") is the make-or-break graded axis, and that is
gpt-image-1's strength over raw-texture-prettier models. The client is
provider-agnostic, so Flux is a one-line swap for a texture comparison. With only
~6 base structures, total spend is well under $1 — cost is not the deciding factor,
structural fidelity is.

---

## 3. Product decisions (explicitly)

- **Trust over polish, everywhere.** A/1.1 (verified numbers or a template),
  A/1.3 (safety margin, decline on bad input), B/2.1 (native for purchase-decision
  colours), B/2.2 (measured colour) all trade a little flair for a number/image a
  knitter can rely on. For a community sceptical of AI, that is the product moat.
- **Speed as an architecture choice, not an afterthought.** B/2.1 and B/2.3 make
  colour switching instant via caching + in-code tint; the LATENCY_NOTE covers
  pre-warming the presets so even the first view is fast. The "flow" value is
  served by design, not by hoping the model is quick.
- **Fail visibly and safely.** Both assignments decline / fall back rather than
  guess or crash (A decline paths, B placeholder). A calm product is one that never
  shows a scary error or a confidently wrong number.
- **Go-live posture is stated, not just built.** Cost at scale (caching + preset
  warming collapses ~2,000 previews/day to a few generations per pattern),
  content-safety (structured-enum inputs → little to moderate, but the gate is
  named), and provider outage (offline/mock + fallback) are addressed as product
  risks, not just code paths.

---

## 4. What we deliberately did NOT do (scope discipline)

The brief rewards protecting your time and saying what you cut.

- **A:** no Streamlit/web UI (CLI + eval is "function over polish"); no shaped-
  garment geometry (flat-rectangle model, stated in assumptions).
- **B:** no backend/DB/auth/real app UI (brief says a script is fine); no Fair-Isle
  / multi-colour; content-safety is a **one-paragraph note**, not an implementation,
  because structured-enum inputs give almost nothing to moderate; batch pre-
  generation is **described** in the LATENCY_NOTE (the gated warm-up *is* it) rather
  than built as a separate feature; the cotton-sheen specular pass is a documented
  limitation with the native path as the answer.

---

## 5. How the dual review changed these decisions

The Part B plan was reviewed by a senior-product and a senior-developer lens.
Concrete changes made:

- **Developer:** split the cache key (colour excluded); made the fallback transient
  (no cache poisoning); reframed the colour claim to "hue+chroma exact, mean = hex"
  and **added the ΔE2000 measurement**; adopted the Ravelry cassette to satisfy
  real-call-vs-keyless.
- **Product:** chose the **hybrid** lead path (native for trust presets); hardened
  the stitch demo to a **confusable pair** (rib vs stockinette, seed vs garter) with
  an honest self-assessment; added Ravelry provenance; promoted the cost estimate
  from "cut first" to "include".
- **Conflicts resolved by the owner:** language (Node+`sharp` for repo consistency);
  lead path (hybrid).

---

## 6. With more time

- Assignment A: calibrate `metres_per_cm²` and needle-change rules against real
  ball-band / sales data; add shaped-garment geometry; expand the eval set and run
  it `--live` to report real LLM latency and routing under a model.
- Assignment B: implement the cotton-sheen specular pass; add the greyscale-then-
  tint vs native quality comparison as a formal figure; a real Ravelry cassette;
  a content-safety moderation stub wired into the display gate.

---

*Domain sources: `assignment-a/assumptions.md` (Craft Yarn Council Standard Yarn
Weight System; standard needle conversion charts). Latency strategy:
`LATENCY_NOTE.md`. Delivery plan: `DELIVERY_PLAN.md`.*
