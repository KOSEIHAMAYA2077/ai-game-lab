"""Second independent saved-file check. No inference or process measurement."""
import datetime
import hashlib
import json
import pathlib
import statistics

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(__file__).resolve().parent
sources = {}
checks = []


def read(rel):
    data = (ROOT / rel).read_bytes()
    sources[rel] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    return data.decode()


def obj(rel):
    return json.loads(read(rel))


def check(name, actual, expected):
    checks.append({"name": name, "pass": actual == expected, "actual": actual, "expected": expected})


def pin(rel, expected):
    read(rel)
    check(rel + ":sha256", sources[rel]["sha256"], expected)


prefix = "experiments/small-model-sweep-resource-evaluation-v1/"
comparison = obj(prefix + "COMPARISON-R1.json")
review = obj(prefix + "SOURCE-REVIEW-R1.json")
pin(prefix + "SOURCE-REVIEW-R1.json", comparison["source_review_sha256"])
pin("experiments/small-model-sweep-resources-v1/run_r2.py", review["resource_driver_sha256"])
pin("experiments/small-model-sweep-shape-only-evaluation-v1/cases-r1.json", review["fixture_sha256"])
pin("experiments/small-model-sweep-shape-only-evaluation-v1/score_r1.py", review["scorer_sha256"])
pin("experiments/small-model-sweep-shape-only-v1/prompt-r2.json", review["prompt_sha256"])
records = []
for row in comparison["records"]:
    model_id, label = row["model_id"], row["label"]
    public = "experiments/small-model-sweep-resources-v1/results/" + label + "/"
    folder = prefix + "results-r1/" + model_id + "/"
    baseline_folder = "experiments/small-model-sweep-shape-only-evaluation-v1/results-r1/" + model_id + "/"
    baseline_public = "experiments/small-model-sweep-shape-only-v1/results/" + model_id + "-shape-only-r1/"
    raw_path = ".local/small-model-sweep-v1/raw-resources/" + label + "/responses.jsonl"
    summary = obj(public + "summary.json")
    samples = obj(public + "rss-samples.json")
    score = obj(folder + "score-r1.json")
    before = obj(baseline_folder + "score-r1.json")
    baseline = obj(baseline_public + "summary.json")
    wire = obj(folder + "WIRE-CLI-AUDIT-R1.json")
    pins = {folder + "diagnosis-r1.json": row["diagnosis_sha256"],
            folder + "WIRE-CLI-AUDIT-R1.json": row["wire_cli_audit_sha256"],
            folder + "score-r1.json": row["score_sha256"],
            public + "summary.json": row["summary_sha256"],
            public + "rss-samples.json": row["rss_samples_sha256"],
            baseline_folder + "score-r1.json": row["baseline_score_sha256"],
            baseline_public + "summary.json": row["baseline_summary_sha256"],
            raw_path: row["responses_sha256"]}
    for rel, expected in pins.items():
        pin(rel, expected)
    check(model_id + ":terminal", summary["status"], "completed")
    check(model_id + ":shutdown", summary["shutdown"], {"method": "owned_sigterm", "exit_code": 0})
    check(model_id + ":36replies", len([c for c in summary["cases"] if c["status"] == "reply" and c["http_status"] == 200]), 36)
    for key in ["model_file_sha256", "runtime_binary_sha256", "prompt_sha256", "fixture_sha256", "temperature", "seed", "threads", "threads_batch", "prompt_cache", "stream", "backend"]:
        check(model_id + ":paired_identity:" + key, summary[key], baseline[key])
    check(model_id + ":before_count", before["count"], 36)
    check(model_id + ":after_count", score["count"], 36)
    check(model_id + ":exact_before", row["exact_before"], before["exact"])
    check(model_id + ":exact_after", row["exact_after"], score["exact"])
    check(model_id + ":valid_before", row["contract_ok_before"], before["contract_ok"])
    check(model_id + ":valid_after", row["contract_ok_after"], score["contract_ok"])
    for key, expected in [("context_tokens", 1024), ("max_output_tokens", 128)]:
        check(model_id + ":parameter:" + key, summary[key], expected)
    check(model_id + ":wire_all_declared_checks", all(wire["checks"].values()), True)
    check(model_id + ":request_only_max_output_changed", all(r["only_max_output_changed"] for r in wire["request_checks"]), True)
    check(model_id + ":requests_count", wire["requests"], 36)
    marker = summary.get("idle", {}).get("started_batch_seconds")
    active = [s["rss_bytes"] for s in samples if s["rss_bytes"] is not None and (marker is None or s["seconds"] < marker)]
    check(model_id + ":startup_query_peak_rss", row["startup_and_queries_rss_peak_bytes_sampled"], max(active))
    check(model_id + ":active_phase_sample_count", row["startup_and_queries_rss_samples"], len(active))
    check(model_id + ":whole_run_peak_rss", summary["peak_server_rss_bytes_sampled"], max(s["rss_bytes"] for s in samples if s["rss_bytes"] is not None))
    times = [c["seconds"] for c in summary["cases"] if c["status"] == "reply"]
    check(model_id + ":median", row["query_seconds_median_after"], statistics.median(times))
    check(model_id + ":max_reply", row["query_seconds_max_after"], max(times))
    record = {"model_id": model_id, "before_exact": before["exact"], "after_exact": score["exact"],
              "denominator": 36, "server_peak_MiB_before": baseline["peak_server_rss_bytes_sampled"] / 2**20,
              "server_peak_MiB_after": max(active) / 2**20,
              "query_median_before_seconds": row["query_seconds_median_before"],
              "query_median_after_seconds": statistics.median(times)}
    if marker is not None:
        idle = summary["idle"]
        after_start = [s["rss_bytes"] for s in samples if s["rss_bytes"] is not None and s["seconds"] >= marker]
        window = after_start[:idle["rss_samples"]]
        delta = idle["cpu_end_seconds"] - idle["cpu_start_seconds"]
        percent = delta / idle["elapsed_seconds"] * 100
        for key, value in [("cpu_delta_seconds", delta), ("cpu_percent_one_core", percent),
                           ("rss_samples", len(window)), ("rss_min_bytes", min(window)),
                           ("rss_max_bytes", max(window)), ("mean_rss_bytes", statistics.mean(window))]:
            check(model_id + ":idle:" + key, idle[key], value)
        check(model_id + ":full600seconds", idle["elapsed_seconds"] >= 600, True)
        check(model_id + ":idle_count_vs_available", idle["rss_samples"] <= len(after_start), True)
        check(model_id + ":independent_idle_complete", row["idle_independent_check"]["status"], "complete_600_seconds")
        check(model_id + ":independent_idle_cpu", row["idle_independent_check"]["cpu_percent_one_core_recomputed"], percent)
        record["loaded_idle"] = {"elapsed_seconds": idle["elapsed_seconds"], "cpu_delta_seconds": delta,
                                 "cpu_percent_one_core": percent, "RSS_MiB": statistics.mean(window) / 2**20,
                                 "RSS_samples": len(window)}
    else:
        check(model_id + ":idle_not_measured", row["idle_independent_check"]["status"], "not_measured")
    records.append(record)

