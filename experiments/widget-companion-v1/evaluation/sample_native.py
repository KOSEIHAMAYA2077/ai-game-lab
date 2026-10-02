"""Sample explicit, already-attributed macOS process IDs; no process discovery."""
import argparse
import json
import subprocess
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--helper", type=Path, required=True)
    parser.add_argument("--pids", type=int, nargs="+", required=True)
    parser.add_argument("--seconds", type=float, default=60)
    parser.add_argument("--interval", type=float, default=1)
    parser.add_argument("--label", required=True)
    parser.add_argument("--state-file", type=Path)
    parser.add_argument("--native-metrics", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    samples = []
    started = time.monotonic()
    next_at = started
    while True:
        sample = json.loads(subprocess.check_output(
            [str(args.helper), *map(str, args.pids)], text=True))
        sample["state"] = args.label
        if args.state_file and args.state_file.exists():
            sample["state"] = args.state_file.read_text().strip()[:80] or args.label
        if args.native_metrics and args.native_metrics.exists():
            try:
                sample["native"] = json.loads(args.native_metrics.read_text())
            except (OSError, json.JSONDecodeError):
                sample["native_metrics_read_error"] = True
        samples.append(sample)
        if time.monotonic() - started >= args.seconds:
            break
        next_at += args.interval
        time.sleep(max(0, next_at - time.monotonic()))
    first = {item["pid"]: item for item in samples[0]["processes"]}
    last = {item["pid"]: item for item in samples[-1]["processes"]}
    elapsed = (samples[-1]["monotonic_ns"] - samples[0]["monotonic_ns"]) / 1e9
    per_process = []
    for pid in args.pids:
        valid = [next((x for x in sample["processes"] if x["pid"] == pid and "error" not in x), None)
                 for sample in samples]
        valid = [item for item in valid if item]
        before, after = first.get(pid, {}), last.get(pid, {})
        cpu = None
        if ("error" not in before and "error" not in after
                and before.get("start_abstime") == after.get("start_abstime")
                and "user_ns" in before and "user_ns" in after):
            cpu = ((after["user_ns"] + after["system_ns"]
                    - before["user_ns"] - before["system_ns"]) / 1e9 / elapsed * 100)
        per_process.append({
            "pid": pid,
            "cpu_single_core_percent": cpu,
            "peak_footprint_bytes": max((x["footprint_bytes"] for x in valid), default=None),
            "first_footprint_bytes": valid[0]["footprint_bytes"] if valid else None,
            "last_footprint_bytes": valid[-1]["footprint_bytes"] if valid else None,
            "lifetime_max_footprint_bytes": max((x["lifetime_max_footprint_bytes"] for x in valid), default=None),
            "missing_samples": len(samples) - len(valid),
        })
    totals = [sum(x.get("footprint_bytes", 0) for x in sample["processes"])
              for sample in samples]
    state_summary = {}
    for index, sample in enumerate(samples):
        state = sample["state"]
        summary = state_summary.setdefault(state, {
            "samples": 0, "peak_sum_charged_footprint_bytes": 0,
            "cpu_seconds": 0, "elapsed_valid_seconds": 0,
            "incomplete_cpu_intervals": 0,
        })
        summary["samples"] += 1
        summary["peak_sum_charged_footprint_bytes"] = max(
            summary["peak_sum_charged_footprint_bytes"], totals[index])
        if index == 0 or samples[index - 1]["state"] != state:
            continue
        previous = {item["pid"]: item for item in samples[index - 1]["processes"]}
        duration = (sample["monotonic_ns"] - samples[index - 1]["monotonic_ns"]) / 1e9
        delta_ns = 0
        valid = True
        for item in sample["processes"]:
            before = previous.get(item["pid"], {})
            if ("user_ns" not in item or "user_ns" not in before
                    or item.get("start_abstime") != before.get("start_abstime")):
                valid = False
                continue
            delta_ns += item["user_ns"] + item["system_ns"] - before["user_ns"] - before["system_ns"]
        if valid:
            summary["cpu_seconds"] += delta_ns / 1e9
            summary["elapsed_valid_seconds"] += duration
        else:
            summary["incomplete_cpu_intervals"] += 1
    for summary in state_summary.values():
        summary["cpu_single_core_percent"] = (
            summary["cpu_seconds"] / summary["elapsed_valid_seconds"] * 100
            if summary["elapsed_valid_seconds"] else None)
    result = {
        "label": args.label, "elapsed_seconds": elapsed,
        "sampling_interval_seconds": args.interval, "per_process": per_process,
        "peak_sum_charged_footprint_bytes": max(totals),
        "first_sum_charged_footprint_bytes": totals[0],
        "last_sum_charged_footprint_bytes": totals[-1],
        "sum_per_process_lifetime_max_footprint_bytes": sum(
            x["lifetime_max_footprint_bytes"] or 0 for x in per_process),
        "cpu_single_core_percent": sum(x["cpu_single_core_percent"] or 0 for x in per_process),
        "state_summary": state_summary,
        "warning": "Explicit PID group, per-process charged footprint sum; not unique system RAM. The sum of per-process lifetime peaks is an upper envelope, not a coincident app peak. Missing process samples make CPU sum incomplete. GPU utilization and power are not measured.",
        "samples": samples,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({key: value for key, value in result.items() if key != "samples"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
