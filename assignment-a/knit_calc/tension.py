"""Tension / gauge troubleshooter.

Compares a target gauge with the knitter's actual swatch gauge (both in
stitches per 10cm) and diagnoses whether they are knitting too tight or too
loose, how severe it is, the effect on finished size, and a needle-change fix.

Rules of thumb (documented approximations, easy to change — see assumptions.md):
  * More stitches per 10cm than target  -> stitches are too small -> TOO TIGHT
    -> go UP a needle size.
  * Fewer stitches per 10cm than target -> stitches are too big   -> TOO LOOSE
    -> go DOWN a needle size.
  * ~1 stitch per 10cm of difference is corrected by ~0.5 mm of needle change.
  * If knitting continues off-gauge, finished width scales by target/actual.
"""

from dataclasses import dataclass, field, asdict

# ~0.5 mm needle change per 1 stitch/10cm of gauge difference.
MM_PER_STITCH = 0.5
# Difference (sts/10cm) at/below which we call it on-gauge.
ON_GAUGE_TOLERANCE = 0.5


@dataclass
class TensionDiagnosis:
    problem: str          # "too_tight" | "too_loose" | "on_gauge"
    severity: str         # "none" | "minor" | "moderate" | "major"
    difference_sts: float # actual - target, per 10cm
    needle_change_mm: float  # signed: +up, -down; 0 if on gauge
    size_factor: float    # finished width as fraction of intended if unchanged
    size_delta_pct: float # +larger / -smaller, percent
    fix: str
    inputs: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)

    def summary(self) -> str:
        if self.problem == "on_gauge":
            return (
                f"Your gauge is on target ({self.inputs['actual']} vs "
                f"{self.inputs['target']} sts/10cm) — no change needed."
            )
        direction = "up" if self.needle_change_mm > 0 else "down"
        return (
            f"You are knitting {self.problem.replace('_', ' ')} "
            f"({self.inputs['actual']} vs target {self.inputs['target']} sts/10cm, "
            f"{self.severity}). Left unchanged the piece would be about "
            f"{abs(self.size_delta_pct)}% {'smaller' if self.size_delta_pct < 0 else 'larger'} "
            f"than intended. Fix: go {direction} ~{abs(self.needle_change_mm)} mm in needle size."
        )


def _severity(abs_diff: float) -> str:
    if abs_diff <= ON_GAUGE_TOLERANCE:
        return "none"
    if abs_diff <= 2:
        return "minor"
    if abs_diff <= 4:
        return "moderate"
    return "major"


def diagnose_tension(target_sts_per_10cm: float, actual_sts_per_10cm: float) -> TensionDiagnosis:
    """Diagnose a gauge mismatch. Raises ValueError on non-positive gauges."""
    if target_sts_per_10cm is None or actual_sts_per_10cm is None:
        raise ValueError("Both target and actual gauge are required.")
    if target_sts_per_10cm <= 0 or actual_sts_per_10cm <= 0:
        raise ValueError("Gauges must be positive stitches per 10cm.")

    diff = actual_sts_per_10cm - target_sts_per_10cm   # +ve => too tight
    abs_diff = abs(diff)
    severity = _severity(abs_diff)

    if severity == "none":
        problem = "on_gauge"
        needle_change_mm = 0.0
        fix = "Your gauge matches — carry on with your current needles."
    elif diff > 0:
        problem = "too_tight"
        needle_change_mm = round(MM_PER_STITCH * round(abs_diff), 2)   # go up
        fix = f"Go up about {needle_change_mm} mm in needle size and re-swatch."
    else:
        problem = "too_loose"
        needle_change_mm = -round(MM_PER_STITCH * round(abs_diff), 2)  # go down
        fix = f"Go down about {abs(needle_change_mm)} mm in needle size and re-swatch."

    size_factor = target_sts_per_10cm / actual_sts_per_10cm
    size_delta_pct = round((size_factor - 1) * 100, 1)

    return TensionDiagnosis(
        problem=problem,
        severity=severity,
        difference_sts=round(diff, 2),
        needle_change_mm=needle_change_mm,
        size_factor=round(size_factor, 4),
        size_delta_pct=size_delta_pct,
        fix=fix,
        inputs={"target": target_sts_per_10cm, "actual": actual_sts_per_10cm},
    )
