"""Independent saved-value audit. No OS/process/UI calls or validator import."""
import argparse
import hashlib
import json
import math
import statistics
from pathlib import Path

PHASES = [('sphere-calm', 0, 'calm'), ('jellyfish-calm', 5, 'calm'),
          ('butterfly-calm', 7, 'calm'), ('saturn-calm', 12, 'calm'),
          ('saturn-paused', 12, 'paused'), ('saturn-hidden', 12, 'hidden')]
IDENTITY = ['start_abstime', 'coalition_resource_id', 'coalition_jetsam_id']
COUNTERS = ['user_ns', 'system_ns', 'lifetime_max_footprint_bytes']
BYTE_FIELDS = ['footprint_bytes', 'resident_bytes', 'lifetime_max_footprint_bytes']
COMPONENTS = {'atlasKinds': 22, 'atlasRows': 1, 'atlasRGBABytes': 524288,
              'instanceBytes': 122880, 'uniformBytes': 336}
DIAGNOSTICS = ['cameraDistance', 'framingMinimum', 'frustumFar', 'shaderCompileMS',
               'submitElapsedP95MS', 'submitElapsedMaximumMS']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def number(x):
    return isinstance(x, (float, int)) and not isinstance(x, bool) and math.isfinite(x)


def integer(x, minimum=0):
    return isinstance(x, int) and not isinstance(x, bool) and x >= minimum


def same(x, y):
    return type(x) is type(y) and x == y if isinstance(y, bool) else number(x) and x == y if number(y) else x == y


def stats(values):
    return {'first': values[0], 'median': statistics.median(values), 'peak': max(values), 'last': values[-1]}


