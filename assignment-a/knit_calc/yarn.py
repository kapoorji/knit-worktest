"""Yarn quantity calculator.

Model (all steps explicit and easy to change — see assumptions.md):

    metres = area_cm2 * metres_per_cm2(weight) * stitch_factor * gauge_factor

where
    area_cm2       = width_cm * height_cm
    metres_per_cm2 = per-weight constant (finer yarn -> more metres per area)
    stitch_factor  = relative usage of the stitch pattern vs stockinette
    gauge_factor   = user_gauge / typical_gauge  (knitting tighter uses more yarn)

Balls/skeins = ceil( metres_with_safety / metres_per_ball ).
"""

import math
from dataclasses import dataclass, field, asdict
from typing import Optional

from .data import resolve_weight, resolve_stitch_factor


@dataclass
class YarnEstimate:
    metres: float
    metres_with_safety: float
    balls: int
    metres_per_ball: float
    inputs: dict = field(default_factory=dict)
    assumptions: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)

    def summary(self) -> str:
        i = self.inputs
        return (
            f"For a {i['width_cm']} x {i['height_cm']} cm {i['stitch']} piece in "
            f"{i['weight_label']} yarn, you need about {self.metres} m of yarn "
            f"(~{self.metres_with_safety} m with a {int(i['safety']*100)}% safety margin), "
            f"which is about {self.balls} ball(s) at ~{self.metres_per_ball} m per ball."
        )


def estimate_yarn(
    width_cm: float,
    height_cm: float,
    weight: str,
    stitch: str = "stockinette",
    gauge_sts_per_10cm: Optional[float] = None,
    metres_per_ball: Optional[float] = None,
    safety: float = 0.10,
) -> YarnEstimate:
    """Estimate yarn required for a flat rectangular piece.

    Raises ValueError on invalid inputs so the assistant can decline cleanly.
    """
    if width_cm is None or height_cm is None:
        raise ValueError("Both width_cm and height_cm are required.")
    if width_cm <= 0 or height_cm <= 0:
        raise ValueError("Dimensions must be positive.")
    if safety < 0:
        raise ValueError("Safety margin cannot be negative.")

    w = resolve_weight(weight)
    stitch_name, stitch_factor = resolve_stitch_factor(stitch)

    gauge_factor = 1.0
    if gauge_sts_per_10cm is not None:
        if gauge_sts_per_10cm <= 0:
            raise ValueError("Gauge must be positive.")
        gauge_factor = gauge_sts_per_10cm / w.typical_gauge

    area = width_cm * height_cm
    metres = area * w.metres_per_cm2 * stitch_factor * gauge_factor
    metres_with_safety = metres * (1 + safety)

    mpb = metres_per_ball if metres_per_ball is not None else w.metres_per_ball
    if mpb <= 0:
        raise ValueError("metres_per_ball must be positive.")
    balls = math.ceil(metres_with_safety / mpb)

    return YarnEstimate(
        metres=round(metres),
        metres_with_safety=round(metres_with_safety),
        balls=balls,
        metres_per_ball=mpb,
        inputs={
            "width_cm": width_cm,
            "height_cm": height_cm,
            "weight": w.slug,
            "weight_label": w.label,
            "stitch": stitch_name,
            "gauge_sts_per_10cm": gauge_sts_per_10cm,
            "safety": safety,
        },
        assumptions={
            "metres_per_cm2": w.metres_per_cm2,
            "stitch_factor": stitch_factor,
            "gauge_factor": round(gauge_factor, 3),
            "typical_gauge_sts_per_10cm": w.typical_gauge,
        },
    )
