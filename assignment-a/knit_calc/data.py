"""
Domain constants for the knitting calculators.

Every number the assistant ever reports ultimately comes from here or from the
formulas in the sibling modules. These constants are *explicit, documented
approximations* (per the brief: reasonable approximations are fine as long as
they are explicit and easy to change). Sources are listed in assignment-a/assumptions.md.

Primary source: Craft Yarn Council (CYC) "Standard Yarn Weight System".
Needle metric->US->UK equivalences: standard published conversion charts.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class YarnWeight:
    slug: str                 # canonical id
    cyc_number: int           # CYC weight category 0-7
    label: str                # human name
    typical_gauge: float      # typical stockinette gauge, stitches per 10cm
    gauge_range: tuple        # (min, max) stitches per 10cm
    needle_range_mm: tuple    # recommended metric needle range (min, max) mm
    metres_per_ball: float    # typical put-up, metres per standard ball (default)
    metres_per_cm2: float     # yarn length consumed per cm2 of stockinette fabric


# CYC categories. gauge/needle ranges follow the CYC standard chart; the
# metres_per_cm2 and metres_per_ball figures are documented approximations
# calibrated to typical real-world projects (see assumptions.md).
YARN_WEIGHTS = {
    "lace":        YarnWeight("lace",        0, "Lace",         36.0, (33, 40), (1.5, 2.25),  400, 0.55),
    "super_fine":  YarnWeight("super_fine",  1, "Super Fine",   29.5, (27, 32), (2.25, 3.25), 200, 0.40),
    "fine":        YarnWeight("fine",        2, "Fine",         24.5, (23, 26), (3.25, 3.75), 155, 0.28),
    "light":       YarnWeight("light",       3, "Light (DK)",   22.5, (21, 24), (3.75, 4.5),  120, 0.20),
    "medium":      YarnWeight("medium",      4, "Medium (Worsted/Aran)", 18.0, (16, 20), (4.5, 5.5), 90, 0.15),
    "bulky":       YarnWeight("bulky",       5, "Bulky",        13.5, (12, 15), (5.5, 8.0),   60, 0.10),
    "super_bulky": YarnWeight("super_bulky", 6, "Super Bulky",   9.0, (7, 11),  (8.0, 12.75), 40, 0.07),
    "jumbo":       YarnWeight("jumbo",       7, "Jumbo",         5.0, (6, 6),   (12.75, 20.0),30, 0.045),
}

# Alias -> canonical slug. Includes common trade names and the CYC number as a string.
_YARN_ALIASES = {
    "0": "lace", "lace": "lace", "cobweb": "lace", "thread": "lace",
    "1": "super_fine", "super fine": "super_fine", "superfine": "super_fine",
    "sock": "super_fine", "fingering": "super_fine", "baby": "super_fine",
    "2": "fine", "fine": "fine", "sport": "fine",
    "3": "light", "light": "light", "dk": "light", "light worsted": "light",
    "4": "medium", "medium": "medium", "worsted": "medium", "aran": "medium", "afghan": "medium",
    "5": "bulky", "bulky": "bulky", "chunky": "bulky", "craft": "bulky", "rug": "bulky",
    "6": "super_bulky", "super bulky": "super_bulky", "superbulky": "super_bulky",
    "super chunky": "super_bulky", "roving": "super_bulky",
    "7": "jumbo", "jumbo": "jumbo",
}

# Relative yarn usage per unit area vs stockinette (=1.0). Documented approximations:
# denser textured stitches consume more; open lace consumes less.
STITCH_YARN_FACTOR = {
    "stockinette": 1.00,
    "garter": 1.15,
    "rib": 1.10,
    "1x1 rib": 1.10,
    "2x2 rib": 1.10,
    "seed": 1.15,
    "moss": 1.15,
    "cable": 1.30,
    "lace": 0.85,   # lace *stitch pattern* (open eyelets), distinct from lace *weight*
}

# Standard needle size conversions: (metric_mm, US, UK). "-" = no standard equivalent.
NEEDLE_TABLE = [
    (2.0,  "0",    "14"),
    (2.25, "1",    "13"),
    (2.75, "2",    "12"),
    (3.0,  "-",    "11"),
    (3.25, "3",    "10"),
    (3.5,  "4",    "-"),
    (3.75, "5",    "9"),
    (4.0,  "6",    "8"),
    (4.5,  "7",    "7"),
    (5.0,  "8",    "6"),
    (5.5,  "9",    "5"),
    (6.0,  "10",   "4"),
    (6.5,  "10.5", "3"),
    (7.0,  "-",    "2"),
    (7.5,  "-",    "1"),
    (8.0,  "11",   "0"),
    (9.0,  "13",   "00"),
    (10.0, "15",   "000"),
    (12.0, "17",   "-"),
    (15.0, "19",   "-"),
    (20.0, "36",   "-"),
]


def resolve_weight(name: str) -> YarnWeight:
    """Resolve a user-supplied weight name/number to a canonical YarnWeight.

    Raises ValueError for anything we don't recognise, so the assistant can
    decline rather than guess.
    """
    if name is None:
        raise ValueError("No yarn weight given.")
    key = str(name).strip().lower()
    if key in YARN_WEIGHTS:            # canonical slug passed directly
        return YARN_WEIGHTS[key]
    slug = _YARN_ALIASES.get(key)
    if slug is None:
        known = sorted({v.label for v in YARN_WEIGHTS.values()})
        raise ValueError(
            f"Unknown yarn weight: {name!r}. Known weights: {', '.join(known)}."
        )
    return YARN_WEIGHTS[slug]


def resolve_stitch_factor(stitch: Optional[str]) -> tuple:
    """Return (canonical_stitch_name, yarn_factor). Defaults to stockinette."""
    if stitch is None:
        return "stockinette", STITCH_YARN_FACTOR["stockinette"]
    key = str(stitch).strip().lower()
    if key not in STITCH_YARN_FACTOR:
        known = ", ".join(sorted(STITCH_YARN_FACTOR))
        raise ValueError(f"Unknown stitch pattern: {stitch!r}. Known: {known}.")
    return key, STITCH_YARN_FACTOR[key]


def snap_needle(metric_mm: float) -> dict:
    """Snap a metric size to the nearest standard needle and return all systems."""
    nearest = min(NEEDLE_TABLE, key=lambda row: abs(row[0] - metric_mm))
    return {"metric_mm": nearest[0], "us": nearest[1], "uk": nearest[2]}
