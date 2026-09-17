"""Needle size recommender.

Given a yarn weight and a desired fabric hand (firm / balanced / drapey), pick a
metric needle size inside the weight's recommended range and snap it to the
nearest standard size, returning metric / US / UK.

    firm     -> low end of the range   (tighter, denser fabric)
    balanced -> middle of the range
    drapey   -> high end of the range  (looser, softer drape)

project_type is advisory only: it never changes the number, but adds a note
(e.g. socks are often worked firmer than the default).
"""

from dataclasses import dataclass, field, asdict
from typing import Optional

from .data import resolve_weight, snap_needle


FABRIC_POSITION = {"firm": 0.15, "balanced": 0.50, "drapey": 0.85}

# Projects where knitters commonly deviate from a plain balanced fabric.
_FIRM_PROJECTS = {"socks", "sock", "hat", "beanie", "mittens", "gloves", "bag"}
_DRAPEY_PROJECTS = {"shawl", "scarf", "wrap", "blanket", "throw"}


@dataclass
class NeedleRecommendation:
    metric_mm: float
    us: str
    uk: str
    fabric: str
    inputs: dict = field(default_factory=dict)
    assumptions: dict = field(default_factory=dict)
    note: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)

    def summary(self) -> str:
        i = self.inputs
        base = (
            f"For {i['weight_label']} yarn with a {self.fabric} fabric, use about "
            f"{self.metric_mm} mm needles (US {self.us} / UK {self.uk})."
        )
        return f"{base} {self.note}" if self.note else base


def recommend_needle(
    weight: str,
    project_type: Optional[str] = None,
    fabric: str = "balanced",
) -> NeedleRecommendation:
    """Recommend a needle size. Raises ValueError on unknown weight/fabric."""
    w = resolve_weight(weight)

    fabric_key = str(fabric).strip().lower()
    if fabric_key not in FABRIC_POSITION:
        raise ValueError(
            f"Unknown fabric {fabric!r}. Use one of: firm, balanced, drapey."
        )

    lo, hi = w.needle_range_mm
    pos = FABRIC_POSITION[fabric_key]
    target_mm = lo + pos * (hi - lo)
    snapped = snap_needle(target_mm)

    note = None
    if project_type:
        pt = str(project_type).strip().lower()
        if pt in _FIRM_PROJECTS and fabric_key != "firm":
            note = (
                f"For {pt}, many knitters size down for a firmer, harder-wearing "
                f"fabric — consider the firm option too."
            )
        elif pt in _DRAPEY_PROJECTS and fabric_key != "drapey":
            note = (
                f"For a {pt}, a softer drape is often preferred — the drapey option "
                f"may suit better."
            )

    return NeedleRecommendation(
        metric_mm=snapped["metric_mm"],
        us=snapped["us"],
        uk=snapped["uk"],
        fabric=fabric_key,
        inputs={
            "weight": w.slug,
            "weight_label": w.label,
            "project_type": project_type,
        },
        assumptions={
            "needle_range_mm": list(w.needle_range_mm),
            "fabric_position": pos,
            "target_mm_before_snap": round(target_mm, 3),
        },
        note=note,
    )
