# Video walkthrough script (~11–12 min)

A screen-recording script for the take-home. Timecodes are targets, not rules.
`[SHOW]` = what's on screen; `[SAY]` = narration. Have two terminals open
(`assignment-a`, `assignment-b`), the LLD diagram, and a browser tab ready.

---

## 0. Cold open — the thesis (0:00–0:45)

[SHOW] The LLD diagram (the artifact / `architecture.drawio`), full screen.

[SAY] "This is a knitters' app. Two things make or break it: **trust** — people
buy real yarn based on the numbers and images — and **speed**, a calm flow.
Everything I built follows one rule: **the AI understands and phrases, but
deterministic code owns every number and pixel a knitter trusts.** On this diagram
that's the amber gates. Let me show both assignments running for real, then how I'd
lead the full build."

---

## 1. Assignment A — trustworthy assistant (0:45–4:15)

### Why it's structured this way (0:45–1:30)
[SHOW] Left lane of the diagram — point at the two amber gates as you name them.

[SAY] "The idea in one line: the AI reads the question and writes the reply, but
the actual numbers come from plain, tested code — never from the model.

Every question passes through three checks before anyone sees an answer:
- **Check 1 — do we handle this? (intent).** Yarn amount, needle size, or tension.
  If it's something else, it declines.
- **Check 2 — do we have what we need? (inputs).** For example the dimensions and
  the yarn weight. If something's missing, it asks — it doesn't guess.
- **Check 3 — do the numbers match? (verification).** The model's wording is only
  shown if every number in it matches what the calculator computed. If it doesn't,
  we show the plain, guaranteed-correct template instead.

So there are only two ways out: a correct, verified answer — or an honest 'I can't
answer that.' Never a made-up number."

### It runs — answering (1:30–2:30)
[SHOW] Terminal in `assignment-a`. Run:
```bash
npm run cli -- ask "How much DK yarn do I need for a 50 x 60cm blanket in stockinette?"
```
[SAY] "600 metres, 6 balls — and that number came from the calculator, not the
model." Then:
```bash
npm run cli -- ask "My swatch is 24 stitches per 10cm but the pattern says 22. What's wrong?"
```
[SAY] "Too tight, the piece would come out ~8% smaller, go up a needle size."

Then show `--json`:
```bash
npm run cli -- ask "How much DK yarn for a 50x60cm blanket in stockinette?" --json
```
[SAY] "Full provenance — the calculator result, the assumptions used, and
`numbersVerified: true`."

### It declines (2:30–3:00)
[SHOW] Run:
```bash
npm run cli -- ask "What colour of yarn should I choose?"
npm run cli -- ask "How much yarn do I need?"
```
[SAY] "Out of scope → it declines with **no invented numbers**. Missing inputs →
it asks for width, height, and weight. It never guesses."

### Proof — the eval (3:00–4:15)
[SHOW] Run:
```bash
npm test           # 35 tests
npm run eval       # 20 questions
```
[SAY] "35 unit tests, and an evaluation harness: 20 real questions scored on
routing, number-match, and latency. The numbers are checked against the
calculators as an **independent oracle** — not the assistant checking itself.
100% offline, routing 20/20, numbers 16/16, four must-decline cases all correct."

---

## 2. Assignment B — swatch preview (4:15–8:30)

### Why it's structured this way (4:15–5:00)
[SHOW] Right lane of the diagram.

[SAY] "Exact hex is unreliable from any image model, and generating per colour is
several seconds. So the design is **hybrid**: generate one neutral structure per
stitch, then apply colour in code with an OKLab tint — exact hue and chroma,
milliseconds. Preset colours are generated natively and cached, because those are
what a knitter buys on. Two cache keys: the structure key **excludes colour**, so
all colours share one base."

### It runs — the demos (5:00–6:45)
[SHOW] Terminal in `assignment-b`. Run:
```bash
npm run demo
```
then open `output/index.html` in the browser.

[SAY] Walk the contact sheet top to bottom:
- **Stitch variation** — "Same purple, six stitches. The honest test is the
  confusable pairs: rib vs stockinette are both vertical, seed vs garter are both
  bumpy — and they're clearly distinct. Cable's rope braids are unmistakable."
- **Colour switching** — "One cable structure generated once; every colour after
  is a cache hit plus a fast in-code tint — no API call. That's what makes
  tap-a-colour instant."
- **ΔE section** — "Colour is proved, not claimed: ΔE2000 between the input hex and
  the swatch is printed for each — all under 2, below the just-noticeable
  threshold."

