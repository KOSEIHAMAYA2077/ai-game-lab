"""Independent saved-file arithmetic review. No process, UI or OS sampling."""
import argparse
import hashlib
import json
import statistics
from datetime import datetime, timezone
from pathlib import Path

TRIALS = ['wk-r1-calm', 'wk-r1-paused', 'wk-r1-hidden', 'metal-r1-calm',
          'metal-r1-paused', 'metal-r1-hidden', 'wk-repeat-r1-calm']


def stats(values):
    return dict(first=values[0], median=statistics.median(values), peak=max(values), last=values[-1])


def review(base):
    phases = []
    for name in TRIALS:
        trial = name.rsplit('-', 1)[0]
        raw = json.loads((base/(name+'.json')).read_text())
        summary = json.loads((base/(name+'-summary.json')).read_text())
        expected = json.loads((base/(trial+'-expectation.json')).read_text())
        attribution = json.loads((base/(trial+'-attribution.json')).read_text())
        rows = raw['samples']; first, last = rows[0], rows[-1]
        seconds = (last['monotonic_ns']-first['monotonic_ns'])/1e9
        pid_ids = {p['pid']: p for p in expected['processes']}
        errors, cpu_by_pid = [], []
        for i, row in enumerate(rows):
            pids = [p['pid'] for p in row['processes']]
            if len(pids) != len(set(pids)) or set(pids) != set(pid_ids):
                errors.append(f'row {i}: PID group changed')
            for p in row['processes']:
                if 'error' in p:
                    errors.append(f'row {i}: missing PID {p["pid"]}')
                for key in ['start_abstime', 'coalition_resource_id', 'coalition_jetsam_id']:
                    if p.get(key) != pid_ids[p['pid']][key]:
                        errors.append(f'row {i}: identity mismatch {key}')
        for pid in pid_ids:
            series = [next(p for p in r['processes'] if p['pid']==pid) for r in rows]
            counters = [p['user_ns']+p['system_ns'] for p in series]
            if any(a>b for a,b in zip(counters,counters[1:])):
                errors.append(f'PID {pid}: CPU counter decreased')
            cpu_by_pid.append({'pid': pid, 'single_core_percent': (counters[-1]-counters[0])/1e9/seconds*100})
        cpu = sum(p['single_core_percent'] for p in cpu_by_pid)
        charged = stats([sum(p['footprint_bytes'] for p in r['processes']) for r in rows])
        resident = stats([sum(p['resident_bytes'] for p in r['processes']) for r in rows])
        for key, calculated in [('cpu_single_core_percent',cpu),('elapsed_seconds',seconds)]:
            if abs(summary[key]-calculated)>1e-9 or abs(raw[key]-calculated)>1e-9:
                errors.append('calculation mismatch '+key)
        if summary['charged_footprint_bytes'] != charged or summary['RSS_bytes'] != resident:
            errors.append('coincident memory summary mismatch')
        if hashlib.sha256((base/(name+'.json')).read_bytes()).hexdigest()!=summary['source_sha256']:
            errors.append('summary raw SHA differs')
        if hashlib.sha256((base/(trial+'-expectation.json')).read_bytes()).hexdigest()!=summary['expectation_sha256']:
            errors.append('summary expectation SHA differs')
        if hashlib.sha256((base/(trial+'-attribution.json')).read_bytes()).hexdigest()!=expected['source']['attribution_sha256']:
            errors.append('expectation attribution SHA differs')
        native = [r['native'] for r in rows]; web = 'web' in native[0]
        metrics = [p.get('web',p) for p in native]
        frames = [m['frames'] for m in metrics]
        frame_delta = frames[-1]-frames[0]
        tail = next(i for i in range(len(rows)) if all(p==native[-1] for p in native[i:]))
        tail_seconds = (last['monotonic_ns']-rows[tail]['monotonic_ns'])/1e9
        unique = [i for i in range(len(rows)) if i==0 or native[i]!=native[i-1]]
        entry = {'name': name, 'saved_gate_validation_passed': summary['validation_passed'],
                 'saved_gate_validation_errors': summary['validation_errors'],
                 'arithmetic_and_identity_errors': sorted(set(errors)), 'elapsed_seconds': seconds,
                 'samples':len(rows),'per_pid_cpu':cpu_by_pid,'cpu_single_core_percent':cpu,
                 'charged_footprint_bytes':charged,'RSS_bytes':resident,
                 'frames_delta':frame_delta,'frames_per_wall_second':frame_delta/seconds,
                 'native_unique_packets':len(unique),'last_packet_first_sample_index':tail,
                 'tail_identical_packet_samples':len(rows)-tail,'tail_identical_packet_wall_seconds':tail_seconds,
                 'first_metrics':metrics[0],'last_metrics':metrics[-1],
                 'comparison_observations_in_expectation':expected['comparison_observations'],
                 'before_snapshot_missing_in_attribution':attribution.get('before_snapshot_missing',False),
                 'missing_shutdown_publication':not (base/(trial+'-shutdown.json')).exists()}
        if web:
            uptime_delta=metrics[-1]['uptimeSeconds']-metrics[0]['uptimeSeconds']
            d0=datetime.fromisoformat(native[0]['recordedAt'].replace('Z','+00:00'))
            d1=datetime.fromisoformat(native[-1]['recordedAt'].replace('Z','+00:00'))
            packet_delta=[metrics[b]['uptimeSeconds']-metrics[a]['uptimeSeconds'] for a,b in zip(unique,unique[1:])]
            entry['posthoc_telemetry_diagnostic']={'is_gate_replacement':False,
                'web_uptime_delta_seconds':uptime_delta,'wall_minus_web_uptime_delta_seconds':seconds-uptime_delta,
                'frames_per_web_uptime_delta':frame_delta/uptime_delta if uptime_delta else None,
                'recordedAt_delta_seconds':(d1-d0).total_seconds(),
                'packet_uptime_delta_min':min(packet_delta) if packet_delta else None,
                'packet_uptime_delta_max':max(packet_delta) if packet_delta else None,
                'last_recordedAt':native[-1]['recordedAt']}
        phases.append(entry)
    shutdowns={name:json.loads((base/(name+'-shutdown.json')).read_text()) for name in ['wk-r1','metal-r1','wk-repeat-r1']}
    return {'scope':'independent-read-only-native-audit-posthoc-not-new-measurement',
            'all_existing_gate_results_preserved':True,'no_gate_threshold_changed':True,
            'identity_and_arithmetic_disagreements':sum(len(p['arithmetic_and_identity_errors']) for p in phases),
            'phases':phases,'root_reported_shutdown_records':shutdowns,
            'limitations':['Root attribution/UI/quiet/warmup evidence is not independently observed by this saved-file reviewer',
                           'No exact-body or pixel equivalence, causal backend isolation, 60-shape total performance, GPU/power or 16GB laptop claim',
                           'Posthoc telemetry clock diagnostic does not turn a saved FAIL into PASS']}


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,required=True);parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    result=review(args.input)
    with args.output.open('x') as f:json.dump(result,f,indent=2,allow_nan=False);f.write('\n')
    print(json.dumps({'phases':len(result['phases']),'identity_and_arithmetic_disagreements':result['identity_and_arithmetic_disagreements'],'saved_FAILs':[p['name'] for p in result['phases'] if not p['saved_gate_validation_passed']]}))