result = {"version": "independent-publication-resource-check-r1",
          "observed_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "scope": "Saved source/pin/score/summary/sample/wire audit check; private artificial raw is hashed only; no model calls or process measurements",
          "pass_count": sum(c["pass"] for c in checks), "check_count": len(checks),
          "failed_checks": [c for c in checks if not c["pass"]], "checks": checks,
          "records": records, "sources": sources,
          "interpretation_boundaries": [
              "Same seen36 and four resource parameters changed together: not a fresh/generalization or single-factor ablation claim.",
              "29/36 after versus28/36 before does not establish a causal accuracy improvement from smaller context/batch.",
              "Idle CPU is user+system accumulated server TIME delta over actual elapsed, one core=100%; not whole-machine percent, energy or active CPU.",
              "Loaded4B idle retains about1313.2MiB; low idle CPU does not imply memory-free widget.",
              "1.7B idle was not measured; unloaded baseline, post-exit memory return, entire UI and actual16GB laptop remain unverified.",
              "Source review was before its author read these outputs but after root experiments began; not a global experiment preregistration.",
              "No numerical BitNet verification is supplied by this unrelated resource diagnosis."
          ]}
path = OUT / "RESOURCE-CHECK-R1.json"
with path.open("x") as handle:
    handle.write(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"passed": result["pass_count"], "checks": len(checks), "failed": len(result["failed_checks"]),
                  "records": records}, ensure_ascii=False))
