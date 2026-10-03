"""Read saved public data only. No inference, downloads, source edits, or Git."""
import collections
import datetime
import hashlib
import json
import math
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(__file__).resolve().parent
sources = {}
checks = []


def read(rel):
    p = ROOT / rel
    data = p.read_bytes()
    sources[rel] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    return data.decode("utf-8")


def obj(rel):
    return json.loads(read(rel))


def check(name, actual, expected):
    checks.append({"name": name, "pass": actual == expected,
                   "actual": actual, "expected": expected})


def digest(rel):
    read(rel)
    return sources[rel]["sha256"]


prefix = "experiments/small-model-sweep-v1/"
readme = read(prefix + "README.md")
table = read(prefix + "TABLE-R1.md")
run_doc = obj(prefix + "RUNS-R1.json")
ledger = obj("research/small-model-sweep-ledger-20261003/INVENTORY-R1.json")
artifacts = {a["sha256"]: a for a in ledger["artifacts"]}
rows = {cells[0]: cells for line in table.splitlines()
        if line.startswith("| ") and (cells := [s.strip() for s in line.strip().strip("|").split("|")])
        and cells[0] not in ("実行label", "---")}
check("table_label_set", sorted(rows), sorted(r["label"] for r in run_doc["runs"]))
status_counts = collections.Counter()
case_status_counts = collections.Counter()
completed_weight_ids = set()
attempts = missing = replies = 0
failure_records = []
for run in run_doc["runs"]:
    label = run["label"]
    summary = obj(run["summary_path"])
    score = obj(run["score_path"])
    check(label + ":summary_pin", sources[run["summary_path"]]["sha256"], run["summary_sha256"])
    check(label + ":score_pin", sources[run["score_path"]]["sha256"], run["score_sha256"])
    for out_key, summary_key in [("runtime_status", "status"), ("model_sha256", "model_file_sha256"),
                                  ("weight_file_bytes", "model_file_bytes"),
                                  ("sampled_owned_server_peak_rss_bytes", "peak_server_rss_bytes_sampled"),
                                  ("startup_seconds", "startup_seconds"), ("shutdown", "shutdown")]:
        check(label + ":" + out_key, run[out_key], summary.get(summary_key))
    check(label + ":final_shutdown_present", bool(summary.get("shutdown")), True)
    check(label + ":not_running", summary["status"] != "running", True)
    check(label + ":ledger_weight_bytes", run["weight_file_bytes"], artifacts[run["model_sha256"]]["bytes"])
    check(label + ":fixed_prompt", summary["prompt_sha256"], "da0223fdfe8eab4c970b0054f901a3c5dfb042e54be13aebe5dea678e990d73d")
    check(label + ":fixed_fixture", summary["fixture_sha256"], "faef1015db57e15a8677ef180c8e658db0f9b82d32311f68bb9477ac06eba23b")
    cases = summary["cases"]
    counts = dict(collections.Counter(c["status"] for c in cases))
    content = [c for c in cases if c["status"] == "reply" and c.get("http_status") == 200]
    times = sorted(c["seconds"] for c in content)
    p95 = times[math.ceil(.95 * len(times)) - 1] if times else None
    raw_rel = "experiments/small-model-sweep-evaluation-v1/raw-public-r2/" + label + ".jsonl"
    raw = [json.loads(line) for line in read(raw_rel).splitlines() if line]
    check(label + ":public_raw_pin", sources[raw_rel]["sha256"], score["raw_sha256"])
    check(label + ":raw_record_count", len(raw), len(cases))
    check(label + ":raw_public_keys", all(set(x) == {"case_id", "raw_text", "status"} for x in raw), True)
    check(label + ":attempts", run["attempted"], len(cases))
    check(label + ":missing", run["missing"], 24 - len(cases))
    check(label + ":statuses", run["case_status_counts"], counts)
    check(label + ":http_replies", run["http200_content_replies"], len(content))
    check(label + ":p95", run["reply_p95_nearest_rank_seconds"], p95)
    for output, field in [("independent_exact_including_failed_slots", "exact"),
                          ("independent_contract_valid", "schema_valid"),
                          ("valid_false_propose_on_6_hold_cases", "false_propose_valid_schema")]:
        check(label + ":" + output, run[output], score[field])
    check(label + ":score_denominator", score["denominator"], 24)
    cells = rows[label]
    expect_cells = [label, run["group"], str(len(content)) + "/24",
                    str(score["exact"]) + "/24" if content else "未評価",
                    str(score["schema_valid"]) + "/24" if content else "—",
                    str(score["false_propose_valid_schema"]) + "/6" if content else "—",
                    format(p95, ".3f") if p95 is not None else "—",
                    format(summary["peak_server_rss_bytes_sampled"] / 2**20, ".1f")]
    check(label + ":all_table_cells", cells, expect_cells)
    attempts += len(cases)
    missing += 24 - len(cases)
    replies += len(content)
    status_counts[summary["status"]] += 1
    case_status_counts.update(counts)
    if len(content) == 24:
        completed_weight_ids.add(run["model_sha256"])
    if not content:
        failure_records.append({"label": label, "status": summary["status"], "attempted": len(cases),
                                "unattempted": 24-len(cases), "case_status_counts": counts,
                                "semantic_result": "unavailable; public display does not equate failures with semantic zero"})

expected_totals = {"execution_labels": len(run_doc["runs"]),
                   "distinct_weight_sha256": len({r["model_sha256"] for r in run_doc["runs"]}),
                   "distinct_weights_with_24_content_replies": len(completed_weight_ids),
                   "content_replies": replies, "query_attempts": attempts,
                   "unattempted_slots": missing, "fixed_slots": len(run_doc["runs"]) * 24,
                   "runtime_status_counts": dict(status_counts)}