def review(base, method_path, publication_path):
    method = json.loads(method_path.read_text())
    publication = json.loads(publication_path.read_text())
    build = json.loads((base/'BuildInfo.json').read_text())
    frozen = json.loads((base/'FREEZE.json').read_text())
    attribution = json.loads((base/'attribution.json').read_text())
    shut = json.loads((base/'shutdown.json').read_text())
    method_gate = method['unchangedRootGates']
    global_errors = []
    published_names = []
    for row in publication['files']:
        path = base/Path(row['path']).name
        published_names.append(path.name)
        if not path.exists() or path.stat().st_size != row['bytes'] or sha(path) != row['sha256']:
            global_errors.append('publication byte/hash differs: '+path.name)
    if len(published_names) != 27 or len(set(published_names)) != 27 or set(published_names) != {p.name for p in base.iterdir() if p.is_file()}:
        global_errors.append('publication exact27file set differs')
    if build != frozen['buildInfo']:
        global_errors.append('candidate copied BuildInfo differs from FREEZE')
    if build.get('comparison') != 'metal-lab-v3' or build.get('surface_count') != 13 or build.get('authored_word_surface_count') != 10:
        global_errors.append('candidate version/shape family differs')
    if build.get('source_sha256', {}).get('Sources/Renderer.swift') != method['frozenCandidate']['rendererSourceSHA256']:
        global_errors.append('renderer source differs from independent freeze')
    if build.get('source_sha256', {}).get('Sources/Glyphs.metal') != method['frozenCandidate']['shaderSHA256']:
        global_errors.append('shader source differs from independent freeze')
    if frozen.get('methodSHA256') != method['sourceReferences']['rootMethodSHA256'] or frozen.get('validatorSHA256') != method['sourceReferences']['validatorSHA256']:
        global_errors.append('root method/validator freeze differs')
    frozen_files = {r['path']: r for r in frozen['files']}
    if frozen_files['Contents/MacOS/GlyphMatterMetalLab']['sha256'] != method['frozenCandidate']['executableSHA256']:
        global_errors.append('executable identity differs')
    if sha(base/'BuildInfo.json') != method['frozenCandidate']['bundleBuildInfoSHA256']:
        global_errors.append('bundle BuildInfo hash differs')
    attributed = {p['pid']: p for p in attribution['processes']}
    if len(attributed) != 1 or len(attribution['processes']) != 1:
        global_errors.append('not attributed single native main process')
    entries = []
    previous_last = None
    for label, shape, phase in PHASES:
        raw_path, exp_path, summary_path = [base/(label+suffix) for suffix in ['.json', '-expectation.json', '-summary.json']]
        raw, expected, saved = [json.loads(p.read_text()) for p in [raw_path, exp_path, summary_path]]
        rows = raw['samples']; errors = []
        def error(ok, name):
            if not ok:
                errors.append(name)
        error(len(rows) >= 2, 'fewer than2 samples')
        expected_pid = expected['main_pid']
        ids = [p['pid'] for p in expected['processes']]
        error(len(ids) == 1 and integer(expected_pid, 1) and ids == [expected_pid], 'explicit main process list differs')
        error(expected_pid in attributed, 'main not root-attributed')
        identity = expected['processes'][0]
        for key in IDENTITY:
            error(integer(identity.get(key), 1) and identity.get(key) == attributed.get(expected_pid, {}).get(key), 'attribution '+key+' differs/unavailable')
        error(expected['source'].get('attribution_sha256') == sha(base/'attribution.json'), 'expectation attribution hash')
        error(expected['source'].get('freeze_sha256') == sha(base/'FREEZE.json'), 'expectation candidate freeze hash')
        error(expected['source'].get('method_sha256') == method['sourceReferences']['rootMethodSHA256'], 'expectation root method hash')
        error(saved.get('source_sha256') == sha(raw_path), 'summary raw hash')
        error(saved.get('expectation_sha256') == sha(exp_path), 'summary expectation hash')
        error(expected.get('renderer') == 'metal' and expected.get('app_version') == '0.3.0' and expected.get('phase') == phase, 'phase/version/renderer expectation')
        error(expected.get('body') == {'stored':1537, 'drawn':1536, 'shape':shape}, 'body expectation differs')
        error(expected.get('viewport') == {'width':400, 'height':440}, 'viewport expectation differs')
        for name in ['ui_confirmed', 'heavy_work_absent', 'settled_body_confirmed']:
            error(expected.get('conditions', {}).get(name) is True, 'root condition absent: '+name)
        error(expected.get('expected_native_bytes') == {'instanceBytes':122880, 'uniformBytes':336}, 'frozen declared byte expectations differ')
        stamps, frames, draws, scene_times, charged, rss, processes = [], [], [], [], [], [], []
        natives = []
        for i, row in enumerate(rows):
            observed = row.get('processes', [])
            error(len(observed) == 1 and [p.get('pid') for p in observed] == [expected_pid], f'row{i} main PID set')
            p = observed[0]
            error('error' not in p and not row.get('native_metrics_read_error'), f'row{i} missing process/packet')
            for key in IDENTITY:
                error(p.get(key) == identity.get(key), f'row{i} identity {key}')
            for key in COUNTERS+BYTE_FIELDS:
                error(integer(p.get(key)), f'row{i} typed nonnegative {key}')
            error(integer(row.get('monotonic_ns'), 1), f'row{i} monotonic typed/positive')
            error(row.get('mach_timebase') == attribution.get('mach_timebase'), f'row{i} Machtimebase differs')
            stamps.append(row['monotonic_ns']); charged.append(p['footprint_bytes']); rss.append(p['resident_bytes']); processes.append(p)
            native = row['native']; natives.append(native)
            fields = {'renderer':'metal-lab-v3', 'schema':1, 'pid':expected_pid, 'storedGlyphs':1537, 'drawnGlyphs':1536,
                      'shape':shape, 'width':400, 'height':440, 'paused':phase=='paused', 'hidden':phase=='hidden',
                      'scheduled':phase=='calm', 'preferredFPS':15, 'manualZoom':1, 'metalErrorCount':0, **COMPONENTS}
            for key, value in fields.items():
                error(same(native.get(key), value), f'row{i} native {key}')
            for key in DIAGNOSTICS+['time']:
                error(number(native.get(key)) and native[key] >= 0, f'row{i} finite diagnostic {key}')
            error(integer(native.get('frames')) and integer(native.get('drawCalls')), f'row{i} frame/draw counter typed')
            frames.append(native['frames']); draws.append(native['drawCalls']); scene_times.append(native['time'])
            error(native['cameraDistance']+0.000001 >= native['framingMinimum'], f'row{i} framing minimum')
            error(native['frustumFar'] > native['cameraDistance'], f'row{i} positive far margin')
        seconds = (stamps[-1]-stamps[0])/1e9
        intervals = [(b-a)/1e9 for a,b in zip(stamps, stamps[1:])]
        error(all(0<t<=method_gate['maximumAdjacentIntervalSeconds'] for t in intervals), 'monotonic sample intervals')
        error(same(raw.get('sampling_interval_seconds'), 0.5), 'declared0.5s cadence')
        target = 90 if phase=='calm' else 30
        error(abs(seconds-target) <= method_gate['durationToleranceSeconds'], 'fixed90/30s duration')
        error(seconds>0 and same(raw.get('elapsed_seconds'), seconds), 'sampler elapsed differs')
        for key in COUNTERS:
            error(all(a[key]<=b[key] for a,b in zip(processes, processes[1:])), key+' decreased')
        cpu_delta = (processes[-1]['user_ns']-processes[0]['user_ns'])+(processes[-1]['system_ns']-processes[0]['system_ns'])
        cpu = cpu_delta/(stamps[-1]-stamps[0])*100
        frame_delta, draw_delta = frames[-1]-frames[0], draws[-1]-draws[0]
        rate = frame_delta/seconds
        error(all(a<=b for a,b in zip(frames,frames[1:])) and all(a<=b for a,b in zip(draws,draws[1:])), 'submission counter decreased')
        error(frames==draws and frame_delta==draw_delta, 'one instanced draw per submitted frame differs')
        low, high = method_gate['calmCounterPerWallSecond']
        cadence = low<=rate<=high if phase=='calm' else frame_delta==0
        error(cadence, 'original frame-counter cadence/stopped gate')
        cp, rp = stats(charged), stats(rss)
        error(abs(cpu-raw['cpu_single_core_percent']) < 0.000001, 'sampler aggregate CPU differs')
        error(abs(cpu-saved['cpu_single_core_percent']) < 0.000001, 'saved summary CPU differs')
        error(same(saved.get('elapsed_seconds'),seconds), 'summary elapsed differs')
        error(saved.get('charged_footprint_bytes')==cp and saved.get('RSS_bytes')==rp, 'summary coincident memory stats differ')
        for key, value in [('peak_sum_charged_footprint_bytes',cp['peak']),('first_sum_charged_footprint_bytes',cp['first']),('last_sum_charged_footprint_bytes',cp['last'])]:
            error(same(raw.get(key),value), 'sampler '+key+' differs')
        error(saved.get('frames_delta')==frame_delta and abs(saved.get('frames_per_wall_second',math.nan)-rate)<1e-9, 'summary submission delta/rate differs')
        error(saved.get('explicit_pid_group')==[expected_pid], 'summary explicit PID group differs')
        lifetimes = [p['lifetime_max_footprint_bytes'] for p in processes]
        proc = raw['per_process'][0]
        for key,value in [('pid',expected_pid),('peak_footprint_bytes',cp['peak']),('first_footprint_bytes',cp['first']),('last_footprint_bytes',cp['last']),('lifetime_max_footprint_bytes',max(lifetimes)),('missing_samples',0)]:
            error(same(proc.get(key),value), 'sampler per_pid '+key+' differs')
        error(abs(proc.get('cpu_single_core_percent',math.nan)-cpu)<1e-6, 'sampler per_PID CPU differs')
        error(raw.get('sum_per_process_lifetime_max_footprint_bytes')==max(lifetimes), 'lifetime envelope differs')
        latest = next(i for i in range(len(rows)) if all(n==natives[-1] for n in natives[i:]))
        unique = [i for i,n in enumerate(natives) if i==0 or n!=natives[i-1]]
        scene_delta = scene_times[-1]-scene_times[0]
        budget = cpu<=method_gate['calmOneCoreCPUPercentMax'] and cp['peak']<=method_gate['calmChargedFootprintBytesMax']
        error(saved.get('candidate_budget',{}).get('within_values') is budget, 'saved candidate budget numeric differs')
        entry = {'name':label,'shape':shape,'phase':phase,'samples':len(rows),'elapsed_seconds':seconds,
                 'identity_and_arithmetic_errors':sorted(set(errors)), 'saved_gate_passed':saved['validation_passed'],
                 'saved_gate_errors':saved['validation_errors'], 'existing_gate_untouched':True,
                 'explicit_main_pid':expected_pid,'start_abstime':identity['start_abstime'],
                 'coalition_resource_id':identity['coalition_resource_id'],'coalition_jetsam_id':identity['coalition_jetsam_id'],
                 'cpu_counter_delta_ns':cpu_delta,'cpu_single_core_percent':cpu,
                 'charged_footprint_bytes':cp,'RSS_bytes':rp,'lifetime_max_footprint_bytes':max(lifetimes),
                 'frames_delta':frame_delta,'drawCalls_delta':draw_delta,'counter_per_wall_second':rate,
                 'calm_candidate_budget_observed':budget if phase=='calm' else None,
                 'first_native':natives[0],'last_native':natives[-1],
                 'diagnostics':{key:stats([n[key] for n in natives]) for key in DIAGNOSTICS},
                 'posthoc_freshness_not_gate_replacement':{'unique_packets':len(unique),'terminal_same_packet_first_index':latest,
                  'terminal_same_packet_samples':len(rows)-latest,'terminal_same_packet_wall_seconds':(stamps[-1]-stamps[latest])/1e9,
                  'scene_time_delta_seconds':scene_delta,'wall_minus_scene_delta_seconds':seconds-scene_delta,
                  'counter_per_scene_time_second':frame_delta/scene_delta if scene_delta else None,
                  'packet_scene_delta_min':min((scene_times[b]-scene_times[a] for a,b in zip(unique,unique[1:])),default=None),
                  'packet_scene_delta_max':max((scene_times[b]-scene_times[a] for a,b in zip(unique,unique[1:])),default=None)},
                 'gap_from_previous_sample_window_seconds':(stamps[0]-previous_last)/1e9 if previous_last is not None else None,
                 'root_conditions_not_independently_observed':expected['conditions']}
        previous_last=stamps[-1];entries.append(entry)
    error_count=len(global_errors)+sum(len(e['identity_and_arithmetic_errors']) for e in entries)
    return {'scope':'Saved-file independent source/identity/arithmetic audit, not new measurement',
            'all_original_gate_results_preserved':True,'no_threshold_redefinition':True,
            'publication_files_verified':len(published_names),'global_errors':global_errors,'disagreements':error_count,
            'phases':entries,'root_shutdown_record':shut,'candidateBuildInfo':build,
            'rootConcurrentOffscreenSoakCondition':frozen.get('concurrentOffscreenSoak'),
            'limitations':['Root UI, warmup, quiet and process-image launch proof supplied, not newly observed',
                           'Cold compile, other9 shapes, input bursts, body extremes, power/Windows/16GB/presentationFPS and8h native continuity unmeasured',
                           'Prior v2 has different source/session/time/fixture; not isolated causal comparison',
                           'Target PID charged footprint/RSS is not system unique memory; component bytes are not wholeapp RAM',
                           'Reported MTL errors0 does not independently observe every GPU completion; submit diagnostics are CPU wall and cross-phase history']}


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,required=True);parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--method',type=Path,default=Path('experiments/widget-metal-native-evaluation-v3/review-real-r1/METHOD-INDEPENDENT-R1.json'))
    parser.add_argument('--publication',type=Path,default=Path('experiments/widget-metal-native-evaluation-v3/ROOT-PUBLICATION.json'))
    args=parser.parse_args()
    result=review(args.input,args.method,args.publication)
    with args.output.open('x') as f:json.dump(result,f,indent=2,allow_nan=False);f.write('\n')
    print(json.dumps({'phases':len(result['phases']),'disagreements':result['disagreements'],'saved_FAILs':[p['name'] for p in result['phases'] if not p['saved_gate_passed']],
                      'observations':[{'phase':p['name'],'cpu':p['cpu_single_core_percent'],'chargedPeakMiB':p['charged_footprint_bytes']['peak']/1048576,'RSSPeakMiB':p['RSS_bytes']['peak']/1048576,'counterDelta':p['frames_delta'],'counterPerWallSecond':p['counter_per_wall_second']} for p in result['phases']]}))
