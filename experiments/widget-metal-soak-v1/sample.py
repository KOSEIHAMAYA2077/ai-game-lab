"""Explicit-PID resource monitor for the isolated offscreen engine; no UI control."""
import argparse
import json
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--helper', type=Path, required=True)
parser.add_argument('--run', type=Path, required=True)
parser.add_argument('--interval', type=float, default=5)
args = parser.parse_args()
if args.interval < 1 or args.interval > 30:
    raise SystemExit('Interval must be 1..30 seconds')
run_file = args.run / 'run.json'
pid_file = args.run / 'pid.txt'
for _ in range(120):
    if run_file.exists() and pid_file.exists() and (args.run / 'progress.json').exists():
        break
    time.sleep(.5)
else:
    raise SystemExit('Owned engine did not become ready')
metadata = json.loads(run_file.read_text())
pid = int(pid_file.read_text())
if metadata['pid'] != pid or metadata['scope'] != 'offscreen-engine-soak-not-window-app':
    raise SystemExit('Owned run identity mismatch')
output = args.run / 'resource-samples.ndjson'
summary_file = args.run / 'resource-summary.json'
if output.exists() or summary_file.exists():
    raise SystemExit('Resource output already exists; do not replace prior records')
first = last = None
peak_footprint = peak_rss = lifetime_peak = 0
samples = missing = 0
started = time.monotonic()
identity = None
cpu_intervals = []
status = 'running'
stop_after = metadata['durationSeconds'] + 120
stream = output.open('x')
try:
    while time.monotonic() - started < stop_after:
        row = json.loads(subprocess.check_output([str(args.helper), str(pid)], text=True))
        proc = row['processes'][0]
        progress_file = args.run / 'progress.json'
        try:
            progress = json.loads(progress_file.read_text())
        except (OSError, ValueError):
            progress = {'diagnosticReadError': True}
        row['scope'] = 'offscreen-engine-soak-not-window-app'
        row['observedUTC'] = datetime.now(timezone.utc).isoformat()
        row['engine'] = progress
        stream.write(json.dumps(row, sort_keys=True) + '\n')
        stream.flush()
        samples += 1
        if 'error' in proc:
            missing += 1
            status = 'engine-exited'
        else:
            if identity is None:
                identity = proc['start_abstime']
                first = row
            if proc['start_abstime'] != identity:
                status = 'pid-reused-monitor-stopped'
                break
            if last is not None:
                before = last['processes'][0]
                duration = (row['monotonic_ns'] - last['monotonic_ns']) / 1e9
                delta = proc['user_ns'] + proc['system_ns'] - before['user_ns'] - before['system_ns']
                if duration > 0 and delta >= 0:
                    cpu_intervals.append({'endUTC': row['observedUTC'], 'seconds': duration, 'singleCorePercent': delta / 1e9 / duration * 100})
            last = row
            peak_footprint = max(peak_footprint, proc['footprint_bytes'])
            peak_rss = max(peak_rss, proc['resident_bytes'])
            lifetime_peak = max(lifetime_peak, proc['lifetime_max_footprint_bytes'])
        elapsed = (last['monotonic_ns'] - first['monotonic_ns']) / 1e9 if first and last else 0
        cpu = None
        if elapsed:
            before, after = first['processes'][0], last['processes'][0]
            cpu = (after['user_ns'] + after['system_ns'] - before['user_ns'] - before['system_ns']) / 1e9 / elapsed * 100
        result_file = args.run / 'result.json'
        if result_file.exists():
            try:
                final = json.loads(result_file.read_text())
                status = final['status']
            except (OSError, ValueError):
                final = None
        else:
            final = None
        summary = {
            'scope': 'offscreen-engine-soak-not-window-app', 'pid': pid,
            'processStartAbstime': identity, 'status': status,
            'samplingIntervalSeconds': args.interval, 'samples': samples, 'missingSamples': missing,
            'elapsedValidSeconds': elapsed, 'cpuSingleCorePercent': cpu,
            'peakChargedFootprintBytes': peak_footprint, 'peakRSSBytes': peak_rss,
            'processLifetimeMaximumFootprintBytes': lifetime_peak,
            'firstChargedFootprintBytes': first['processes'][0]['footprint_bytes'] if first else None,
            'lastChargedFootprintBytes': last['processes'][0]['footprint_bytes'] if last else None,
            'machTimebase': first['mach_timebase'] if first else None,
            'calibrationSource': 'native_metrics.c uses mach_timebase_info; CPU counters converted before percentages',
            'initialLibraryCompilationExcludedFromCPUInterval': True,
            'lifetimeMaximumMayIncludeInitialization': True,
            'windowAppCPUorRAMMeasured': False, 'systemUniqueRAMMeasured': False,
            'GPUUtilizationMeasured': False, 'powerMeasured': False,
            'conditions': 'Other CPU/model experiments may run concurrently; only this explicit owned PID is counted. Driver, WindowServer, compiler services are not assigned to this process.',
            'lastEngineProgress': progress,
            'engineFinal': final,
        }
        temporary = summary_file.with_suffix('.pending')
        temporary.write_text(json.dumps(summary, sort_keys=True, indent=2))
        temporary.replace(summary_file)
        if status != 'running':
            break
        time.sleep(args.interval)
finally:
    stream.close()
    (args.run / 'resource-cpu-intervals.json').write_text(json.dumps(cpu_intervals, indent=2))
print(json.dumps({k: v for k, v in summary.items() if k not in ('engineFinal', 'lastEngineProgress')}, sort_keys=True))