check("all_run_totals", run_doc["totals"], expected_totals)
check("completed_content_total", replies, 528)
check("attempted_failure_partition", dict(case_status_counts), {"reply": 528, "invalid_response": 24, "timeout": 1})
check("ledger_weight_set", sorted(artifacts), sorted({r["model_sha256"] for r in run_doc["runs"]}))
new_artifacts = [a for a in ledger["artifacts"] if a["new_download_in_this_session"]]
check("new_artifact_count", len(new_artifacts), 21)
check("new_artifact_bytes", sum(a["bytes"] for a in new_artifacts), 19113671616)
check("README_download_decimal_GB", format(sum(a["bytes"] for a in new_artifacts) / 1e9, ".3f") + "GB" in readme, True)
check("all_artifact_bytes", sum(a["bytes"] for a in ledger["artifacts"]), 20957543520)
check("ledger_query_counts", ledger["counts"]["attempted_case_status_counts"], dict(case_status_counts))
check("ledger_execution_counts", ledger["counts"]["execution_label_status_counts"], dict(status_counts))

shape_rel = "experiments/small-model-sweep-shape-only-evaluation-v1/results-r1/COMPARISON-R1.json"
shape = obj(shape_rel)
check("separate_shape_only_models", len(shape["records"]), 6)
check("separate_shape_only_replies", sum(r["reply_count"] for r in shape["records"]), 216)
for r in shape["records"]:
    model_id = r["model_id"]
    shape_base = "experiments/small-model-sweep-shape-only-evaluation-v1/results-r1/" + model_id + "/"
    check(model_id + ":shape_only_score_pin", digest(shape_base + "score-r1.json"), r["score_sha256"])
    check(model_id + ":shape_only_provenance_pin", digest(shape_base + "provenance-r1.json"), r["provenance_sha256"])
    shape_summary_rel = "experiments/small-model-sweep-shape-only-v1/results/" + r["label"] + "/summary.json"
    check(model_id + ":shape_only_summary_pin", digest(shape_summary_rel), r["summary_sha256"])
    check(model_id + ":shape_only_positive_hold_partition", r["positive_exact"] + r["hold_exact"], r["exact"])
    check(model_id + ":shape_only_group_sum", sum(g["exact"] for g in r["by_group"].values()), r["exact"])
    check(model_id + ":shape_only_fixed_denominator", r["positive_count"] + r["hold_count"], 36)

source_docs = [prefix + "README.md", prefix + "TABLE-R1.md", prefix + "RUNS-R1.json"]
links = []
for rel in source_docs[:2]:
    text = read(rel)
    for target in re.findall(r"\]\(([^)]+)\)", text):
        if target.startswith(("http:", "https:", "#")):
            continue
        dest = (ROOT / rel).parent / target.split("#", 1)[0]
        links.append({"from": rel, "target": target, "exists": dest.exists()})
privacy_patterns = {"personal_absolute_path": r"/(?:Users|private/var|var/folders)/",
                    "email": r"[A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
                    "credential_token": r"\b(?:ghp_|github_pat_|sk-[A-Za-z0-9]{12})[A-Za-z0-9_]*"}
privacy_counts = {name: sum(len(re.findall(pattern, read(rel))) for rel in source_docs +
                          ["experiments/small-model-sweep-evaluation-v1/raw-public-r2/" + r["label"] + ".jsonl"
                           for r in run_doc["runs"]])
                  for name, pattern in privacy_patterns.items()}
check("limited_privacy_pattern_scan", privacy_counts, {name: 0 for name in privacy_patterns})
check("root_docs_stable_during_check", all(hashlib.sha256((ROOT / rel).read_bytes()).hexdigest() == sources[rel]["sha256"]
                                         for rel in source_docs), True)
result = {"version": "small-model-sweep-publication-review-r1",
          "observed_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "scope": "Read-only arithmetic, saved evidence pins, table cells, local links and limited public pattern check; no weight rehash/inference/compiler/network/Git",
          "pass_count": sum(c["pass"] for c in checks), "check_count": len(checks),
          "failed_checks": [c for c in checks if not c["pass"]], "checks": checks,
          "recomputed_totals": expected_totals, "attempted_status_counts": dict(case_status_counts),
          "failure_boundaries": failure_records, "local_links": links,
          "missing_local_links": [l for l in links if not l["exists"]],
          "privacy_scan": {"counts": privacy_counts, "scope": "root three documents and26 artificial output exports only; regex scan is not a comprehensive privacy/security proof"},
          "sources": sources,
          "manual_review_notes": [
              "Readme distinguishes the24 five-field and36 shape-only fixtures; no pooled accuracy or direct improvement percentage is claimed.",
              "No general-PC16GB/whole-widget/end-to-visible30-second/default-adoption success is claimed.",
              "Quantization, model size, runtime and prompt effects are not isolated by this one-run-per-setting design.",
              "Publisher/acquisition records were reconciled;21GB model payloads were not independently rehashed by this reviewer.",
              "No-overlap acquisition/build versus inference is an orchestration report; summaries alone do not establish host-wide absence of competing load.",
              "Resource diagnostic report is reviewed separately after it completes."
          ]}
output_path = OUT / "JSON-CHECK-R1.json"
if output_path.exists():
    raise SystemExit("Refusing to overwrite existing review version")
output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"checks": len(checks), "passed": result["pass_count"],
                  "failures": len(result["failed_checks"]), "missing_local_links": result["missing_local_links"],
                  "totals": expected_totals, "source_files": len(sources)}, ensure_ascii=False))
