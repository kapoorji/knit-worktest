# Assignment A — Knitting Calculators (Part 1: calculators + CLI)

Deterministic, tested knitting calculators with a command-line interface.

These calculators are the **single source of truth for every number** the AI
assistant will report. They are pure Python (standard library only), need **no
API key**, and run fully offline. The natural-language assistant and evaluation
script build on top of this module (added in later steps).

## What's here

```
assignment-a/
├── knit_calc/            # the calculators (importable package)
│   ├── data.py           # domain constants: yarn weights, needle table, factors
│   ├── yarn.py           # yarn quantity calculator
│   ├── needles.py        # needle size recommender
│   └── tension.py        # gauge / tension troubleshooter
├── cli.py                # command-line interface
├── tests/                # pytest unit tests (23 tests)
├── assumptions.md        # domain research, constants and sources
├── requirements.txt
└── README.md             # this file
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

No dependencies are needed to run the CLI — just Python 3.10+:

```bash
cd assignment-a
python3 cli.py yarn --width 50 --height 60 --weight dk
```

To run the tests, install pytest (a virtualenv is recommended):

```bash
python3 -m venv ../.venv && source ../.venv/bin/activate
pip install -r requirements.txt
```

## CLI usage

Three subcommands: `yarn`, `needle`, `tension`. Add `--json` to any of them to
get the full structured result (numbers **plus the assumptions used**), which is
exactly what the assistant layer consumes.

### Yarn quantity

```bash
python3 cli.py yarn --width 50 --height 60 --weight dk --stitch stockinette
```
```
For a 50.0 x 60.0 cm stockinette piece in Light (DK) yarn, you need about 600 m
of yarn (~660 m with a 10% safety margin), which is about 6 ball(s) at ~120 m per ball.
```

Options: `--stitch` (stockinette, garter, rib, seed, moss, cable, lace),
`--gauge` (your sts/10cm, optional), `--metres-per-ball` (override the default
for your exact yarn), `--safety` (margin, default `0.10`).

### Needle recommender

```bash
python3 cli.py needle --weight worsted --project scarf --fabric drapey
```
```
For Medium (Worsted/Aran) yarn with a drapey fabric, use about 5.5 mm needles
(US 9 / UK 5).
```

`--fabric` is one of `firm`, `balanced` (default), `drapey`. `--project` is
advisory (adds a note, e.g. socks are often worked firmer).

### Tension troubleshooter

```bash
python3 cli.py tension --target 22 --actual 24
```
```
You are knitting too tight (24.0 vs target 22.0 sts/10cm, minor). Left unchanged
the piece would be about 8.3% smaller than intended. Fix: go up ~1.0 mm in needle size.
```

### JSON output (what the assistant consumes)

```bash
python3 cli.py yarn --width 50 --height 60 --weight worsted --stitch cable --json
```
```json
{
  "metres": 585,
  "metres_with_safety": 644,
  "balls": 8,
  "metres_per_ball": 90,
  "inputs": { "width_cm": 50.0, "height_cm": 60.0, "weight": "medium",
              "weight_label": "Medium (Worsted/Aran)", "stitch": "cable",
              "gauge_sts_per_10cm": null, "safety": 0.1 },
  "assumptions": { "metres_per_cm2": 0.15, "stitch_factor": 1.3,
                   "gauge_factor": 1.0, "typical_gauge_sts_per_10cm": 18.0 }
}
```

### When it can't answer

Bad or unknown inputs don't guess — they explain and exit non-zero (exit code
`2`). This mirrors the assistant's "say so rather than guess" rule.

```bash
python3 cli.py yarn --width 0 --height 60 --weight dk
# Cannot compute: Dimensions must be positive.

python3 cli.py needle --weight "spider silk"
# Cannot compute: Unknown yarn weight: 'spider silk'. Known weights: Bulky, Fine, ...
```

## Using the calculators as a library

```python
from knit_calc import estimate_yarn, recommend_needle, diagnose_tension

est = estimate_yarn(width_cm=50, height_cm=60, weight="dk", stitch="stockinette")
print(est.metres, est.balls)        # 600 6
print(est.to_dict())                # full numbers + assumptions

rec = recommend_needle("worsted", fabric="balanced")
print(rec.metric_mm, rec.us, rec.uk)  # 5.0 8 6

diag = diagnose_tension(target_sts_per_10cm=22, actual_sts_per_10cm=24)
print(diag.problem, diag.needle_change_mm)  # too_tight 1.0
```

## Running the tests

```bash
cd assignment-a
python -m pytest -q
```
```
23 passed
```

The tests lock the reference calculations (e.g. the 50×60 cm DK blanket = 600 m /
6 balls), the monotonic relationships (cable > stockinette > lace; finer yarn
needs more metres; firm needle < drapey needle; too-tight goes up, too-loose goes
down), and that invalid inputs raise cleanly.
