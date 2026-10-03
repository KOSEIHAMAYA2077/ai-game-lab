#!/usr/bin/env python3
"""Check saved prompt inputs and original HTTP content against scored exports."""
import argparse
import hashlib
import importlib.util
import json
import pathlib

BASE = pathlib.Path(__file__).resolve().parent
REPO = BASE.parents[1]
RAW = REPO / ".local/small-model-sweep-v1/raw"
DEST = BASE / "results-r1"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--snapshot", required=True)
    args = p.parse_args()
    if not args.snapshot.replace("-", "").isalnum():
        p.error("safe snapshot required")
    spec = importlib.util.spec_from_file_location("export_audit_frozen_score", BASE / "score.py")
    scorer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(scorer)
    freeze = json.loads((BASE / "FREEZE-R1.json").read_text())
    for entry in freeze["files"]:
        if sha(BASE / entry["path"]) != entry["sha256"]:
            raise ValueError("evaluation freeze changed")
    fixture = json.loads((BASE / "cases-r1.json").read_text())["cases"]
    text_by_id = {case["case_id"]: case["text"] for case in fixture}
    prompt_path = REPO / "experiments/small-model-sweep-v1/prompt-r1.json"
    if sha(prompt_path) != freeze["prompt_sha256_reported_by_root"]:
        raise ValueError("prompt differs from root freeze")
    prompt = scorer.strict_load(prompt_path.read_text())
    outputs = []
    for context_path in sorted(DEST.glob("*-context.json")):
        context = json.loads(context_path.read_text())
        label = context["label"]
        path = DEST / (label + "-export-audit.json")
        private = RAW / label
        summary_path = REPO / context["source_summary_path"]
        if sha(summary_path) != context["summary_sha256"] or sha(private / "responses.jsonl") != context["raw_sha256"]:
            raise ValueError("completed raw/summary changed after scoring: " + label)
        if path.exists():
            out = json.loads(path.read_text())
            if out["raw_sha256"] != context["raw_sha256"]:
                raise ValueError("raw changed after export audit")
        else:
            summary = json.loads(summary_path.read_text())
            raw_rows = [scorer.strict_load(line) for line in (private / "responses.jsonl").read_text().splitlines() if line.strip()]
            raw_by_id = {row["case_id"]: row for row in raw_rows}
            if len(raw_by_id) != len(raw_rows):
                raise ValueError("duplicate raw case ID")
            rows = []
            for item in summary["cases"]:
                case_id = item["id"]
                request_path = private / (case_id + "-request.json")
                response_bin = private / (case_id + "-response.bin")
                export = raw_by_id.get(case_id)
                request = scorer.strict_load(request_path.read_text())
                expected_messages = prompt["messages"] + [{"role": "user", "content": text_by_id[case_id]}]
                request_match = request.get("messages") == expected_messages
                raw_content_match = None
                wire_parse_error = None
                if response_bin.exists():
                    try:
                        wrapper = scorer.strict_load(response_bin.read_text())
                        content = wrapper["choices"][0]["message"].get("content")
                        expected_content = content if isinstance(content, str) else ""
                        raw_content_match = export is not None and export["raw_text"] == expected_content
                    except (ValueError, UnicodeError, KeyError, IndexError, TypeError) as exc:
                        wire_parse_error = type(exc).__name__
                row = {"case_id": case_id, "runtime_status": item["status"],
                       "http_status": item.get("http_status"),
                       "request_sha256": sha(request_path),
                       "request_messages_equal_frozen_prompt_plus_case_text_only": request_match,
                       "response_bin_sha256": sha(response_bin) if response_bin.exists() else None,
                       "original_http_message_content_matches_unrepaired_export": raw_content_match,
                       "wire_parse_error": wire_parse_error}
                if not request_match:
                    raise ValueError("model input differs from frozen prompt plus text: " + label + " " + case_id)
                if item["status"] == "reply" and item.get("http_status") == 200 and raw_content_match is not True:
                    raise ValueError("HTTP200 reply export mismatch: " + label + " " + case_id)
                rows.append(row)
            out = {"version": "saved-export-provenance-audit-r1", "label": label,
                   "raw_sha256": context["raw_sha256"], "summary_sha256": context["summary_sha256"],
                   "prompt_sha256": sha(prompt_path), "fixture_sha256": sha(BASE / "cases-r1.json"),
                   "source_sha256": sha(pathlib.Path(__file__)), "model_calls": 0,
                   "attempted": len(rows),
                   "requests_match_frozen_prompt_plus_text": sum(row["request_messages_equal_frozen_prompt_plus_case_text_only"] for row in rows),
                   "http200_reply_content_matches": sum(row["original_http_message_content_matches_unrepaired_export"] is True and row["http_status"] == 200 and row["runtime_status"] == "reply" for row in rows),
                   "notes": ["Audit helper was added after initial model outputs; it does not change primary scoring or expectations.", "Only text is present as the appended user message; fixture expected/rationale/group are not provided to the model.", "Each successful reply's raw_text is compared with original saved HTTP message.content; failed or partial transport is preserved separately."],
                   "cases": rows}
            with path.open("x") as handle:
                handle.write(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
        outputs.append({"label": label, "attempted": out["attempted"], "requests_match": out["requests_match_frozen_prompt_plus_text"], "http200_content_match": out["http200_reply_content_matches"]})
    with (DEST / (args.snapshot + "-export-audits.json")).open("x") as handle:
        handle.write(json.dumps({"version": "export-audit-checkpoint-r1", "model_calls": 0, "runs": outputs}, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(outputs, ensure_ascii=False))


if __name__ == "__main__":
    main()
