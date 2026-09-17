# Domain Assumptions & Sources — Assignment A

Every number the assistant reports comes from the calculators in `src/`,
which are driven by the constants in `src/data.ts`. Those constants are
**explicit, documented approximations** and are deliberately easy to change in
one place. This file records what they are, where they come from, and how
confident we are.

## Sources (public)

- **Craft Yarn Council (CYC) — Standard Yarn Weight System.** The authority most
  yarn labels and patterns reference. Gives the 0–7 weight categories, typical
  stockinette gauge ranges (stitches per 10 cm / 4 in), and recommended metric
  needle-size ranges. Used for `typicalGauge`, `gaugeRange`, `needleRangeMm`.
- **Standard knitting-needle conversion charts** (metric ↔ US ↔ UK). Widely
  published and consistent across sources. Used for `NEEDLE_TABLE`.
- General knitting references for how stitch patterns affect yarn consumption and
  how gauge is corrected with needle size (rules of thumb below).

## Yarn weight categories (`YARN_WEIGHTS`)

| CYC | Weight | Typical gauge (sts/10cm) | Needle range (mm) | Default m/ball | m per cm² |
|-----|--------|--------------------------|-------------------|----------------|-----------|
| 0 | Lace | 36 (33–40) | 1.5–2.25 | 400 | 0.55 |
| 1 | Super Fine (sock/fingering) | 29.5 (27–32) | 2.25–3.25 | 200 | 0.40 |
| 2 | Fine (sport) | 24.5 (23–26) | 3.25–3.75 | 155 | 0.28 |
| 3 | Light (DK) | 22.5 (21–24) | 3.75–4.5 | 120 | 0.20 |
| 4 | Medium (worsted/aran) | 18 (16–20) | 4.5–5.5 | 90 | 0.15 |
| 5 | Bulky (chunky) | 13.5 (12–15) | 5.5–8.0 | 60 | 0.10 |
| 6 | Super Bulky | 9 (7–11) | 8.0–12.75 | 40 | 0.07 |
| 7 | Jumbo | 5 (≤6) | 12.75–20 | 30 | 0.045 |

- **Gauge and needle ranges: high confidence** — straight from the CYC standard.
- **Metres per ball: medium confidence.** Real put-up varies a lot by brand and
  ball weight (25/50/100 g). These are typical mid-range figures for a common
  ball. The CLI/API accepts a `metresPerBall` override so a user can enter the
  exact figure from their yarn's ball band.
- **Metres per cm²: lower confidence, the main modelling assumption.** Calibrated
  so a 50 × 60 cm (3000 cm²) worsted stockinette blanket ≈ 450 m, which matches
  typical real-world blanket yardage. Finer yarns scale up (more length packed
  into the same area). This is the number most worth refining with real data.

## Yarn quantity model (`src/yarn.ts`)

```
metres = area_cm2 × metresPerCm2(weight) × stitchFactor × gaugeFactor
```

- `area_cm2` = width × height (flat rectangular piece — see limitations).
- `stitchFactor` — relative yarn use vs stockinette (=1.00): garter 1.15,
  rib 1.10, seed/moss 1.15, **cable 1.30**, lace pattern 0.85. Textured/cabled
  fabrics eat more yarn; open lace uses less. Medium confidence, easy to tune.
- `gaugeFactor` = userGauge ÷ typicalGauge. Knitting tighter (more sts/10cm)
  means more, smaller stitches and more yarn, modelled as linear. Approximation.
- A **safety margin** (default 10%) is added before converting to balls, because
  running out of a dye lot mid-project is a real, costly failure. Balls are
  rounded **up**.

## Needle recommender (`src/needles.ts`)

- Picks a position inside the weight's CYC needle range by desired fabric:
  firm = 15% into the range (smaller needle, denser), balanced = midpoint,
  drapey = 85% (larger needle, softer), then **snaps to the nearest standard
  size** and reports metric/US/UK.
- `projectType` is **advisory only** — it never changes the number, it only adds
  a note (e.g. socks are often worked firmer). This keeps the recommendation
  honest and predictable.

## Tension troubleshooter (`src/tension.ts`)

- Compares target vs actual gauge (sts/10cm).
- **More** sts/10cm than target ⇒ stitches too small ⇒ **too tight** ⇒ go **up** a
  needle size. **Fewer** ⇒ **too loose** ⇒ go **down**. High confidence direction.
- Rule of thumb: ~1 st/10cm of difference ≈ **0.5 mm** of needle change. Medium
  confidence; it is a starting point, and the tool tells the user to re-swatch.
- Finished-size impact: at the actual gauge, finished width scales by
  target ÷ actual (e.g. 24 actual vs 22 target ⇒ ~8% smaller). Exact arithmetic.
- On-gauge tolerance: within 0.5 st/10cm is treated as on gauge.

## Limitations (stated honestly)

- Models a **flat rectangle**. Shaped garments, ease, seams and edgings are out of
  scope for this PoC; they would add pattern-piece geometry.
- Yarn estimates are **planning figures**, not guarantees — hence the safety
  margin and the advice to buy from one dye lot.
- Colourwork (Fair Isle, intarsia) and multi-yarn projects are not modelled.
- All constants live in `src/data.ts` and can be replaced with brand- or
  test-specific data without touching the formulas.
