"""Verify final wording/links and preserve prior review snapshots."""
import datetime
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(__file__).resolve().parent
checks = []
sources = {}


def read(rel):
    raw = (ROOT / rel).read_bytes()
    sources[rel] = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    return raw.decode()


def check(name, actual, expected):
    checks.append({"name": name, "pass": actual == expected, "actual": actual, "expected": expected})


prior = json.loads((OUT / "JSON-CHECK-R1.json").read_text())
resource = json.loads((OUT / "RESOURCE-CHECK-R1.json").read_text())
root_prefix = "experiments/small-model-sweep-v1/"
mutable = {root_prefix + "README.md", root_prefix + "TABLE-R1.md"}
for rel, pin in {**prior["sources"], **resource["sources"]}.items():
    if rel in mutable:
        continue
    read(rel)
    check("unchanged_source:" + rel, sources[rel], pin)
readme = read(root_prefix + "README.md")
table = read(root_prefix + "TABLE-R1.md")
check("BitNet_one_attempt_clarification", "24文のうち最初の1要求が30秒" in readme, True)
check("valid_schema_false_proposal_scope", "厳密形式が有効な返信だけ" in table, True)
check("false_proposal_zero_not_safety", "安全や保留成功の証明にはならない" in table, True)
rows = {cells[0]: cells for line in table.splitlines()
        if line.startswith("| ") and (cells := [s.strip() for s in line.strip().strip("|").split("|")])
        and cells[0] not in ("実行label", "---")}
for old in prior["checks"]:
    if old["name"].endswith(":all_table_cells"):
        label = old["name"].split(":")[0]
        check("final_table:" + label, rows[label], old["expected"])
resource_readme = read("experiments/small-model-sweep-resource-evaluation-v1/README.md")
link_sources = [root_prefix + "README.md", root_prefix + "TABLE-R1.md",
                "experiments/small-model-sweep-resource-evaluation-v1/README.md"]
links = []
for rel in link_sources:
    text = read(rel)
    for target in re.findall(r"\]\(([^)]+)\)", text):
        if target.startswith(("http:", "https:", "#")):
            continue
        resolved = (ROOT / rel).parent / target.split("#", 1)[0]
        links.append({"from": rel, "target": target, "exists": resolved.exists()})
check("all_final_local_links", all(x["exists"] for x in links), True)
check("resource_no_single_factor_claim", "特定の設定変更の効果に帰属しない" in resource_readme, True)
check("resource_loaded_idle_scope", "36回推論した後、モデルを保持" in resource_readme, True)
check("resource_idle_CPU_not_whole_machine", "マシン全体の占有率ではない" in resource_readme, True)
check("resource_no_whole_widget_success", "アプリ全体の軽さや電池への影響を結論しない" in resource_readme, True)
check("resource_seen36_not_fresh", "未見文での能力や一般化" in resource_readme, True)

returned_manifests = [
    ("experiments/small-model-sweep-evaluation-v1/", "RETURN-MANIFEST-R2.json", 167),
    ("experiments/small-model-sweep-resource-evaluation-v1/", "RETURN-MANIFEST-R1.json", None)]
preserved = []
for folder, filename, expected_count in returned_manifests:
    manifest = json.loads(read(folder + filename))
    if expected_count is not None:
        check(folder + ":payload_count", len(manifest["files"]), expected_count)
    for item in manifest["files"]:
        rel = folder + item["path"]
        raw = (ROOT / rel).read_bytes()
        actual = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
        check("returned_payload:" + rel, actual, {"bytes": item["bytes"], "sha256": item["sha256"]})
    preserved.append({"manifest": folder + filename, "payload_files": len(manifest["files"]), "all_preserved": True})
patterns = {"personal_absolute_path": r"/(?:Users|private/var|var/folders)/",
            "email": r"[A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
            "credential": r"\b(?:ghp_|github_pat_|sk-[A-Za-z0-9]{12})[A-Za-z0-9_]*"}
privacy = {name: sum(len(re.findall(pattern, read(rel))) for rel in link_sources) for name, pattern in patterns.items()}
check("limited_final_document_privacy_scan", privacy, {name: 0 for name in patterns})
check("root_json_unchanged_from_initial_review", sources[root_prefix + "RUNS-R1.json"], prior["sources"][root_prefix + "RUNS-R1.json"])
result = {"version": "publication-final-doc-check-r2",
          "observed_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "scope": "Read-only final docs/table/link/source checks and unchanged returned payload hashes; no inference/compiler/download/Git",
          "check_count": len(checks), "pass_count": sum(c["pass"] for c in checks),
          "failed_checks": [c for c in checks if not c["pass"]], "checks": checks,
          "source_pins": sources, "local_links": links, "limited_privacy_pattern_counts": privacy,
          "returned_payloads_checked": preserved,
          "root_changes_since_initial_review": {rel: {"old_sha256": prior["sources"][rel]["sha256"],
                                                         "new_sha256": sources[rel]["sha256"]}
                                                for rel in sorted(mutable)}}
with (OUT / "FINAL-DOC-CHECK-R2.json").open("x") as f:
    f.write(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"checks": len(checks), "passed": result["pass_count"], "failures": len(result["failed_checks"]),
                  "local_links": len(links), "preserved": preserved}, ensure_ascii=False))
