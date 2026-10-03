"""Freeze complete resource diagnostics and phase-specific RSS summaries."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
MODELS = ["bonsai-1.7b-q1", "bonsai-4b-q1"]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    records = []
    for model_id in MODELS:
        folder = HERE / "results-r1" / model_id
        diagnosis_path = folder / "diagnosis-r1.json"
        if not diagnosis_path.exists() or not (folder / "WIRE-CLI-AUDIT-R1.json").exists():
            raise RuntimeError("Wait for terminal score and wire audit for both candidates")
        diagnosis = json.loads(diagnosis_path.read_text())
        raw = REPO / ".local/small-model-sweep-v1/raw-resources" / diagnosis["label"]
        public = REPO / "experiments/small-model-sweep-resources-v1/results" / diagnosis["label"]
        paths = {"summary_sha256": public / "summary.json", "responses_sha256": raw / "responses.jsonl", "rss_samples_sha256": public / "rss-samples.json", "score_sha256": folder / "score-r1.json"}
        for key, path in paths.items():
            if sha(path) != diagnosis[key]:
                raise RuntimeError("Final source pin mismatch: " + model_id)
        summary = json.loads((public / "summary.json").read_text())
        samples = json.loads((public / "rss-samples.json").read_text())
        marker = summary.get("idle", {}).get("started_batch_seconds")
        if marker is None:
            active_phase = [s["rss_bytes"] for s in samples if s["rss_bytes"] is not None]
        else:
            active_phase = [s["rss_bytes"] for s in samples if s["rss_bytes"] is not None and s["seconds"] < marker]
        records.append({**diagnosis,
            "startup_and_queries_rss_peak_bytes_sampled": max(active_phase) if active_phase else None,
            "startup_and_queries_rss_samples": len(active_phase),
            "phase_note": "RSS before idle-start marker, includes startup and36 queries; non-idle candidate includes whole short run. All phases use saved server-only samples.",
            "wire_cli_audit_sha256": sha(folder / "WIRE-CLI-AUDIT-R1.json"), "diagnosis_sha256": sha(diagnosis_path)})
    review = json.loads((HERE / "SOURCE-REVIEW-R1.json").read_text())
    if sha(REPO / "experiments/small-model-sweep-resources-v1/run_r2.py") != review["resource_driver_sha256"]:
        raise RuntimeError("Frozen resource driver changed")
    out = {"version": "seen36-resource-comparison-r1", "source_review_sha256": sha(HERE / "SOURCE-REVIEW-R1.json"),
        "scope": "Resource regression on previously seen36 artificial shape/action sentences. Not fresh or generalization evidence. Not unknown3D generation or complete widget validation.",
        "limitations": ["4 parameters changed together, cannot attribute differences to one parameter", "One run each, not repeated speed study or precision confidence estimate", "Owned server RSS/TIME only; monitor, UI, OS and power excluded", "Idle measured only for4B, post-query loaded state; no unloaded baseline", "TIME display precision and lsof/ps timing overhead limit small CPU estimates", "Startup is after file hashing, not controlled cold start", "Same model/runtime/prompt/fixture held for paired diagnosis; raw text unmodified"],
        "reviewer_model_or_server_calls": 0, "records": records}
    with (HERE / "COMPARISON-R1.json").open("x") as handle:
        handle.write(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({"records": len(records), "all_original_source_hashes_ok": True}))


if __name__ == "__main__":
    main()
