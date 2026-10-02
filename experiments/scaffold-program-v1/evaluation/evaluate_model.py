#!/usr/bin/env python3
"""Independent evaluation of the frozen CPU controller; synthetic text only."""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import importlib
import json
from pathlib import Path
import resource
import sys
import time
from score import score, summarize

FROZEN = {
    "config.py": "2fcb626834d1043262a099fd8d9014cdb2516068f77c93e38179701b178ac35a",
    "predict.py": "b1d48e1666e723e61e106176fdf60aebb245d5973d06bcbbd50855c78a89b721",
    "relation-head.json": "2b5e212a7b8fec5cbf9683620ba7883c77e74140ccb65a1e91bc5ca1f5618a87",
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--run-id", default="initial-cpu")
    parser.add_argument("--fixtures", nargs="+", default=["fixture.json", "same-type-fixture.json"])
    parser.add_argument("--evaluation-use", default=None)
    parser.add_argument("--allow-regression", action="store_true", help="Allow changed controller; explicitly report regression.")
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    model_code = directory.parent / "model"
    revisions = {name: sha(model_code / name) for name in FROZEN}
    if not args.allow_regression and revisions != FROZEN:
        raise SystemExit("Controller hashes differ from frozen-ready revision; evaluation refused.")
    fixture_paths = [directory / name for name in args.fixtures]
    fixtures = []
    for path in fixture_paths:
        expected_sha = path.with_suffix(".sha256").read_text().split()[0]
        if sha(path) != expected_sha:
            raise SystemExit("Fixture changed; refusing evaluation.")
        data = json.loads(path.read_text())
        fixtures.append((path.name, expected_sha, data["cases"]))
    data_texts = {}
    for dataset in ["training.jsonl", "validation.jsonl"]:
        path = model_code / dataset
        data_texts[dataset] = {json.loads(line)["text"].strip().casefold() for line in path.read_text().splitlines() if line}
    overlap = {name: {dataset: [case["id"] for case in cases if case["text"].strip().casefold() in texts] for dataset, texts in data_texts.items()} for name, _, cases in fixtures}
    sys.path.insert(0, str(model_code))
    module = importlib.import_module("predict")
    before_load = time.perf_counter()
    model = module.ProgramModel(args.model_dir)
    preparation_ms = (time.perf_counter() - before_load) * 1000
    groups = []
    for fixture_name, fixture_sha, cases in fixtures:
        rows = []
        for case in cases:
            before = time.perf_counter()
            error = None
            try:
                output = model.interpret(case["text"])
            except Exception as exc:
                output = {}
                error = type(exc).__name__  # Avoid exposing machine-specific paths.
            elapsed_ms = (time.perf_counter() - before) * 1000
            row = {"id": case["id"], "group": case["group"], "wallMs": elapsed_ms, "output": output, "error": error, **score(case, output, error)}
            rows.append(row)
            print(f"{case['id']}: {'PASS' if row['meaningPass'] else 'FAIL'} {elapsed_ms:.3f}ms", flush=True)
        groups.append({"fixture": fixture_name, "fixtureSha256": fixture_sha, "summary": summarize(rows), "rows": rows})
    observed = {name: sha(model_code / name) for name in FROZEN}
    unchanged = observed == revisions
    usage = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    rss_mib = usage / (1024 ** 2) if sys.platform == "darwin" else usage / 1024
    report = {"runId": args.run_id, "evaluationUse": args.evaluation_use or ("Regression after first evaluation" if args.allow_regression else "First independent frozen evaluation"), "controllerHashes": revisions,
              "controllerUnchangedDuringRun": unchanged, "exactTextOverlap": overlap,
              "preparationMs": preparation_ms, "selfProcessPeakRssMiB": rss_mib,
              "provider": "CPUExecutionProvider", "inputStoresOrExternalSending": False,
              "timingScope": "Model controller only: interpretation and finite Program. Geometry construction, glyph placement, rendering and absorption excluded. Model preparation measured separately. M5 32GB, not a 16GB laptop test.",
              "fixtures": groups}
    destination = directory / f"{args.run_id}.json"
    if destination.exists():
        raise SystemExit("Refusing to overwrite an evaluation result.")
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    for group in groups:
        print(group["fixture"], json.dumps(group["summary"], ensure_ascii=False, indent=2))
    print(json.dumps({"preparationMs": preparation_ms, "selfProcessPeakRssMiB": rss_mib, "exactTextOverlap": overlap, "controllerUnchangedDuringRun": unchanged}))


if __name__ == "__main__":
    main()
