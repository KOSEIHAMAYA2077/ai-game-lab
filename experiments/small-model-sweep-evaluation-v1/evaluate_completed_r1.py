#!/usr/bin/env python3
"""Aggregate completed saved runs; model calls and expectation edits are absent."""
import argparse
import datetime
import hashlib
import importlib.util
import json
import math
import pathlib
import statistics
from collections import Counter

BASE = pathlib.Path(__file__).resolve().parent
REPO = BASE.parents[1]
RESULTS = REPO / "experiments/small-model-sweep-v1/results"
RAW = REPO / ".local/small-model-sweep-v1/raw"
DEST = BASE / "results-r1"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save_new(path, value):
    with path.open("x", encoding="utf-8") as handle:
        handle.write(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n")


def timing(values):
    values = sorted(x for x in values if type(x) in (int, float) and math.isfinite(x) and x >= 0)
    if not values:
        return {"count": 0, "median_seconds": None, "p95_nearest_rank_seconds": None, "max_seconds": None}
    return {"count": len(values), "median_seconds": statistics.median(values), "p95_nearest_rank_seconds": values[math.ceil(0.95 * len(values)) - 1], "max_seconds": values[-1]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", required=True)
    args = parser.parse_args()
    if not args.snapshot.replace("-", "").isalnum():
        parser.error("snapshot must contain letters, digits, and hyphens only")
    DEST.mkdir(exist_ok=True)
    spec = importlib.util.spec_from_file_location("frozen_sweep_score", BASE / "score.py")
    scorer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(scorer)
    freeze = json.loads((BASE / "FREEZE-R1.json").read_text())
    for entry in freeze["files"]:
        if sha(BASE / entry["path"]) != entry["sha256"]:
            raise ValueError("frozen evaluation changed: " + entry["path"])
    labels = []
    deferred = []
    for summary_path in sorted(RESULTS.glob("*/summary.json")):
        label = summary_path.parent.name
        summary_sha = sha(summary_path)
        summary = json.loads(summary_path.read_text())
        if summary.get("status") in {"running", "not_started"} or "shutdown" not in summary:
            deferred.append({"label": label, "reason": "run not finalized"})
            continue
        raw_path = RAW / label / "responses.jsonl"
        if not raw_path.is_file():
            deferred.append({"label": label, "reason": "final raw JSONL missing"})
            continue
        raw_sha = sha(raw_path)
        score_path = DEST / (label + "-score.json")
        context_path = DEST / (label + "-context.json")
        if score_path.exists() or context_path.exists():
            if not score_path.exists() or not context_path.exists():
                raise ValueError("incomplete prior aggregation; do not overwrite: " + label)
            result = json.loads(score_path.read_text())
            context = json.loads(context_path.read_text())
            if result["raw_sha256"] != raw_sha or context["summary_sha256"] != summary_sha:
                raise ValueError("final run changed after scoring: " + label)
        else:
            if summary["fixture_sha256"] != sha(BASE / "cases-r1.json"):
                raise ValueError("run fixture differs from frozen fixture: " + label)
            if summary["prompt_sha256"] != freeze["prompt_sha256_reported_by_root"]:
                raise ValueError("run prompt differs from reported frozen prompt: " + label)
            result = scorer.score(BASE / "cases-r1.json", raw_path)
            if summary_sha != sha(summary_path) or raw_sha != sha(raw_path):
                raise ValueError("run was modified during read: " + label)
            rows = summary["cases"]
            statuses = Counter(row["status"] for row in rows)
            http = Counter(str(row.get("http_status")) for row in rows)
            finish = Counter(str(row.get("finish_reason")) for row in rows)
            reply_rows = [row for row in rows if row["status"] == "reply" and row.get("http_status") == 200]
            runtime_only = not reply_rows
            if summary.get("startup_seconds") is None and runtime_only:
                interpretation = "no_semantic_reply_startup_or_runtime_failure"
            elif runtime_only:
                interpretation = "no_semantic_reply_transport_grammar_or_runtime_failure"
            elif summary["unattempted_case_ids"]:
                interpretation = "partial_model_replies_remaining_cases_unattempted"
            else:
                interpretation = "all_cases_attempted_saved_reply_contract_comparison"
            context = {
                "version": "saved-run-independent-context-r1", "label": label,
                "reviewed_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "source_summary_path": str(summary_path.relative_to(REPO)),
                "summary_sha256": summary_sha, "raw_sha256": raw_sha,
                "evaluation_freeze_sha256": sha(BASE / "FREEZE-R1.json"),
                "primary_scorer_sha256": sha(BASE / "score.py"),
                "aggregation_helper_sha256": sha(pathlib.Path(__file__)),
                "model_calls_by_reviewer": 0, "runtime_status": summary["status"],
                "failure_type": summary.get("failure_type"), "shutdown": summary["shutdown"],
                "fixed_fixture_count": 24, "attempted_case_count": len(rows),
                "unattempted_case_ids": summary["unattempted_case_ids"],
                "status_counts": dict(statuses), "http_status_counts": dict(http),
                "finish_reason_counts": dict(finish),
                "length_finish_count": finish["length"],
                "http_500_count": http["500"],
                "driver_json_ok_count": sum(bool(row["json_ok"]) for row in rows),
                "driver_contract_ok_count": sum(bool(row["contract_ok"]) for row in rows),
                "independent_schema_valid_count": result["schema_valid"],
                "strict_all_field_exact_count": result["exact"],
                "interpretation": interpretation,
                "reply_http200_latency": timing([row.get("seconds") for row in reply_rows]),
                "attempt_latency_including_errors": timing([row.get("seconds") for row in rows]),
                "startup_seconds": summary.get("startup_seconds"),
                "sampled_peak_server_rss_bytes": summary.get("peak_server_rss_bytes_sampled"),
                "model_file_bytes": summary["model_file_bytes"],
                "model_file_sha256": summary["model_file_sha256"],
                "runtime_binary_sha256": summary["runtime_binary_sha256"],
                "driver_sha256": summary["driver_sha256"],
                "notes": [
                    "Fixed24 exact score counts unavailable/unattempted cases as zero; interpretation preserves whether a model actually replied.",
                    "HTTP500/loader/runtime/grammar errors are not observed semantic wrong answers.",
                    "Driver JSON and contract flags are separated from strict independent all-field correctness.",
                    "Query latency excludes server/model startup, rendering and download; sampled server RSS excludes UI/driver/OS.",
                    "This context helper was written after seeing the first completed summary, but the fixture/expectations/primary scorer and methods remain frozen."
                ]
            }
            save_new(score_path, result)
            save_new(context_path, context)
        labels.append({"label": label, "runtime_status": context["runtime_status"],
                       "interpretation": context["interpretation"],
                       "strict_schema": result["schema_valid"], "exact": result["exact"],
                       "denominator": result["denominator"], "groups": result["by_group"],
                       "false_propose_valid_schema": result["false_propose_valid_schema"],
                       "unattempted": len(context["unattempted_case_ids"]),
                       "finish_length": context["length_finish_count"], "http500": context["http_500_count"],
                       "reply_latency": context["reply_http200_latency"],
                       "startup_seconds": context["startup_seconds"],
                       "sampled_server_rss_bytes": context["sampled_peak_server_rss_bytes"],
                       "score_sha256": sha(score_path), "context_sha256": sha(context_path)})
    snapshot = {"version": "saved-run-evaluation-checkpoint-r1",
                "created_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "model_calls_by_reviewer": 0, "evaluation_freeze_sha256": sha(BASE / "FREEZE-R1.json"),
                "finalized_runs_scored": len(labels), "runs": labels, "deferred": deferred}
    save_new(DEST / (args.snapshot + ".json"), snapshot)
    print(json.dumps(snapshot, ensure_ascii=False))


if __name__ == "__main__":
    main()
