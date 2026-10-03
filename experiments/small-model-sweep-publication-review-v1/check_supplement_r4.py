"""Read-only checks for supplemental public entrypoints and artificial exports."""
import copy
import datetime
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(__file__).resolve().parent
sources, checks = {}, []


def read(rel):
    b = (ROOT / rel).read_bytes()
    sources[rel] = {"bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()}
    return b.decode()


def obj(rel):
    return json.loads(read(rel))


def check(name, actual, expected):
    checks.append({"name": name, "pass": actual == expected, "actual": actual, "expected": expected})


prefix = "experiments/small-model-sweep-v1/"
old = obj("experiments/small-model-sweep-publication-review-v1/FINAL-DOC-CHECK-R2.json")
read(prefix + "RUNS-R1.json")
check("fixed26_RUNS_unchanged", sources[prefix + "RUNS-R1.json"], old["source_pins"][prefix + "RUNS-R1.json"])
table = read(prefix + "TABLE-R1.md")
check("fixed26_TABLE_unchanged", sources[prefix + "TABLE-R1.md"], old["source_pins"][prefix + "TABLE-R1.md"])
main = read(prefix + "README.md")
for description, text in [
    ("supplement_kept_separate", "固定24文の成功へは加算しない"),
    ("supplement_kernel_unverified", "数値kernelの正しさは検証していない"),
    ("resources_four_settings", "4条件をまとめて変更"),
    ("resources_loaded_RAM", "RSSは1313.19MiB"),
    ("resource_no_widget_success", "常駐の小ささを達成した結果として読まない"),
    ("different24_36_not_compared", "契約も問題集合も異なる")]:
    check(description, text in main, True)
resource_expected_rows = [
    "| Bonsai 1.7B Q1 | 16/36 | 16/36 | 819.3 → 697.8 | 1.005 → 1.070 |",
    "| Bonsai 4B Q1 | 28/36 | 29/36 | 1496.4 → 1336.1 | 2.450 → 2.640 |"]
check("main_resource_table_matches_verified_data", all(row in main for row in resource_expected_rows), True)

export_doc = obj(prefix + "SHAPE-RESOURCE-EXPORTS-R1.json")
shape = obj("experiments/small-model-sweep-shape-only-evaluation-v1/results-r1/COMPARISON-R1.json")
resource = obj("experiments/small-model-sweep-resource-evaluation-v1/COMPARISON-R1.json")
expected_export_hashes = {r["label"]: r["responses_sha256"] for r in shape["records"] + resource["records"]}
all_records = 0
for item in export_doc["exports"]:
    rel = item["path"]
    raw_text = read(rel)
    check("export_pin:" + rel, sources[rel], {"bytes": item["bytes"], "sha256": item["sha256"]})
    check("independent_export_source_pin:" + rel, sources[rel]["sha256"], expected_export_hashes[pathlib.Path(rel).stem])
    rows = [json.loads(line) for line in raw_text.splitlines() if line]
    check("export_records:" + rel, len(rows), 36)
    check("export_keys:" + rel, all(set(r) == {"case_id", "raw_text", "status"} for r in rows), True)
    # Frozen shape/resource driver exports HTTP200 string content as "ok";
    # its public summary uses "reply". R3 had incorrectly reused main24 status.
    summary_rel = str(pathlib.Path(rel).parents[1] / "results" / pathlib.Path(rel).stem / "summary.json")
    summary = obj(summary_rel)
    by_id = {c["id"]: c for c in summary["cases"]}
    check("export_case_ids:" + rel, sorted(r["case_id"] for r in rows), sorted(by_id))
    check("export_ok_maps_to_HTTP200_reply:" + rel,
          all(r["status"] == "ok" and isinstance(r["raw_text"], str)
              and by_id[r["case_id"]]["status"] == "reply"
              and by_id[r["case_id"]]["http_status"] == 200 for r in rows), True)
    all_records += len(rows)
check("exports_record_total", all_records, 288)
check("exports_manifest_total", export_doc["model_content_records"], all_records)
check("exports_count", len(export_doc["exports"]), 8)

catalog = "research/small-model-sweep-public-catalog-v1/"
public_metadata = obj(catalog + "PUBLIC-HF-METADATA-R2.json")
raw_rel = "research/small-model-sweep-20261003/HF-METADATA-R1.json"
original = obj(raw_rel)  # No original strings are copied to output.
check("curated_source_pin", sources[raw_rel], {"bytes": public_metadata["source_bytes"], "sha256": public_metadata["source_sha256"]})
check("curated_model_record_count", len(public_metadata["models"]), 23)
template_count = template_bytes = 0
reconstructed = []
for model in public_metadata["models"]:
    restored = copy.deepcopy(model)
    restored.pop("fixed_revision_metadata_url", None)
    restored.pop("fixed_revision_metadata_url_is_derived_not_refetched", None)
    gguf = restored.get("gguf_metadata")
    source = next(x for x in original["models"] if x["repo_id"] == model["repo_id"])
    source_gguf = source.get("gguf_metadata")
    if isinstance(gguf, dict) and "chat_template_present_in_source" in gguf:
        text = source_gguf["chat_template"]
        check(model["repo_id"] + ":template_replaced_digest", gguf.pop("chat_template_sha256"), hashlib.sha256(text.encode()).hexdigest())
        check(model["repo_id"] + ":template_replaced_bytes", gguf.pop("chat_template_utf8_bytes"), len(text.encode()))
        check(model["repo_id"] + ":template_was_present", gguf.pop("chat_template_present_in_source"), True)
        gguf["chat_template"] = text
        template_count += 1
        template_bytes += len(text.encode())
    reconstructed.append(restored)
check("non_template_fields_preserved", reconstructed == original["models"], True)
check("templates_removed_count", template_count, 20)
check("template_utf8_bytes_removed", template_bytes, 60996)
check("template_field_absent_public", all("chat_template" not in m.get("gguf_metadata", {}) for m in public_metadata["models"] if isinstance(m.get("gguf_metadata"), dict)), True)
allowlist = obj(catalog + "SUGGESTED-INITIAL-ALLOWLIST-R1.json")
for item in allowlist["initial_files_to_publish"]:
    read(item["path"])
    check("curated_allowlist_pin:" + item["path"], sources[item["path"]], {"bytes": item["bytes"], "sha256": item["sha256"]})
check("selected_initial_public_count", len(allowlist["initial_files_to_publish"]), 8)
check("selected_initial_private_count", len(allowlist["initial_files_to_keep_private_without_deletion"]), 6)

documents = [prefix + "README.md", prefix + "TABLE-R1.md",
             "experiments/small-model-sweep-resource-evaluation-v1/README.md",
             catalog + "README.md", "research/small-model-sweep-ledger-20261003/PUBLIC-README-R2.md",
             "experiments/small-model-sweep-bitnet-diagnostic-v1/README.md"]
links = []
for rel in documents:
    text = read(rel)
    for target in re.findall(r"\]\(([^)]+)\)", text):
        if target.startswith(("http:", "https:", "#")):
            continue
        resolved = ((ROOT / rel).parent / target.split("#", 1)[0]).resolve()
        links.append({"from": rel, "target": target, "exists": resolved.exists(),
                      "excluded_initial_private_target": any(resolved == ROOT / item["path"] for item in allowlist["initial_files_to_keep_private_without_deletion"])})
check("all_selected_local_links", all(x["exists"] for x in links), True)
check("no_clickable_link_to_excluded_initial_files", all(not x["excluded_initial_private_target"] for x in links), True)
top = read("README.md")
check("repo_entrypoint_does_not_adopt", "接続候補を検討します" in top.split("前回の8時間作業")[0], True)
check("repo_entrypoint_separate24_36", "形と属性の24文では最多17/24、形だけの別36文ではBonsai 4Bが28/36" in top, True)
privacy = {"personal_absolute_path": 0, "email": 0, "credential": 0}
patterns = {"personal_absolute_path": r"/(?:Users|private/var|var/folders)/",
            "email": r"[A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
            "credential": r"\b(?:ghp_|github_pat_|sk-[A-Za-z0-9]{12})[A-Za-z0-9_]*"}
scan = documents + [item["path"] for item in export_doc["exports"]] + [catalog + "PUBLIC-HF-METADATA-R2.json"]
for name, pattern in patterns.items():
    privacy[name] = sum(len(re.findall(pattern, read(rel))) for rel in scan)
check("limited_supplement_privacy_scan", privacy, {key: 0 for key in privacy})
sources.pop(raw_rel)  # Hash proved unchanged above, private path not needed in public source map.
result = {"version": "publication-supplement-check-r4",
          "observed_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "check_count": len(checks), "pass_count": sum(c["pass"] for c in checks),
          "failed_checks": [c for c in checks if not c["pass"]], "checks": checks,
          "source_pins": sources, "local_links": links, "limited_privacy_counts": privacy,
          "scope": "Current public entrypoints,8 unchanged artificial exports288records, template-stripped metadata, and fixed26 ledger preservation. Local existence/curated allowlist is not proof of GitHub publication.",
          "reviewer_model_calls": 0, "downloads_builds_git": 0,
          "prior_R3_checker_error": "R3 incorrectly required raw status reply; fixed shape/resource driver uses raw ok for HTTP200 content and summary reply. Eight R3 status checks are superseded only by explicit saved-case HTTP mapping. Fixtures, expectations, model raw, original scores and all other R3 checks are unchanged."}
with (OUT / "SUPPLEMENT-CHECK-R4.json").open("x") as f:
    f.write(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"passed": result["pass_count"], "checks": len(checks), "failed": len(result["failed_checks"]),
                  "local_links": len(links), "exports_records": all_records}, ensure_ascii=False))
