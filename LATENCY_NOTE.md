# LATENCY_NOTE — making the swatch preview feel instant

The swatch preview is a large, zoomable hero image and the main visual focus of
the planner screen. The user taps between 5–6 preset colours and expects the
preview to update immediately, but a native image generation takes several
seconds. The way to serve the app's "calm flow" value is to **separate two
different interactions** and answer each with the right technique — not to make
one slow generation feel fast, but to make sure the slow generation almost never
sits on the interaction path.

## Two interactions, two answers

**1. Switching between the preset colours** (the common case, must be instant).
The presets are a known, small set per project. We **pre-generate every preset
natively, once, and cache it**, so a tap is a cache hit — no model call, no
several-second wait. In this PoC that is the structure key + preview cache
(`assignment-b/src/cache.ts`); in production it is a CDN-backed object store keyed
on `(stitch, weight, fibre, colour, model, promptVersion)`.

**2. First view of a new stitch/colour that isn't warmed yet** (rarer). Here a
generation genuinely costs a few seconds, so we never block on it:
- **Show a placeholder immediately.** A solid swatch in the exact requested hex
  (the fallback asset we already build, `fallback.ts`) renders in <1 frame, so the
  screen is never empty. The real image swaps in when ready — progressive reveal.
- **Tint for the in-between colours.** We generate the neutral **structure once per
  stitch** and apply colour in code with an OKLab tint (`tint.ts`): exact hue and
  chroma, ~0.3 s in-process, no API call. This covers custom colours and gives an
  instant, colour-accurate preview (ΔE2000 ≤ 2) while a full native image warms in
  the background.

## The techniques, concretely

| Technique | What it buys | In this repo |
|---|---|---|
| **Pre-generate + cache presets** (native) | Preset taps are instant *and* full-fidelity | structure/preview cache; batch warm |
| **Structure once, tint per colour** | Any colour in ~0.3 s, exact hex, ~6 API calls total not per-colour | `tint.ts` (OKLab), `cache.ts` (colour-free structure key) |
| **Immediate placeholder → swap** | Screen never blank; perceived latency ≈ 0 | `fallback.ts` hex placeholder + progressive reveal |
| **Faster/smaller model tier for warming** | Cheaper, quicker background fills | provider-agnostic client; smaller size on the warm path |
| **Cache-warming on project open** | The presets a user will tap are ready before they tap | batch pre-generation (the "gated warm-up" is exactly this) |

## Why this hits the target

- **Preset switch:** cache hit → effectively 0 ms.
- **Custom colour:** OKLab tint of a cached structure → ~0.3 s, colour-exact.
- **Cold first view:** hex placeholder in <16 ms, real image streamed in behind it.

The only path that ever costs several seconds is the *first ever* generation of a
brand-new stitch/colour combination with nothing warmed — and even that shows an
exact-colour placeholder instantly and warms in the background. Because warming is
driven by the finite preset set (not per user), the cost and the latency both
collapse from "per tap" to "a few generations per pattern," which is what makes the
feature both fast and affordable at scale (see the cost estimate in `DECISIONS.md`
§3 / the demo's cache section).

## Trade-off, stated

Tinting a neutral structure gives exact hue/chroma and speed, but a matte grey base
can't reproduce fibre-specific sheen (e.g. white cotton). So the **presets** — the
colours a knitter actually buys on — are **native** (full fidelity), and tint is
reserved for instant switching, custom colours, and the loading state. Trust is
never traded for speed; the two are served by different parts of the pipeline.
