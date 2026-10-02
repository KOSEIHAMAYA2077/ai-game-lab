"""Summarize explicit-PID native windows and reject mismatched app states."""
import argparse
import hashlib
import json
import statistics
from pathlib import Path


def summarize(path):
    raw = json.loads(path.read_text())
    samples = raw["samples"]
    phase = raw["label"].split("-")[-1]
    expected_paused = phase == "paused"
    expected_visible = phase != "hidden"
    errors = []
    footprints = []
    frame_counts = []
    coalitions = set()
    pids = {p["pid"] for p in samples[0]["processes"]}
    for index, sample in enumerate(samples):
        if {p["pid"] for p in sample["processes"]} != pids or len(pids) != 4:
            errors.append(f"sample {index}: explicit PID group changed")
        footprints.append(sum(p.get("footprint_bytes", 0) for p in sample["processes"]))
        for process in sample["processes"]:
            if "error" in process:
                errors.append(f"sample {index}: missing PID {process['pid']}")
            coalitions.add((process.get("coalition_resource_id"), process.get("coalition_jetsam_id")))
        native = sample.get("native", {})
        web = native.get("web", {})
        expected = {
            "storedGlyphs": 1665, "renderedGlyphs": 1536,
            "paused": expected_paused, "visible": expected_visible,
            "workerCount": 0, "busy": False,
        }
        for key, value in expected.items():
            if web.get(key) != value:
                errors.append(f"sample {index}: {key}={web.get(key)!r}, expected {value!r}")
        if native.get("nativeHidden") is not (not expected_visible):
            errors.append(f"sample {index}: native hide state differs from window")
        if native.get("nativeVisible") is not expected_visible:
            errors.append(f"sample {index}: native window visibility differs from window")
        if web.get("workerActive") is not False:
            errors.append(f"sample {index}: workerActive not false")
        frame_counts.append(web.get("frames"))
    if len(coalitions) != 1 or (None, None) in coalitions:
        errors.append("coalition membership differs or unavailable")
    if phase in ("paused", "hidden") and len(set(frame_counts)) != 1:
        errors.append(f"{phase}: frame counter advanced")
    elapsed = raw["elapsed_seconds"]
    frames_delta = frame_counts[-1] - frame_counts[0]
    return {
        "source": path.name,
        "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "label": raw["label"], "elapsed_seconds": elapsed,
        "samples": len(samples), "explicit_pid_group": sorted(pids),
        "coalition": list(next(iter(coalitions))) if len(coalitions) == 1 else None,
        "cpu_single_core_percent": raw["cpu_single_core_percent"],
        "charged_footprint_mib": {
            "first": footprints[0] / 1048576,
            "median": statistics.median(footprints) / 1048576,
            "peak": max(footprints) / 1048576,
            "last": footprints[-1] / 1048576,
        },
        "frame_count_first": frame_counts[0], "frame_count_last": frame_counts[-1],
        "frames_delta": frames_delta, "frames_per_wall_second": frames_delta / elapsed,
        "validation_passed": not errors, "validation_errors": errors,
        "warning": "charged per-process footprint sum is not unique system RAM; CPU 100% means one logical core; telemetry frame sampling has about one second lag; GPU and power unmeasured",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs", type=Path, nargs="+")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    results = [summarize(path) for path in args.inputs]
    args.output.write_text(json.dumps({"windows": results}, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"windows": results}, ensure_ascii=False, indent=2))
    raise SystemExit(0 if all(result["validation_passed"] for result in results) else 1)
