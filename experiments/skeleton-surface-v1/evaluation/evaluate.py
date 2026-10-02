#!/usr/bin/env python3
"""Evaluate an already frozen controller. Contains only synthetic input.

This measures the interpretation HTTP request, NOT model construction, glyph
placement or the first rendered frame. Rendering must be measured separately.
"""
from __future__ import annotations
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
import statistics
import time
import urllib.error
import urllib.request


def quantile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = (len(ordered) - 1) * p
    lower = math.floor(index)
    upper = math.ceil(index)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower)


def numeric_attributes(spec: object) -> dict:
    if not isinstance(spec, dict):
        return {}
    nested = spec.get("params")
    return nested if isinstance(nested, dict) else spec


def score(case: dict, output: dict, error: str | None) -> dict:
    spec = output.get("spec")
    actual_family = spec.get("family") if isinstance(spec, dict) else None
    contract_ok = error is None and "spec" in output and (spec is None or (isinstance(spec, dict) and actual_family in {"vase", "sword", "mobius", "ring", "sphere", "cube"}))
    family_ok = contract_ok and actual_family == case["expectedFamily"]
    checks = {}
    attributes = numeric_attributes(spec)
    for key, condition in case.get("attributes", {}).items():
        value = attributes.get(key)
        numeric = isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
        ok = numeric
        if numeric:
            ok = all([
                "min" not in condition or value >= condition["min"],
                "max" not in condition or value <= condition["max"],
                "minAbs" not in condition or abs(value) >= condition["minAbs"],
            ])
        checks[key] = {"actual": value, "expected": condition, "pass": bool(ok)}
    attributes_ok = all(item["pass"] for item in checks.values())
    return {"contractPass": contract_ok, "actualFamily": actual_family,
            "familyPass": family_ok, "attributeChecks": checks,
            "attributePass": attributes_ok,
            "meaningPass": family_ok and attributes_ok}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:4213/interpret")
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--revision", required=True, help="Controller revision supplied before this run")
    parser.add_argument("--fixture", type=Path, default=Path(__file__).with_name("fixture.json"))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    fixture_bytes = args.fixture.read_bytes()
    fixture_sha = hashlib.sha256(fixture_bytes).hexdigest()
    expected_sha = args.fixture.with_suffix(".sha256").read_text().split()[0]
    if fixture_sha != expected_sha:
        raise SystemExit("Fixture hash changed: refusing evaluation.")
    fixture = json.loads(fixture_bytes)
    rows = []
    for case in fixture["cases"]:
        request = urllib.request.Request(args.url, data=json.dumps({"text": case["text"]}).encode(), headers={"Content-Type": "application/json"}, method="POST")
        start = time.perf_counter()
        output = {}
        error = None
        try:
            with urllib.request.urlopen(request, timeout=35) as response:
                output = json.load(response)
            if not isinstance(output, dict):
                error = "Response is not a JSON object"
                output = {}
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            error = f"{type(exc).__name__}: {exc}"
        elapsed_ms = (time.perf_counter() - start) * 1000
        rows.append({"id": case["id"], "group": case["group"], "httpMs": round(elapsed_ms, 3), "output": output, "error": error, **score(case, output, error)})
        print(f"{case['id']}: {'PASS' if rows[-1]['meaningPass'] else 'FAIL'} {elapsed_ms:.1f} ms", flush=True)
    groups = {}
    for group in sorted(set(row["group"] for row in rows)):
        subset = [row for row in rows if row["group"] == group]
        groups[group] = {"cases": len(subset), "familyPass": sum(row["familyPass"] for row in subset), "meaningPass": sum(row["meaningPass"] for row in subset)}
    attribute_rows = [row for row in rows if row["attributeChecks"]]
    all_checks = [check for row in attribute_rows for check in row["attributeChecks"].values()]
    latencies = [row["httpMs"] for row in rows if row["error"] is None]
    model_times = [row["output"]["modelMs"] for row in rows if isinstance(row["output"].get("modelMs"), (int, float))]
    summary = {"cases": len(rows), "contractPass": sum(row["contractPass"] for row in rows),
        "familyPass": sum(row["familyPass"] for row in rows), "meaningPass": sum(row["meaningPass"] for row in rows),
        "attributeCases": len(attribute_rows), "attributeCasePass": sum(row["attributePass"] for row in attribute_rows),
        "attributeConditions": len(all_checks), "attributeConditionPass": sum(check["pass"] for check in all_checks),
        "sources": dict(collections.Counter(row["output"].get("source", "missing") for row in rows)), "groups": groups,
        "httpP50Ms": quantile(latencies, .5), "httpP95Ms": quantile(latencies, .95),
        "reportedModelP50Ms": quantile(model_times, .5), "reportedModelP95Ms": quantile(model_times, .95),
        "interpretationOver10s": sum(value > 10000 for value in latencies),
        "interpretationOver30s": sum(value > 30000 for value in latencies),
        "endToEndGenerationMeasured": False,
        "timingCaveat": "HTTP interpretation only. Scaffold/surface generation, glyph mapping, first rendered frame, and animation completion are excluded. Not a 16GB laptop measurement."}
    report = {"runId": args.run_id, "revision": args.revision, "fixtureSha256": fixture_sha,
        "evaluationUse": "First run is independent evaluation; any tuning after seeing it makes later runs regression only.",
        "quantileMethod": "Linear interpolation at (n-1)*p.", "summary": summary, "rows": rows}
    output_path = args.output or Path(__file__).with_name(f"{args.run_id}.json")
    if output_path.exists():
        raise SystemExit("Refusing to overwrite a prior evaluation run.")
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
