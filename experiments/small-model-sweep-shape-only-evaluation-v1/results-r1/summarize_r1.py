"""Summarize frozen fresh36 scores and immutable completed runtime records.

No model calls. Preserve source files and refuse to overwrite an existing report.
"""
import hashlib
import json
import math
from pathlib import Path
import statistics

HERE = Path(__file__).resolve().parent
EVAL = HERE.parent
REPO = EVAL.parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    selection_path = REPO / "experiments/small-model-sweep-shape-only-v1/SELECTION-R1.json"
    selection = json.loads(selection_path.read_text())
    records = []
    for model_id in selection["selected_ids"]:
        folder = HERE / model_id
        score_path = folder / "score-r1.json"
        provenance_path = folder / "provenance-r1.json"
        score = json.loads(score_path.read_text())
        provenance = json.loads(provenance_path.read_text())
        summary_path = REPO / "experiments/small-model-sweep-shape-only-v1/results" / provenance["label"] / "summary.json"
        summary = json.loads(summary_path.read_text())
        response_path = REPO / ".local/small-model-sweep-v1/raw-shape-only" / provenance["label"] / "responses.jsonl"
        checks = {
            "fixture": sha(EVAL / "cases-r1.json") == provenance["fixture_sha256"] == score["fixture_sha256"],
            "scorer": sha(EVAL / "score_r1.py") == provenance["scorer_sha256"] == score["scorer_sha256"],
            "selection": sha(selection_path) == provenance["selection_sha256"],
            "summary": sha(summary_path) == provenance["summary_sha256"],
            "original_responses": sha(response_path) == provenance["responses_sha256"] == score["responses_sha256"],
            "stable_after_score": provenance["inputs_unchanged_after_score"],
            "completed": summary["status"] == "completed" and summary["shutdown"]["exit_code"] == 0,
            "input_integrity": score["input_integrity_ok"],
        }
        if not all(checks.values()):
            raise RuntimeError("source_integrity_failure: " + model_id)
        times = sorted(row["seconds"] for row in summary["cases"] if row["status"] == "reply")
        if len(times) != 36:
            raise RuntimeError("incomplete_primary_replies: " + model_id)
        records.append({
            "model_id": model_id,
            "label": provenance["label"],
            "exact": score["exact"], "count": score["count"],
            "contract_ok": score["contract_ok"],
            "positive_exact": score["positive_exact"], "positive_count": score["positive_count"],
            "hold_exact": score["hold_exact"], "hold_count": score["hold_count"],
            "false_proposals_on_hold": score["false_proposals_on_hold"],
            "by_group": score["by_group"], "statuses": score["statuses"],
            "model_file_bytes": summary["model_file_bytes"],
            "server_rss_peak_bytes_sampled": summary["peak_server_rss_bytes_sampled"],
            "server_rss_last_bytes_sampled": summary["last_server_rss_bytes_sampled"],
            "startup_seconds_after_prehash": summary["startup_seconds"],
            "preflight_hash_seconds": summary["preflight_hash_seconds"],
            "query_seconds_median": statistics.median(times),
            "query_seconds_p95_nearest_rank": times[math.ceil(0.95 * len(times)) - 1],
            "query_seconds_max": max(times),
            "reply_count": len(times), "shutdown": summary["shutdown"],
            "score_sha256": sha(score_path), "provenance_sha256": sha(provenance_path),
            "summary_sha256": sha(summary_path), "responses_sha256": score["responses_sha256"],
            "integrity_checks": checks,
        })
    output = {
        "version": "shape-only-fresh36-comparison-r1",
        "source": "Frozen independent Japanese artificial cases; one sequential run per artifact",
        "contract": "exact action/shape only; finite 12 shapes; hold -> null; propose -> supported shape",
        "selection_timing": "Chosen after R1 diagnosis, before fresh36 outputs; not a preregistration before R1",
        "scope_exclusions": ["R1-to-R2 controlled improvement", "attribute extraction accuracy", "unknown mesh generation", "whole-widget memory/CPU", "actual 16GB laptop", "global OS input", "human preference"],
        "resource_notes": ["CPU threads 4, context 2048, max output 256, prompt cache off", "RSS: owned server only; sampled every 250ms; instantaneous peaks can be missed", "Startup follows full model/runtime hashing; not a controlled cold-cache result", "Query is full HTTP reply time, not decode-only tok/s or input-to-visible-formation", "No timeout or runtime failure occurred in these six completed runs", "This independent reviewer started no model/server and downloaded no models"],
        "metric_definitions": {"query_p95": "Nearest-rank p95 over 36 full reply durations", "model_file_bytes": "Stored artifact size, not resident RAM"},
        "fixture_sha256": records and json.loads((HERE / selection["selected_ids"][0] / "score-r1.json").read_text())["fixture_sha256"],
        "scorer_sha256": sha(EVAL / "score_r1.py"), "selection_sha256": sha(selection_path),
        "records": records,
    }
    with (HERE / "COMPARISON-R1.json").open("x") as handle:
        handle.write(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"records": len(records), "all_integrity_checks": True, "output": "COMPARISON-R1.json"}))


if __name__ == "__main__":
    main()
