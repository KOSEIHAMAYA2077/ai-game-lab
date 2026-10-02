"""Read saved explicit-PID samples. No process discovery, UI or app execution."""
import argparse
import hashlib
import json
import math
import statistics
from pathlib import Path


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def equal(value, expected):
    if isinstance(expected, bool):
        return isinstance(value, bool) and value is expected
    if number(expected):
        return number(value) and value == expected
    return value == expected


def summarize(raw, expectation, phase):
    errors, warnings = [], []
    samples = raw.get('samples', [])
    renderer = expectation.get('renderer')
    if renderer not in ('metal', 'wk'):
        errors.append('invalid renderer expectation')
    if phase not in ('calm', 'paused', 'hidden'):
        errors.append('invalid phase')
    processes = expectation.get('processes', [])
    expected_pids = [p.get('pid') for p in processes]
    if not expected_pids or len(set(expected_pids)) != len(expected_pids):
        errors.append('explicit PID list empty or duplicated')
    expected = {p['pid']: p for p in processes if isinstance(p.get('pid'), int)}
    main_pid = expectation.get('main_pid')
    if main_pid not in expected:
        errors.append('main PID not attributed')
    if len(samples) < 2:
        errors.append('at least two samples are required')
    for key in ('ui_confirmed', 'heavy_work_absent', 'settled_body_confirmed'):
        if expectation.get('conditions', {}).get(key) is not True:
            errors.append('root condition proof missing: ' + key)
    body = expectation.get('body', {})
    viewport = expectation.get('viewport', {})
    frames, timestamps, footprint, rss = [], [], [], []
    pid_series = {pid: [] for pid in expected}
    metal_fields = ['atlasKinds', 'atlasRows', 'atlasRGBABytes', 'instanceBytes', 'uniformBytes',
                    'cameraDistance', 'framingMinimum', 'manualZoom', 'frustumFar',
                    'shaderCompileMS', 'submitElapsedP95MS', 'submitElapsedMaximumMS']
    diagnostics = {key: [] for key in metal_fields}
    for i, sample in enumerate(samples):
        observed_processes = sample.get('processes', [])
        ids = [p.get('pid') for p in observed_processes]
        if len(ids) != len(set(ids)) or set(ids) != set(expected):
            errors.append(f'sample {i}: explicit PID set changed/duplicated')
        if sample.get('native_metrics_read_error'):
            errors.append(f'sample {i}: telemetry read failed')
        stamp = sample.get('monotonic_ns')
        if not number(stamp) or stamp < 0:
            errors.append(f'sample {i}: invalid monotonic counter')
        timestamps.append(stamp)
        sample_valid = len(ids) == len(set(ids)) and set(ids) == set(expected)
        for process in observed_processes:
            pid = process.get('pid')
            if pid not in expected:
                continue
            identity = expected[pid]
            if 'error' in process:
                sample_valid = False
                errors.append(f'sample {i}: missing PID {pid}')
            for key in ('start_abstime', 'coalition_resource_id', 'coalition_jetsam_id'):
                value = identity.get(key)
                if not number(value) or value < 0 or not equal(process.get(key), value):
                    sample_valid = False
                    errors.append(f'sample {i}: PID {pid} identity {key} differs/unavailable')
            for key in ('user_ns', 'system_ns', 'footprint_bytes', 'resident_bytes', 'lifetime_max_footprint_bytes'):
                value = process.get(key)
                if not number(value) or value < 0:
                    sample_valid = False
                    errors.append(f'sample {i}: PID {pid} invalid {key}')
            pid_series[pid].append(process)
        footprint.append(sum(p['footprint_bytes'] for p in observed_processes) if sample_valid else None)
        rss.append(sum(p['resident_bytes'] for p in observed_processes) if sample_valid else None)
        native = sample.get('native', {})
        if not equal(native.get('pid'), main_pid):
            errors.append(f'sample {i}: native main PID mismatch')
        paused, visible = phase == 'paused', phase != 'hidden'
        if renderer == 'metal':
            observed = native
            fields = {'renderer': 'metal-lab-v2', 'storedGlyphs': body.get('stored'),
                      'drawnGlyphs': body.get('drawn'), 'paused': paused, 'hidden': not visible,
                      'scheduled': not paused and visible, 'preferredFPS': 15,
                      'shape': body.get('shape', 0), 'metalErrorCount': 0,
                      'width': viewport.get('width'), 'height': viewport.get('height'), 'manualZoom': 1}
            for key in metal_fields:
                value = native.get(key)
                if not number(value) or value < 0:
                    errors.append(f'sample {i}: Metal {key} unavailable/invalid')
                else:
                    diagnostics[key].append(value)
            for key, value in expectation.get('expected_native_bytes', {}).items():
                fields[key] = value
        else:
            observed = native.get('web', {})
            fields = {'storedGlyphs': body.get('stored'), 'renderedGlyphs': body.get('drawn'),
                      'paused': paused, 'visible': visible, 'workerCount': 0, 'workerActive': False,
                      'modelLoaded': False, 'busy': False, 'fps': 15 if phase == 'calm' else 0}
            native_fields = {'appVersion': expectation.get('app_version', '0.14.2'),
                             'nativeVisible': visible, 'nativeHidden': not visible,
                             'nativeMiniaturized': False, 'nativeOccluded': not visible}
            for key, value in native_fields.items():
                if not equal(native.get(key), value):
                    errors.append(f'sample {i}: native {key} mismatch')
        for key, value in fields.items():
            if value is None or not equal(observed.get(key), value):
                errors.append(f'sample {i}: {key} mismatch/missing')
        count = observed.get('frames')
        if not isinstance(count, int) or isinstance(count, bool) or count < 0:
            errors.append(f'sample {i}: invalid frame counter')
            count = None
        frames.append(count)
    times_valid = len(timestamps) >= 2 and all(number(t) for t in timestamps)
    elapsed = (timestamps[-1] - timestamps[0]) / 1e9 if times_valid else None
    target_seconds = 90 if phase == 'calm' else 30
    if not number(elapsed) or abs(elapsed - target_seconds) > 2:
        errors.append('sample interval duration outside fixed window')
    if not equal(raw.get('sampling_interval_seconds'), 0.5):
        errors.append('declared sampling interval differs from 0.5s')
    if times_valid:
        intervals = [(b-a)/1e9 for a, b in zip(timestamps, timestamps[1:])]
        if any(t <= 0 or t > 1.5 for t in intervals):
            errors.append('monotonic sample interval invalid or >1.5s')
    else:
        intervals = []
    frame_valid = len(frames) >= 2 and all(isinstance(v, int) for v in frames)
    delta = frames[-1] - frames[0] if frame_valid else None
    frame_rate = delta / elapsed if frame_valid and number(elapsed) and elapsed > 0 else None
    if frame_valid and any(a > b for a, b in zip(frames, frames[1:])):
        errors.append('frame counter decreased')
    if phase == 'calm':
        if not number(frame_rate) or not 14 <= frame_rate <= 16:
            errors.append('calm frame-counter cadence outside 14..16/s')
    elif delta != 0:
        errors.append('paused/hidden frame counter advanced or unavailable')
    cpu_by_pid = []
    for pid, series in pid_series.items():
        keys = ('user_ns', 'system_ns', 'lifetime_max_footprint_bytes')
        valid = len(series) == len(samples) and bool(series) and all(all(number(p.get(k)) and p[k] >= 0 for k in keys) for p in series)
        cpu = None
        if valid and number(elapsed) and elapsed > 0:
            counters = [p['user_ns'] + p['system_ns'] for p in series]
            if any(a > b for a, b in zip(counters, counters[1:])):
                errors.append(f'PID {pid}: CPU counter decreased')
            else:
                cpu = (counters[-1] - counters[0]) / 1e9 / elapsed * 100
        cpu_by_pid.append({'pid': pid, 'role': expected[pid].get('role'), 'cpu_single_core_percent': cpu,
                           'process_lifetime_max_footprint_bytes': max(p['lifetime_max_footprint_bytes'] for p in series) if valid else None})
    cpu_complete = bool(cpu_by_pid) and all(number(p['cpu_single_core_percent']) for p in cpu_by_pid)
    cpu_sum = sum(p['cpu_single_core_percent'] for p in cpu_by_pid) if cpu_complete else None
    reported = raw.get('cpu_single_core_percent')
    if cpu_sum is None or not number(reported) or abs(cpu_sum - reported) > 0.000001:
        errors.append('CPU aggregate missing or differs from recomputed counters')
    if number(elapsed) and not equal(raw.get('elapsed_seconds'), elapsed):
        errors.append('sampler elapsed differs from monotonic counters')
    def stats(values):
        if not values or any(v is None for v in values):
            return None
        return dict(first=values[0], median=statistics.median(values), peak=max(values), last=values[-1])
    charged, resident = stats(footprint), stats(rss)
    if charged and not equal(raw.get('peak_sum_charged_footprint_bytes'), charged['peak']):
        errors.append('sampler charged peak differs from coincident sum')
    if renderer == 'wk':
        warnings.append('WK shape/camera/viewport/atlas bytes rely on root sidecar inspection; absent from native telemetry')
    result = {'schema': 2, 'renderer': renderer, 'phase': phase, 'samples': len(samples),
              'elapsed_seconds': elapsed, 'explicit_pid_group': sorted(expected),
              'body_expectation': body, 'viewport_expectation': viewport,
              'frames_first': frames[0] if frames else None, 'frames_last': frames[-1] if frames else None,
              'frames_delta': delta, 'frames_per_wall_second': frame_rate,
              'cpu_single_core_percent': cpu_sum, 'per_process': cpu_by_pid,
              'charged_footprint_bytes': charged, 'RSS_bytes': resident,
              'declared_fixture_differences': expectation.get('fixture_differences', {}),
              'comparison_observations': expectation.get('comparison_observations', {}),
              'validation_passed': not errors, 'validation_errors': sorted(set(errors)),
              'warnings': warnings + ['charged footprint sum is not unique system RAM; frame telemetry is not presentation FPS; shader/submit ms is wall elapsed; UI/ownership proof is root supplied; no GPU/power/laptop measurement'],
              'candidate_budget': {'cpu_limit_single_core_percent': 5, 'charged_peak_limit_MiB': 200,
                                   'within_values': bool(cpu_sum is not None and charged and cpu_sum <= 5 and charged['peak'] <= 200*1048576),
                                   'eligible_only_if_validation_passed_and_phase_calm': not errors and phase == 'calm'}}
    if renderer == 'metal':
        result['metal_diagnostics'] = {key: dict(first=v[0], last=v[-1], minimum=min(v), maximum=max(v)) if v else None for key, v in diagnostics.items()}
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('input', type=Path)
    parser.add_argument('--expectation', type=Path, required=True)
    parser.add_argument('--phase', choices=['calm', 'paused', 'hidden'], required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Output exists; preserve prior result and use a new path')
    raw_bytes, expected_bytes = args.input.read_bytes(), args.expectation.read_bytes()
    result = summarize(json.loads(raw_bytes), json.loads(expected_bytes), args.phase)
    result.update(source=args.input.name, source_sha256=hashlib.sha256(raw_bytes).hexdigest(),
                  expectation=args.expectation.name, expectation_sha256=hashlib.sha256(expected_bytes).hexdigest())
    with args.output.open('x') as output:
        json.dump(result, output, ensure_ascii=False, indent=2, allow_nan=False)
        output.write('\n')
    print(json.dumps({k: result[k] for k in ('renderer', 'phase', 'validation_passed', 'cpu_single_core_percent', 'charged_footprint_bytes', 'validation_errors')}, ensure_ascii=False))
    raise SystemExit(0 if result['validation_passed'] else 1)