### The fallbacks actually trigger (6:45–7:45)
[SHOW] Point at the **fallback** panel in the sheet.

[SAY] "This is a **forced** failure — I flip a switch. Instead of crashing, it
returns a solid placeholder in the exact requested hex, and critically it's
**never cached**, so one outage doesn't poison later real calls."

[SHOW] Point at the **Ravelry** panel.

[SAY] "A real Ravelry call. The requirement conflicts with 'runs without keys', so
I record the real response into a cassette and replay it offline, labelled, with
provenance — pattern name, permalink, query. With keys it hits live; on a no-match
or timeout it degrades gracefully and shows our swatch alone."

### Cache hit, explicitly (7:45–8:30)
[SHOW] Point at the **caching** panel (MISS 18ms → HIT 0ms).

[SAY] "Caching is real: same input twice — first call misses and generates, second
is a cache hit at zero milliseconds, on the colour-free structure key."

---

## 3. Before this could safely go live (8:30–10:15)

[SAY] "Separate from the latency note, here's what each assignment still needs
before real users — I'll frame both the same way: **safety, cost, reliability**."

### Assignment A — the assistant (8:30–9:20)
[SHOW] Left lane of the diagram.

[SAY]
- **Safety / trust.** The verification gate already blocks wrong numbers, but
  before launch I'd widen the evaluation set well beyond 20 questions, and get a
  knitting expert to sign off on the constants and approximations in `data.ts` —
  those are the numbers people spend money on. I'd add output filtering so the
  model's wording stays on-topic, guard against prompt-injection in the question,
  and log every decline so we can see where it can't yet help.
- **Cost.** The LLM only phrases, so calls are cheap — and the offline parser plus
  templates mean many answers need no model call at all. At scale I'd cache answers
  to common questions, rate-limit per user, and set a spend cap.
- **Reliability.** If the LLM provider is down, it already falls back to the offline
  parser and the deterministic templates, so the numbers still work. I'd add
  monitoring, alerting, and a health check. And privacy: questions can contain
  personal project details, so handle and log them carefully.

### Assignment B — the swatch preview (9:20–10:15)
[SHOW] Right lane of the diagram.

[SAY]
- **Preventing inappropriate images.** Inputs are structured enums, so there's
  little to abuse — but I'd still run every generated image through a moderation /
  NSFW check before it's shown, and review image rights and quality. The hook for
  that gate is already designed in.
- **Controlling cost when thousands of users try many colours.** The architecture
  already answers this: cache plus preset pre-warming collapses cost from
  per-tap to a few generations per *pattern*, not per user — with hard spend caps
  and alerts, and a smaller/faster model tier on the warm path.
- **If an AI provider goes down.** The clients are provider-agnostic, and the parts
  that matter most — the in-code tint and the exact-hex placeholder — work with no
  model at all. So an outage degrades to a useful, colour-correct preview, never a
  blank screen or a crash. Plus CDN and storage for the cached images.

---

## 4. Two-minute summary — delivery plan + biggest risk (10:15–12:00)

[SHOW] `DELIVERY_PLAN.md` weekly table.

[SAY] "Six weeks, one React Native engineer and one Python engineer. I cut hard:
the assistant and the planner-with-swatch ship — they're the product — while
community launches read-only, guides are bundled content, inventory is a thin
slice. Auth in week 1, assistant week 2, the swatch service week 3 — front-loaded
because it's the riskiest piece — feature-complete week 5, submit week 6. The app
is in store test tracks from week 1 so submission isn't a cliff.

**The single biggest risk** is that the swatch preview — the differentiator — is
also the least predictable part: model output quality, cost, and latency. That's
exactly why I front-load it to week 3 and de-risk it three ways: native presets for
fidelity, in-code tint and caching for speed and cost, and an instant placeholder
so the interaction never blocks. If the model quality disappoints, the tinted and
cached paths still ship a usable feature. Everything else on the plan is
comparatively boring — which is how you want it with two engineers and six weeks."

[SAY] "Thanks — the code, the decisions, and both plans are in the repo."

---

## Pre-flight checklist
- [ ] `assignment-a`: `npm install` done; try the four `ask` commands + `npm run eval`.
- [ ] `assignment-b`: `npm install` done; `npm run demo` written `output/index.html`.
- [ ] Browser tab on `output/index.html`; LLD diagram open.
- [ ] (Optional, live) keys in `.env`; run one `--live` swatch + `record-ravelry`.
- [ ] Screen at a readable font size; terminal cleared between commands.
