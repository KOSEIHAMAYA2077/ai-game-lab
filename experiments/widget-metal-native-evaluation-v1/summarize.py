"""Validate and summarize future explicit-PID Metal/WK native windows.

This does not discover, launch, manipulate or stop any application.
"""
import argparse
import hashlib
import json
import math
import statistics
from pathlib import Path


def summarize(path, renderer, phase, stored, drawn, pid_count, shape):
    raw = json.loads(path.read_text())
    samples = raw["samples"]
    paused, visible = phase == "paused", phase != "hidden"
    errors = []
    pids = {process["pid"] for process in samples[0]["processes"]}
    footprints, frames, coalitions, viewports = [], [], set(), set()
    shader_ms = []
    for index, sample in enumerate(samples):
        processes = sample["processes"]
        if {process["pid"] for process in processes} != pids or len(pids) != pid_count:
            errors.append(f"sample {index}: declared PID group changed or wrong count")
        footprints.append(sum(process.get("footprint_bytes", 0) for process in processes))
        for process in processes:
            if "error" in process:
                errors.append(f"sample {index}: missing PID {process['pid']}")
            coalitions.add((process.get("coalition_resource_id"), process.get("coalition_jetsam_id")))
        native = sample.get("native", {})
        if renderer == "metal":
            observed = native
            expected = {
                "renderer": "metal-lab-v1", "storedGlyphs": stored,
                "drawnGlyphs": drawn, "paused": paused, "hidden": not visible,
                "scheduled": not paused and visible, "preferredFPS": 15,
                "shape": shape, "metalErrorCount": 0,
            }
            viewports.add((native.get("width"), native.get("height")))
            value = native.get("shaderCompileMS")
            if isinstance(value, (float, int)) and math.isfinite(value):
                shader_ms.append(value)
        else:
            observed = native.get("web", {})
            expected = {
                "storedGlyphs": stored, "renderedGlyphs": drawn,
                "paused": paused, "visible": visible, "workerCount": 0,
                "workerActive": False, "busy": False,
            }
            if native.get("nativeVisible") is not visible:
                errors.append(f"sample {index}: nativeVisible mismatch, possibly lock/occlusion")
            if native.get("nativeHidden") is not (not visible):
                errors.append(f"sample {index}: nativeHidden mismatch")
        for key, value in expected.items():
            if observed.get(key) != value:
                errors.append(f"sample {index}: {key}={observed.get(key)!r}, expected {value!r}")
        count = observed.get("frames")
        if not isinstance(count, int) or isinstance(count, bool):
            errors.append(f"sample {index}: invalid frame count")
        frames.append(count)
    if len(coalitions) != 1 or (None, None) in coalitions:
        errors.append("coalition differs or unavailable; ownership needs separate proof")
    if phase in ("paused", "hidden") and len(set(frames)) != 1:
        errors.append(f"{phase}: frame counter advanced")
    if phase == "calm" and frames[-1] == frames[0]:
        errors.append("calm: no frames advanced")
    if renderer == "metal" and (len(viewports) != 1 or (None, None) in viewports):
        errors.append("Metal viewport differs or unavailable")
    elapsed = raw["elapsed_seconds"]
    delta = frames[-1] - frames[0] if isinstance(frames[-1], int) and isinstance(frames[0], int) else None
    result = {
        "source": path.name, "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "renderer": renderer, "phase": phase, "samples": len(samples),
        "elapsed_seconds": elapsed, "explicit_pid_group": sorted(pids),
        "storedGlyphs": stored, "drawnGlyphs": drawn,
        "cpu_single_core_percent": raw["cpu_single_core_percent"],
        "charged_footprint_mib": {
            "first": footprints[0] / 1048576, "median": statistics.median(footprints) / 1048576,
            "peak": max(footprints) / 1048576, "last": footprints[-1] / 1048576,
        },
        "frames_first": frames[0], "frames_last": frames[-1], "frames_delta": delta,
        "frames_per_wall_second": delta / elapsed if delta is not None else None,
        "validation_passed": not errors, "validation_errors": errors,
        "warning": "charged process footprint sum is not unique system RAM; CPU 100% is one logical core; frame telemetry can lag; shader/submit MS is wall elapsed, not OS CPU or GPU time; process ownership requires separate before/after/exit proof",
    }
    if renderer == "metal":
        result["reported_viewport"] = list(next(iter(viewports))) if len(viewports) == 1 else None
        result["shader_compile_wall_ms_reported"] = shader_ms[0] if shader_ms and len(set(shader_ms)) == 1 else None
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--renderer", choices=["metal", "wk"], required=True)
    parser.add_argument("--phase", choices=["calm", "paused", "hidden"], required=True)
    parser.add_argument("--stored", type=int, default=1536)
    parser.add_argument("--drawn", type=int, default=1536)
    parser.add_argument("--pid-count", type=int, required=True)
    parser.add_argument("--shape", type=int, default=0)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = summarize(args.input, args.renderer, args.phase, args.stored, args.drawn, args.pid_count, args.shape)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["validation_passed"] else 1)
