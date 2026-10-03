"""Reconcile finished run metadata and independent fixed24 scores.

No downloads or inference. Preserve earlier summaries and refuse output reuse.
"""
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXP = ROOT / "experiments/small-model-sweep-v1"
SCORES = ROOT / "experiments/small-model-sweep-evaluation-v1/results-r1"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    outputs = [EXP / "RUNS-R1.json", EXP / "TABLE-R1.md"]
    if any(p.exists() for p in outputs):
        raise SystemExit("preserve prior aggregate; choose a new version")
    rows = []
    for path in sorted((EXP / "results").glob("*/summary.json")):
        summary = json.loads(path.read_text())
        score_path = SCORES / (path.parent.name + "-score.json")
        score = json.loads(score_path.read_text())
        assert score["denominator"] == summary["fixture_count"] == 24
        replies = sorted(c["seconds"] for c in summary["cases"] if c["status"] == "reply")
        if path.parent.name.endswith("-nojinja-cpu-r2"):
            group = "seen24-template-diagnostic"
        elif path.parent.name.endswith("-prism-cpu-r2"):
            group = "separate-prism-runtime"
        elif path.parent.name.endswith("-patched-cpu-r3"):
            group = "separate-patched-bitnet-runtime"
        elif "-extra-cpu-r1" in path.parent.name:
            group = "post-initial-selection-extra"
        else:
            group = "initial-common-runtime"
        rows.append({
            "label": path.parent.name, "group": group,
            "model_sha256": summary["model_file_sha256"],
            "weight_file_bytes": summary["model_file_bytes"],
            "runtime_status": summary["status"],
            "attempted": len(summary["cases"]),
            "missing": len(summary["unattempted_case_ids"]),
            "case_status_counts": dict(Counter(c["status"] for c in summary["cases"])),
            "http200_content_replies": len(replies),
            "independent_exact_including_failed_slots": score["exact"],
            "independent_contract_valid": score["schema_valid"],
            "valid_false_propose_on_6_hold_cases": score["false_propose_valid_schema"],
            "reply_p95_nearest_rank_seconds": replies[math.ceil(len(replies) * .95) - 1] if replies else None,
            "sampled_owned_server_peak_rss_bytes": summary["peak_server_rss_bytes_sampled"],
            "startup_seconds": summary["startup_seconds"],
            "shutdown": summary["shutdown"],
            "summary_path": str(path.relative_to(ROOT)), "summary_sha256": digest(path),
            "score_path": str(score_path.relative_to(ROOT)), "score_sha256": digest(score_path),
        })
    totals = {"execution_labels": len(rows),
              "distinct_weight_sha256": len({r["model_sha256"] for r in rows}),
              "distinct_weights_with_24_content_replies": len({r["model_sha256"] for r in rows if r["http200_content_replies"] == 24}),
              "content_replies": sum(r["http200_content_replies"] for r in rows),
              "query_attempts": sum(r["attempted"] for r in rows),
              "unattempted_slots": sum(r["missing"] for r in rows),
              "fixed_slots": len(rows) * 24,
              "runtime_status_counts": dict(Counter(r["runtime_status"] for r in rows))}
    assert (totals["execution_labels"], totals["distinct_weight_sha256"], totals["content_replies"], totals["query_attempts"], totals["unattempted_slots"]) == (26, 23, 528, 553, 71)
    assert totals["distinct_weights_with_24_content_replies"] == 22
    outputs[0].write_text(json.dumps({"version": "fixed24-root-reconciliation-r1", "totals": totals, "runs": rows}, ensure_ascii=False, indent=2) + "\n")
    lines = ["# 固定24文・全26実行の台帳", "", "元の実行順による比較は独立REPORTを参照。この表はlabel順であり、総合順位ではない。返信なしの結果を意味精度0と同列にしない。", "", "| 実行label | 群 | 本文返信 | 全5属性一致 | 厳密形式 | 保留文への誤提案 | 返信p95秒 | server peak MiB |", "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for r in rows:
        has_replies = r["http200_content_replies"] > 0
        exact = str(r["independent_exact_including_failed_slots"]) + "/24" if has_replies else "未評価"
        valid = str(r["independent_contract_valid"]) + "/24" if has_replies else "—"
        false = str(r["valid_false_propose_on_6_hold_cases"]) + "/6" if has_replies else "—"
        p95 = f'{r["reply_p95_nearest_rank_seconds"]:.3f}' if has_replies else "—"
        rss = f'{r["sampled_owned_server_peak_rss_bytes"] / 1048576:.1f}' if r["sampled_owned_server_peak_rss_bytes"] is not None else "—"
        lines.append(f'| {r["label"]} | {r["group"]} | {r["http200_content_replies"]}/24 | {exact} | {valid} | {false} | {p95} | {rss} |')
    lines.extend(["", "保留文への誤提案は厳密形式が有効な返信だけを数える。0/6でも形式失敗・返信なしがあれば安全や保留成功の証明にはならない。", "", "26実行は23種類の重みに再試行3件を加えたもの。528本文返信、HTTP400による本文なし24件、timeout1件、未試行71件を分けて記録。startup失敗時のRSSはロード前の過程であり、モデル常駐RAMではない。", "", "p95は成功HTTP返信のnearest-rank。起動・取得・描画・shutdownを含まず、起動前hashによるfile-cache warmingがある。RSSは250ms標本のserver単独値、UI/driver/OS/消費電力は含まない。", "", "[機械可読集計](RUNS-R1.json) / [独立採点と互換診断](../small-model-sweep-evaluation-v1/REPORT-R2.md)", ""])
    outputs[1].write_text("\n".join(lines))
    print(json.dumps(totals))


if __name__ == "__main__":
    main()
