#!/usr/bin/env python3
"""Command-line interface for the knitting calculators.

Runs with plain Python 3 — no third-party dependencies, no API key.

Examples
--------
  python cli.py yarn --width 50 --height 60 --weight dk --stitch stockinette
  python cli.py needle --weight worsted --project scarf --fabric drapey
  python cli.py tension --target 22 --actual 24
  python cli.py yarn --width 50 --height 60 --weight dk --json

Add --json to any subcommand to print the full structured result (numbers plus
the assumptions used), which is what the AI assistant consumes.
"""

import argparse
import json
import sys

from knit_calc import estimate_yarn, recommend_needle, diagnose_tension


def _emit(result, as_json: bool):
    if as_json:
        print(json.dumps(result.to_dict(), indent=2))
    else:
        print(result.summary())


def cmd_yarn(args) -> int:
    result = estimate_yarn(
        width_cm=args.width,
        height_cm=args.height,
        weight=args.weight,
        stitch=args.stitch,
        gauge_sts_per_10cm=args.gauge,
        metres_per_ball=args.metres_per_ball,
        safety=args.safety,
    )
    _emit(result, args.json)
    return 0


def cmd_needle(args) -> int:
    result = recommend_needle(
        weight=args.weight,
        project_type=args.project,
        fabric=args.fabric,
    )
    _emit(result, args.json)
    return 0


def cmd_tension(args) -> int:
    result = diagnose_tension(
        target_sts_per_10cm=args.target,
        actual_sts_per_10cm=args.actual,
    )
    _emit(result, args.json)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="knit-calc",
        description="Deterministic knitting calculators (yarn, needles, tension).",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    def add_json(p):
        p.add_argument("--json", action="store_true", help="print full structured JSON result")

    p_yarn = sub.add_parser("yarn", help="estimate yarn quantity")
    add_json(p_yarn)
    p_yarn.add_argument("--width", type=float, required=True, help="width in cm")
    p_yarn.add_argument("--height", type=float, required=True, help="height in cm")
    p_yarn.add_argument("--weight", required=True, help="yarn weight (e.g. dk, worsted, lace, 4)")
    p_yarn.add_argument("--stitch", default="stockinette", help="stitch pattern (default: stockinette)")
    p_yarn.add_argument("--gauge", type=float, default=None, help="your gauge in sts/10cm (optional)")
    p_yarn.add_argument("--metres-per-ball", type=float, default=None, help="override metres per ball")
    p_yarn.add_argument("--safety", type=float, default=0.10, help="safety margin, e.g. 0.10 for 10%%")
    p_yarn.set_defaults(func=cmd_yarn)

    p_needle = sub.add_parser("needle", help="recommend a needle size")
    add_json(p_needle)
    p_needle.add_argument("--weight", required=True, help="yarn weight (e.g. dk, worsted, 4)")
    p_needle.add_argument("--project", default=None, help="project type (e.g. scarf, socks) — advisory")
    p_needle.add_argument("--fabric", default="balanced", choices=["firm", "balanced", "drapey"])
    p_needle.set_defaults(func=cmd_needle)

    p_tension = sub.add_parser("tension", help="diagnose a gauge mismatch")
    add_json(p_tension)
    p_tension.add_argument("--target", type=float, required=True, help="pattern gauge, sts/10cm")
    p_tension.add_argument("--actual", type=float, required=True, help="your swatch gauge, sts/10cm")
    p_tension.set_defaults(func=cmd_tension)

    return parser


def main(argv=None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except ValueError as exc:
        # Calculators raise ValueError on inputs they cannot handle. The CLI
        # surfaces that plainly instead of crashing — mirroring the assistant's
        # "say so rather than guess" behaviour.
        print(f"Cannot compute: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
