"""Score terminal resource runs with the unchanged shape-only scorer.

Read original files only; write new independent diagnostics. No model calls.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import statistics
import subprocess
import sys

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
EVAL = REPO / "experiments/small-model-sweep-shape-only-evaluation-v1"
PROMPT = REPO / "experiments/small-model-sweep-shape-only-v1/prompt-r2.json"
DRIVER = REPO / "experiments/small-model-sweep-resources-v1/run_r2.py"
FIXTURE_SHA = "f47ab6eaaba1ebb498cb0e537a36ccd5cb83f80a241238e2656ba0bc6a57f54b"
SCORER_SHA = "43e5dec3f5ac9721d2c727aaa8f2ea3d3de2c1dfbb41cc2205c4f8daa0ba09fa"
PROMPT_SHA = "0fdab64e6085dce23af280feaee733dc4581f973e8cad4164a0a3244a9e01501"
DRIVER_SHA = "f6a7d89e42ca124bb590cacff0ca22dc6b0d8a6fa9d6707e9804795618ca4714"
TARGETS = [
    ("bonsai-1.7b-q1", "bonsai-1.7b-q1-resources-r1"),
    ("bonsai-4b-q1", "bonsai-4b-q1-resources-idle-r1"),
]
TERMINAL = {"completed", "failed", "startup_failed", "startup_timeout", "query_timeout",
            "batch_timeout", "response_limit", "transport_error", "interrupted"}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def idle_check(summary, samples):
    idle = summary.get("idle")
    if idle is None:
        return {"status": "not_measured", "scope": "No idle run for this candidate"}
    required = ["elapsed_seconds", "cpu_start_seconds", "cpu_end_seconds", "cpu_delta_seconds", "cpu_percent_one_core", "started_batch_seconds", "rss_samples"]
    if any(key not in idle for key in required):
        return {"status": "incomplete", "reason": "Idle start saved without completed measurement"}
    numeric = all(finite(idle[k]) for k in required)
    elapsed = idle["elapsed_seconds"]
    if not numeric or elapsed <= 0 or idle["cpu_start_seconds"] < 0 or idle["cpu_end_seconds"] < idle["cpu_start_seconds"]:
        return {"status": "invalid_counter", "finite_numeric_fields": numeric}
    delta = idle["cpu_end_seconds"] - idle["cpu_start_seconds"]
    percent = delta / elapsed * 100
    after_start = [row["rss_bytes"] for row in samples
                   if row["seconds"] >= idle["started_batch_seconds"] and row["rss_bytes"] is not None]
    n = idle["rss_samples"]
    # Final saved samples can include shutdown. Idle aggregation preceded shutdown;
    # compare its first n samples, and record remaining samples separately.
    window = after_start[:n] if type(n) is int and n >= 0 else []
    checks = {
        "cpu_delta": math.isclose(delta, idle["cpu_delta_seconds"], abs_tol=1e-9),
        "cpu_percent": math.isclose(percent, idle["cpu_percent_one_core"], abs_tol=1e-9),
        "rss_sample_count": type(n) is int and n > 0 and len(window) == n,
        "rss_min": bool(window) and min(window) == idle.get("rss_min_bytes"),
        "rss_max": bool(window) and max(window) == idle.get("rss_max_bytes"),
        "rss_mean": bool(window) and finite(idle.get("mean_rss_bytes")) and math.isclose(sum(window) / len(window), idle["mean_rss_bytes"], abs_tol=1e-6),
    }
    return {
        "status": "complete_600_seconds" if elapsed >= 600 and all(checks.values()) else "truncated" if elapsed < 600 and all(checks.values()) else "aggregate_mismatch",
        "planned_seconds": idle.get("planned_seconds"), "elapsed_seconds": elapsed,
        "cpu_delta_seconds_recomputed": delta, "cpu_percent_one_core_recomputed": percent,
        "rss_min_bytes": min(window) if window else None,
        "rss_max_bytes": max(window) if window else None,
        "rss_mean_bytes": sum(window) / len(window) if window else None,
        "idle_rss_samples": len(window), "later_samples_excluded": max(0, len(after_start) - len(window)),
        "checks": checks, "scope": "Owned server user+system TIME, one core=100%; excludes UI, monitor and OS",
        "counter_interval_note": "Denominator includes start/end lsof/ps overhead. No energy, active CPU, unloaded idle or complete widget measurement.",
    }


def collect(public_base, private_base):
    for path, expected in [(EVAL / "cases-r1.json", FIXTURE_SHA), (EVAL / "score_r1.py", SCORER_SHA), (PROMPT, PROMPT_SHA), (DRIVER, DRIVER_SHA)]:
        if sha(path) != expected:
            raise RuntimeError("frozen_input_changed")
    states = []
    for model_id, label in TARGETS:
        summary_path = public_base / label / "summary.json"
        response_path = private_base / label / "responses.jsonl"
        rss_path = public_base / label / "rss-samples.json"
        if not summary_path.exists():
            states.append({"model_id": model_id, "state": "not_finished"})
            continue
        summary_bytes = summary_path.read_bytes()
        summary = json.loads(summary_bytes)
        if summary.get("status") not in TERMINAL or "shutdown" not in summary or not response_path.exists():
            states.append({"model_id": model_id, "state": "not_finished", "runtime_status": summary.get("status")})
            continue
        if summary.get("label") != label or any(summary.get(k) != v for k, v in {
            "fixture_sha256": FIXTURE_SHA, "prompt_sha256": PROMPT_SHA, "driver_sha256": DRIVER_SHA,
            "context_tokens": 1024, "max_output_tokens": 128, "threads": 4, "threads_batch": 4,
        }.items()):
            raise RuntimeError("resource_pin_mismatch: " + model_id)
        source_sha = {"summary_sha256": sha(summary_path), "responses_sha256": sha(response_path), "rss_samples_sha256": sha(rss_path)}
        baseline_summary_path = REPO / "experiments/small-model-sweep-shape-only-v1/results" / (model_id + "-shape-only-r1") / "summary.json"
        baseline_score_path = EVAL / "results-r1" / model_id / "score-r1.json"
        baseline_provenance_path = EVAL / "results-r1" / model_id / "provenance-r1.json"
        baseline = json.loads(baseline_summary_path.read_text())
        before = json.loads(baseline_score_path.read_text())
        original_pin = json.loads(baseline_provenance_path.read_text())
        same = {key: baseline.get(key) == summary.get(key) for key in ["model_file_sha256", "runtime_binary_sha256", "prompt_sha256", "fixture_sha256", "temperature", "seed", "threads", "threads_batch", "prompt_cache", "stream", "backend"]}
        same["baseline_summary_unchanged"] = sha(baseline_summary_path) == original_pin["summary_sha256"]
        same["baseline_score_source_pins"] = before["responses_sha256"] == original_pin["responses_sha256"] and before["scorer_sha256"] == SCORER_SHA
        if not all(same.values()):
            raise RuntimeError("paired_baseline_input_mismatch: " + model_id)
        out = HERE / "results-r1" / model_id
        diagnosis_path = out / "diagnosis-r1.json"
        if diagnosis_path.exists():
            existing = json.loads(diagnosis_path.read_text())
            if any(existing[k] != v for k, v in source_sha.items()):
                raise RuntimeError("previous_diagnostic_input_changed")
            states.append({"model_id": model_id, "state": "already_scored"})
            continue
        out.mkdir(parents=True, exist_ok=True)
        score_path = out / "score-r1.json"
        call = subprocess.run([sys.executable, str(EVAL / "score_r1.py"), "--fixture", str(EVAL / "cases-r1.json"), "--responses", str(response_path), "--out", str(score_path)], capture_output=True, text=True, timeout=15)
        if call.returncode != 0:
            raise RuntimeError("frozen_scorer_failed")
        after = json.loads(score_path.read_text())
        old_cases = {row["case_id"]: row for row in before["cases"]}
        changed = []
        lost, gained = [], []
        for row in after["cases"]:
            old = old_cases[row["case_id"]]
            if old["exact_ok"] and not row["exact_ok"]:
                lost.append(row["case_id"])
            if not old["exact_ok"] and row["exact_ok"]:
                gained.append(row["case_id"])
            if (old["status"], old.get("prediction")) != (row["status"], row.get("prediction")):
                changed.append({"case_id": row["case_id"], "group": row["group"], "before_status": old["status"], "after_status": row["status"], "before_prediction": old.get("prediction"), "after_prediction": row.get("prediction")})
        times = [row["seconds"] for row in summary["cases"] if row["status"] == "reply" and finite(row["seconds"])]
        baseline_times = [row["seconds"] for row in baseline["cases"] if row["status"] == "reply" and finite(row["seconds"])]
        stable = summary_path.read_bytes() == summary_bytes and sha(response_path) == source_sha["responses_sha256"] and sha(rss_path) == source_sha["rss_samples_sha256"]
        if not stable:
            raise RuntimeError("source_changed_during_scoring")
        result = {
            "version": "seen36-resource-regression-r1", "model_id": model_id, "label": label,
            "runtime_status": summary["status"], "shutdown": summary["shutdown"],
            "count": after["count"], "exact_before": before["exact"], "exact_after": after["exact"],
            "contract_ok_before": before["contract_ok"], "contract_ok_after": after["contract_ok"],
            "positive_exact_before": before["positive_exact"], "positive_exact_after": after["positive_exact"],
            "hold_exact_before": before["hold_exact"], "hold_exact_after": after["hold_exact"],
            "false_proposals_before": before["false_proposals_on_hold"], "false_proposals_after": after["false_proposals_on_hold"],
            "statuses_after": after["statuses"], "input_integrity_ok": after["input_integrity_ok"],
            "lost_exact_case_ids": lost, "gained_exact_case_ids": gained, "changed_case_predictions": changed,
            "resource_parameters_before": {"context": 2048, "batch": 256, "ubatch": 128, "max_output": 256},
            "resource_parameters_after": {"context": 1024, "batch": 64, "ubatch": 32, "max_output": 128},
            "model_file_bytes": summary["model_file_bytes"],
            "server_rss_peak_bytes_before_sampled": baseline["peak_server_rss_bytes_sampled"],
            "server_rss_peak_bytes_after_sampled": summary["peak_server_rss_bytes_sampled"],
            "query_seconds_median_before": statistics.median(baseline_times) if baseline_times else None,
            "query_seconds_median_after": statistics.median(times) if times else None,
            "query_seconds_max_after": max(times) if times else None,
            "reply_count_after": len(times), "startup_seconds_after_prehash": summary["startup_seconds"],
            "idle_independent_check": idle_check(summary, json.loads(rss_path.read_text())),
            "paired_identity_checks": same, "inputs_unchanged_after_score": stable,
            "fixture_sha256": FIXTURE_SHA, "scorer_sha256": SCORER_SHA, "prompt_sha256": PROMPT_SHA,
            "driver_sha256": DRIVER_SHA, "baseline_summary_sha256": sha(baseline_summary_path),
            "baseline_score_sha256": sha(baseline_score_path), "score_sha256": sha(score_path), **source_sha,
            "scope": "Same already-seen36 shape/action cases; resource regression diagnosis only, not fresh/generalization or whole-widget adoption",
            "reviewer_model_or_server_calls": 0,
        }
        with diagnosis_path.open("x") as handle:
            handle.write(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        states.append({"model_id": model_id, "state": "scored", "exact_before": before["exact"], "exact_after": after["exact"], "idle_status": result["idle_independent_check"]["status"]})
    return states


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--public-base", type=Path, default=REPO / "experiments/small-model-sweep-resources-v1/results")
    parser.add_argument("--private-base", type=Path, default=REPO / ".local/small-model-sweep-v1/raw-resources")
    args = parser.parse_args()
    print(json.dumps(collect(args.public_base, args.private_base), ensure_ascii=False))


if __name__ == "__main__":
    main()
