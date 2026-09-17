"""Deterministic knitting calculators.

Pure-Python, no third-party dependencies, fully tested. These functions are the
single source of truth for every number the AI assistant reports.
"""

from .yarn import estimate_yarn, YarnEstimate
from .needles import recommend_needle, NeedleRecommendation
from .tension import diagnose_tension, TensionDiagnosis
from .data import YARN_WEIGHTS, resolve_weight

__all__ = [
    "estimate_yarn",
    "YarnEstimate",
    "recommend_needle",
    "NeedleRecommendation",
    "diagnose_tension",
    "TensionDiagnosis",
    "YARN_WEIGHTS",
    "resolve_weight",
]

__version__ = "0.1.0"
