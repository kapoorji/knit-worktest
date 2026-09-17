# Knit App Work Test — Plan & Tool Decisions

Status: **DRAFT for approval** · Owner: Himanshu · Target: GitHub repo + video within 48h

This is the shared plan for the two-assignment technical work test (mobile app for
knitters). It records the approach, the tool choices with rationale, the repo layout,
and the build order. Once approved, it seeds `DECISIONS.md`.

---

## 0. What the test is (read-back)

Build two small working proofs of concept + leadership write-ups + a 10–15 min video.
Budget ~10–12h. Python preferred. AI coding tools allowed (must disclose use).
Runnable **without our keys** (mock/offline paths required).

- **A — Trustworthy AI assistant:** deterministic calculators + an LLM that only
  understands & phrases. Every number traceable to code. Declines when it can't answer.
  15+ question eval script, unit tests, offline mock mode.
- **B — AI swatch preview:** generate a photorealistic knit swatch from structured input
  (stitch + hex). Cable must look different from rib/stockinette; colour matches hex;
  caching; failure fallback; colour-switch demo; stitch-variation demo; real Ravelry photo
  comparison. Notebook is fine — no server/DB/auth/UI.
- **Docs:** README, DECISIONS, LATENCY_NOTE (½–1p), DELIVERY_PLAN (1–2p), video.

Evaluated hard on: maths trustworthy · both actually run · stitch structure genuinely
differs · fallbacks trigger on purpose · caching is real · Ravelry call is real ·
eval reports real metrics · write-ups concrete.

---

## 1. The two architectural insights this is really testing

### A — the LLM never produces a number
```
user text → [LLM or offline parser] → intent + params (structured)
          → deterministic Python calculator → numbers
          → answer templated with the computed numbers (verbatim)
```
- The LLM does NL→structured extraction and friendly phrasing only.
- The answer is assembled from the calculator's numeric output, so the number in the
  reply is the number the code computed — by construction, not by hope.
- The eval verifies (a) the right calculator was routed, (b) the numbers in the reply
  match the calculator output, (c) response time.
- Missing/ambiguous inputs or unknown intent → **decline** ("I can't answer that
  reliably"), never guess. This is the "is the maths trustworthy" criterion.

### B — generate structure once, tint in code
```
stitch_type → generate ONE neutral/greyscale structure image (cached)
            → apply target hex via Pillow tint/luminosity → colour-exact swatch (instant)
```
- Exact hex is unreliable from any generative model → so **colour is applied in code**,
  guaranteeing the hex matches.
- Colour switching needs **no** API call → solves the stated latency tension and is the
  LATENCY_NOTE answer + bonus task #1, for free.
- Only ~6 base images ever generated (one per stitch), cached permanently → spend ≈ cents.
- We also show naive per-colour generation side-by-side for an honest speed/quality
  comparison.

---

## 2. Tool decisions

| Concern | Decision | Rationale |
|---|---|---|
| Language | **Python 3.11+** | Brief preference; best for calculators + notebook + Pillow |
| LLM (A) | **Anthropic Claude Haiku** | Cheap, strong intent/tool extraction; narrow role (no numbers) |
| Offline parser (A) | **Rule-based (regex/keyword) fallback** | Lets tests + eval run with no key; proves resilience |
| Image model (B) | **OpenAI `gpt-image-1`** (primary) | Best structural instruction-following — the hardest eval line |
| Image alt (B) | **Flux via fal.ai/Replicate** (documented) | Superior texture realism, near-free; noted trade-off in DECISIONS |
| Colour (B) | **Pillow tint in code** | Exact hex, instant switching, tiny spend |
| A interface | **CLI + eval script** (Streamlit only if time) | "Function over polish" |
| B interface | **Jupyter notebook** | Inline side-by-side images; brief asks for it |
| Caching (B) | **Filesystem, keyed on hash of full input dict** | Cache-hit flag + timing proves "identical call skips API" |
| Ravelry | **`requests` + free API**, graceful timeout/no-match | Real call required |
| Tests | **pytest** (calculators) + custom **eval script** (metrics table) | "Real metrics" |
| Secrets | **`.env` + `.env.example`**, mock mode default | Ground rules; runnable without our keys |

**Cost posture:** dev entirely against mock/offline paths; real paid calls (Haiku + image
model) run in a single controlled batch only after explicit go-ahead. Estimated total real
spend for the whole build: well under $1.

---

## 3. Repo layout (matches the brief exactly)

```
knit-worktest/
├── assignment-a/          # AI assistant, calculators, tests, eval script
│   ├── knit_calc/         # deterministic calculators (yarn, needle, tension)
│   ├── assistant.py       # NL→intent→calc→templated answer; LLM + offline mock
│   ├── cli.py             # minimal interface
│   ├── tests/             # pytest unit tests for calculators
│   ├── eval/              # eval script + 15+ question dataset + report
│   └── assumptions.md     # domain research: yarn weights, gauge, sources
├── assignment-b/          # swatch preview notebook + support module
│   ├── swatch.ipynb       # runs every required behaviour inline
│   ├── swatch/            # prompt builder, generator, cache, tint, ravelry, fallback
│   └── cache/             # generated base structures (gitignored)
├── README.md
├── DECISIONS.md
├── LATENCY_NOTE.md
├── DELIVERY_PLAN.md
├── .env.example
└── .gitignore
```
Media/cache/secrets are gitignored.

---

## 4. Build order (timeboxed ~10–12h)

1. **Scaffold** repo, `.gitignore`, `.env.example`, deps. (~20m)
2. **A calculators** + domain assumptions + pytest — the trust core, keyless. (~2h)
3. **A assistant** (Haiku + offline parser) + CLI + decline path. (~1.5h)
4. **A eval script** (15+ Qs, checks routing/numbers/latency, prints report). (~1h)
5. **B notebook**: prompt builder → generator (mock first) → cache → tint → fallback. (~2h)
6. **B demos**: colour-switch (3 colours), stitch-variation (3 stitches), Ravelry compare. (~1.5h)
7. **Real API batch** (gated on your go): generate the ~6 base structures + a few Haiku calls. (~30m)
8. **Leadership docs**: README, DECISIONS, LATENCY_NOTE, DELIVERY_PLAN. (~1.5h)
9. **Commit/push milestones throughout; final polish + video script.** (buffer)

Priority if time runs short (brief rewards this): A trust core + B core requirements +
DECISIONS/DELIVERY_PLAN. Cut: Streamlit, tension troubleshooter, bonus tasks — and say so.

---

## 5. Open items / assumptions to confirm

- **OpenAI key** (or fal) needed only at step 7; will confirm before first paid call.
- **Anthropic key** needed at step 3/7; same gate.
- **Ravelry** dev account (free, ~2 min signup) needed for step 6; keyless fallback exists.
- GitHub: public repo, or private with access granted to the reviewer's email — TBD which.
- Video: recorded last, by you, from a short script I'll draft.

Approve this and I'll start at step 1.
