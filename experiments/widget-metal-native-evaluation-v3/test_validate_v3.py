"""Synthetic saved samples only. No helper subprocess, OS monitoring or UI."""
import argparse
import copy
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True
from validate import summarize


def fixture(renderer, phase):
    pids = [101] if renderer == 'metal' else [301, 302, 303, 304]
    seconds = 90 if phase == 'calm' else 30
    attribution = [{'pid': p, 'start_abstime': 9000+p, 'coalition_resource_id': 111,
                    'coalition_jetsam_id': 112, 'role': 'synthetic'} for p in pids]
    expect = {'renderer': renderer, 'main_pid': pids[0], 'processes': attribution,
              'conditions': dict(ui_confirmed=True, heavy_work_absent=True, settled_body_confirmed=True),
              'body': dict(stored=1537, drawn=1536, shape=0), 'viewport': dict(width=400, height=440),
              'app_version': '0.14.2', 'expected_native_bytes': dict(instanceBytes=122880, uniformBytes=336),
              'fixture_differences': {'synthetic_only': True}}
    samples = []
    for i in range(seconds*2+1):
        t = i/2
        procs = [dict(p, user_ns=int((1+t)*10_000_000), system_ns=1_000_000,
                      footprint_bytes=20*1048576, resident_bytes=30*1048576,
                      lifetime_max_footprint_bytes=25*1048576) for p in attribution]
        paused, visible = phase == 'paused', phase != 'hidden'
        frame = 100+int(t*15) if phase == 'calm' else 100
        native = dict(pid=pids[0])
        if renderer == 'metal':
            native.update(renderer='metal-lab-v3', storedGlyphs=1537, drawnGlyphs=1536,
                          paused=paused, hidden=not visible, scheduled=not paused and visible,
                          preferredFPS=15, shape=0, metalErrorCount=0, width=400, height=440,
                          frames=frame, atlasKinds=22, atlasRows=1, atlasRGBABytes=524288,
                          instanceBytes=122880, uniformBytes=336, cameraDistance=12,
                          framingMinimum=10, manualZoom=1, frustumFar=100,
                          shaderCompileMS=200, submitElapsedP95MS=.3, submitElapsedMaximumMS=2)
        else:
            native.update(appVersion='0.14.2', nativeVisible=visible, nativeHidden=not visible,
                          nativeMiniaturized=False, nativeOccluded=not visible,
                          web=dict(storedGlyphs=1537, renderedGlyphs=1536, paused=paused,
                                   visible=visible, workerCount=0, workerActive=False, modelLoaded=False,
                                   busy=False, fps=15 if phase == 'calm' else 0, frames=frame))
        samples.append(dict(monotonic_ns=int((100+t)*1e9), processes=procs, native=native))
    raw = dict(samples=samples, elapsed_seconds=seconds, sampling_interval_seconds=.5,
               cpu_single_core_percent=len(pids), peak_sum_charged_footprint_bytes=20*1048576*len(pids))
    return raw, expect


def main(output):
    results = []
    def record(name, raw, expect, phase, should_pass):
        try:
            result = summarize(raw, expect, phase)
            passed = result['validation_passed'] is should_pass
            results.append(dict(name=name, passed=passed, expected_validation=should_pass,
                                actual_validation=result['validation_passed'], errors=result['validation_errors']))
        except Exception as error:
            results.append(dict(name=name, passed=False, exception=repr(error)))
    for renderer in ('metal', 'wk'):
        for phase in ('calm', 'paused', 'hidden'):
            raw, expect = fixture(renderer, phase)
            record(renderer+'-'+phase, raw, expect, phase, True)
    changes = {
        'missing-pid': lambda r, e: r['samples'][3]['processes'][0].update(error=3),
        'reused-pid': lambda r, e: r['samples'][3]['processes'][0].update(start_abstime=1),
        'coalition-mismatch': lambda r, e: r['samples'][3]['processes'][0].update(coalition_resource_id=9),
        'duplicate-pid': lambda r, e: r['samples'][3]['processes'].append(copy.deepcopy(r['samples'][3]['processes'][0])),
        'unexpected-pid': lambda r, e: r['samples'][3]['processes'].append({'pid': 999, 'error': 3}),
        'counter-decreased': lambda r, e: r['samples'][3]['processes'][0].update(user_ns=0),
        'negative-footprint': lambda r, e: r['samples'][3]['processes'][0].update(footprint_bytes=-1),
        'cpu-sum-wrong': lambda r, e: r.update(cpu_single_core_percent=0),
        'footprint-peak-wrong': lambda r, e: r.update(peak_sum_charged_footprint_bytes=1),
        'monotonic-reversed': lambda r, e: r['samples'][3].update(monotonic_ns=0),
        'renderer-wrong': lambda r, e: r['samples'][3]['native'].update(renderer='metal-lab-v1'),
        'viewport-wrong': lambda r, e: r['samples'][3]['native'].update(width=300),
        'model-work-proof-missing': lambda r, e: e['conditions'].update(heavy_work_absent=False),
        'frame-boolean': lambda r, e: r['samples'][3]['native'].update(frames=True),
        'body-wrong': lambda r, e: r['samples'][3]['native'].update(storedGlyphs=1536),
        'zoom-below-one': lambda r, e: r['samples'][3]['native'].update(manualZoom=.65),
        'empty-samples': lambda r, e: r.update(samples=[]),
    }
    for name, change in changes.items():
        raw, expect = fixture('metal', 'calm');change(raw, expect)
        record(name, raw, expect, 'calm', False)
    for phase in ('paused', 'hidden'):
        raw, expect = fixture('wk', phase);raw['samples'][-1]['native']['web']['frames'] += 1
        record('wk-'+phase+'-still-draws', raw, expect, phase, False)
    for name, change in {'wk-worker': lambda r: r['samples'][3]['native']['web'].update(workerActive=True),
                         'wk-occluded': lambda r: r['samples'][3]['native'].update(nativeOccluded=True)}.items():
        raw, expect = fixture('wk', 'calm');change(raw);record(name, raw, expect, 'calm', False)
    result = dict(scope='synthetic-JSON-only-not-live-measurement', cases=len(results),
                  passed=sum(r['passed'] for r in results), results=results)
    with output.open('x') as f:
        json.dump(result, f, indent=2, allow_nan=False);f.write('\n')
    print(json.dumps({k: result[k] for k in ('scope', 'cases', 'passed')}))
    raise SystemExit(0 if result['passed'] == len(results) else 1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser();parser.add_argument('--output', type=Path, required=True)
    main(parser.parse_args().output)
