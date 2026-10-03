"""Read completed owned-server snapshots and score exact original JSONL.

No model/server start, no downloads, no changes to fixture/prompt/scorer.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
FIXTURE_SHA = "f47ab6eaaba1ebb498cb0e537a36ccd5cb83f80a241238e2656ba0bc6a57f54b"
PROMPT_SHA = "0fdab64e6085dce23af280feaee733dc4581f973e8cad4164a0a3244a9e01501"
DRIVER_SHA = "d1dbbca277ae895ce8f2ed7441b589455a14e503bc2ed29672b6eb3d9596dcc7"
SCORER_SHA = "43e5dec3f5ac9721d2c727aaa8f2ea3d3de2c1dfbb41cc2205c4f8daa0ba09fa"
TERMINAL = {"completed", "failed", "startup_failed", "startup_timeout",
            "query_timeout", "batch_timeout", "response_limit", "transport_error", "interrupted"}


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def collect(public_base, private_base):
    selection_path = REPO / "experiments/small-model-sweep-shape-only-v1/SELECTION-R1.json"
    selection = json.loads(selection_path.read_text())
    if sha256(ROOT / "cases-r1.json") != FIXTURE_SHA or sha256(ROOT / "score_r1.py") != SCORER_SHA:
        raise RuntimeError("fixed_fixture_or_scorer_changed")
    selected = selection["selected_ids"]
    review = []
    for model_id in selected:
        label = model_id + "-shape-only-r1"
        summary_path = public_base / label / "summary.json"
        response_path = private_base / label / "responses.jsonl"
        outdir = ROOT / "results-r1" / model_id
        if not summary_path.exists():
            review.append({"model_id": model_id, "state": "not_finished"})
            continue
        summary_bytes = summary_path.read_bytes()
        summary = json.loads(summary_bytes)
        if summary.get("status") not in TERMINAL or "shutdown" not in summary or not response_path.exists():
            review.append({"model_id": model_id, "state": "not_finished"})
            continue
        pins = {"fixture_sha256": FIXTURE_SHA, "prompt_sha256": PROMPT_SHA, "driver_sha256": DRIVER_SHA}
        if any(summary.get(key) != value for key, value in pins.items()) or summary.get("label") != label:
            review.append({"model_id": model_id, "state": "candidate_pin_mismatch"})
            continue
        raw_sha = sha256(response_path)
        summary_sha = hashlib.sha256(summary_bytes).hexdigest()
        if summary_path.read_bytes() != summary_bytes:
            review.append({"model_id": model_id, "state": "summary_changed_during_read"})
            continue
        score_path = outdir / "score-r1.json"
        provenance_path = outdir / "provenance-r1.json"
        if score_path.exists():
            previous = json.loads(score_path.read_text())
            if previous.get("responses_sha256") != raw_sha or not provenance_path.exists():
                review.append({"model_id": model_id, "state": "existing_result_pin_mismatch"})
                continue
            review.append({"model_id": model_id, "state": "already_scored"})
            continue
        outdir.mkdir(parents=True, exist_ok=True)
        call = subprocess.run([sys.executable, str(ROOT / "score_r1.py"),
                               "--fixture", str(ROOT / "cases-r1.json"),
                               "--responses", str(response_path), "--out", str(score_path)],
                              capture_output=True, text=True, timeout=15)
        if call.returncode != 0 or not score_path.exists():
            review.append({"model_id": model_id, "state": "scorer_execution_failed", "exit_code": call.returncode})
            continue
        scored = json.loads(score_path.read_text())
        stable = (sha256(response_path) == raw_sha and summary_path.read_bytes() == summary_bytes
                  and sha256(ROOT / "cases-r1.json") == FIXTURE_SHA
                  and sha256(ROOT / "score_r1.py") == SCORER_SHA)
        provenance = {"version": "shape-only-result-provenance-r1", "model_id": model_id,
                      "label": label, "summary_sha256": summary_sha,
                      "responses_sha256": raw_sha, "fixture_sha256": FIXTURE_SHA,
                      "prompt_sha256": PROMPT_SHA, "driver_sha256": DRIVER_SHA,
                      "scorer_sha256": SCORER_SHA, "selection_sha256": sha256(selection_path),
                      "inputs_unchanged_after_score": stable,
                      "pipeline_terminal_status": summary["status"],
                      "shutdown": summary["shutdown"],
                      "count": scored["count"], "exact": scored["exact"],
                      "model_or_server_calls_by_reviewer": 0,
                      "scope": "Fresh36 shape/action only, not R1-five-field improvement, widget resource adoption, global OS input or unknown mesh generation"}
        provenance_path.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n")
        review.append({"model_id": model_id, "state": "scored" if stable else "input_drift", "exact": scored["exact"], "count": scored["count"]})
    return review


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--public-base", type=Path, default=REPO / "experiments/small-model-sweep-shape-only-v1/results")
    parser.add_argument("--private-base", type=Path, default=REPO / ".local/small-model-sweep-v1/raw-shape-only")
    args = parser.parse_args()
    print(json.dumps(collect(args.public_base, args.private_base), ensure_ascii=False))


if __name__ == "__main__":
    main()
