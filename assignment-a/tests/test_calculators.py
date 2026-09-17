"""Unit tests for the deterministic calculators.

These lock the numeric behaviour that the assistant relies on. Run with:
    cd assignment-a && python -m pytest
"""

import math

import pytest

from knit_calc import estimate_yarn, recommend_needle, diagnose_tension
from knit_calc.data import resolve_weight


# --------------------------------------------------------------------------- #
# Yarn quantity
# --------------------------------------------------------------------------- #

def test_yarn_reference_dk_blanket():
    # 50 x 60 cm DK stockinette: area 3000 cm2 * 0.20 m/cm2 * 1.0 * 1.0 = 600 m.
    r = estimate_yarn(width_cm=50, height_cm=60, weight="dk", stitch="stockinette", safety=0.10)
    assert r.metres == 600
    assert r.metres_with_safety == 660          # +10%
    assert r.balls == math.ceil(660 / 120)      # 120 m/ball -> 6 balls
    assert r.balls == 6


def test_yarn_weight_aliases_agree():
    # "dk", "light" and the CYC number "3" are the same weight.
    a = estimate_yarn(30, 30, "dk")
    b = estimate_yarn(30, 30, "light")
    c = estimate_yarn(30, 30, "3")
    assert a.metres == b.metres == c.metres


def test_yarn_cable_uses_more_than_stockinette():
    plain = estimate_yarn(40, 40, "worsted", stitch="stockinette")
    cable = estimate_yarn(40, 40, "worsted", stitch="cable")
    assert cable.metres > plain.metres


def test_yarn_lace_pattern_uses_less():
    plain = estimate_yarn(40, 40, "worsted", stitch="stockinette")
    lace = estimate_yarn(40, 40, "worsted", stitch="lace")
    assert lace.metres < plain.metres


def test_yarn_finer_weight_needs_more_metres():
    # Same size: finer yarn should require more metres than a heavier one.
    lace = estimate_yarn(40, 40, "lace")
    bulky = estimate_yarn(40, 40, "bulky")
    assert lace.metres > bulky.metres


def test_yarn_scales_with_area():
    small = estimate_yarn(20, 20, "worsted")
    big = estimate_yarn(40, 40, "worsted")   # 4x the area
    assert big.metres == pytest.approx(small.metres * 4, rel=0.01)


def test_yarn_tighter_gauge_uses_more():
    typical = resolve_weight("worsted").typical_gauge
    loose = estimate_yarn(40, 40, "worsted", gauge_sts_per_10cm=typical - 4)
    tight = estimate_yarn(40, 40, "worsted", gauge_sts_per_10cm=typical + 4)
    assert tight.metres > loose.metres


@pytest.mark.parametrize("w,h", [(0, 10), (10, 0), (-5, 10)])
def test_yarn_rejects_bad_dimensions(w, h):
    with pytest.raises(ValueError):
        estimate_yarn(w, h, "dk")


def test_yarn_rejects_unknown_weight():
    with pytest.raises(ValueError):
        estimate_yarn(30, 30, "spider silk")


# --------------------------------------------------------------------------- #
# Needle recommender
# --------------------------------------------------------------------------- #

def test_needle_worsted_balanced():
    r = recommend_needle("worsted", fabric="balanced")
    # Worsted range 4.5-5.5 mm, balanced midpoint = 5.0 mm -> US 8 / UK 6.
    assert r.metric_mm == 5.0
    assert r.us == "8"
    assert r.uk == "6"


def test_needle_firm_smaller_than_drapey():
    firm = recommend_needle("worsted", fabric="firm")
    drapey = recommend_needle("worsted", fabric="drapey")
    assert firm.metric_mm < drapey.metric_mm


def test_needle_all_systems_present():
    r = recommend_needle("dk")
    assert r.metric_mm > 0 and r.us and r.uk


def test_needle_project_note_for_socks():
    r = recommend_needle("super_fine", project_type="socks", fabric="balanced")
    assert r.note is not None and "firm" in r.note.lower()


def test_needle_rejects_bad_fabric():
    with pytest.raises(ValueError):
        recommend_needle("dk", fabric="squishy")


# --------------------------------------------------------------------------- #
# Tension troubleshooter
# --------------------------------------------------------------------------- #

def test_tension_too_tight_goes_up():
    # Brief's example: swatch 24 vs pattern 22 -> too tight -> go up.
    d = diagnose_tension(target_sts_per_10cm=22, actual_sts_per_10cm=24)
    assert d.problem == "too_tight"
    assert d.needle_change_mm > 0
    assert d.size_delta_pct < 0            # piece would come out smaller


def test_tension_too_loose_goes_down():
    d = diagnose_tension(target_sts_per_10cm=22, actual_sts_per_10cm=20)
    assert d.problem == "too_loose"
    assert d.needle_change_mm < 0
    assert d.size_delta_pct > 0            # piece would come out larger


def test_tension_on_gauge():
    d = diagnose_tension(target_sts_per_10cm=22, actual_sts_per_10cm=22)
    assert d.problem == "on_gauge"
    assert d.severity == "none"
    assert d.needle_change_mm == 0.0


def test_tension_severity_scales():
    minor = diagnose_tension(22, 23)
    major = diagnose_tension(22, 30)
    assert minor.severity == "minor"
    assert major.severity == "major"


@pytest.mark.parametrize("t,a", [(0, 22), (22, 0), (-1, 22)])
def test_tension_rejects_bad_gauge(t, a):
    with pytest.raises(ValueError):
        diagnose_tension(t, a)
