"""Convert root-supplied attribution/method into a numeric sidecar; no OS calls."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--attribution', type=Path, required=True)
parser.add_argument('--method', type=Path, required=True)
parser.add_argument('--renderer', choices=['metal', 'wk'], required=True)
parser.add_argument('--main-pid', type=int, required=True)
parser.add_argument('--root-confirmed', action='store_true', help='Root independently confirmed UI, quiet interval and settled body')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
if args.output.exists():
    parser.error('Output exists; preserve it')
attribution_bytes, method_bytes = args.attribution.read_bytes(), args.method.read_bytes()
attribution, method = json.loads(attribution_bytes), json.loads(method_bytes)
values = attribution.get('usage', attribution).get('processes', [])
roles = {p['pid']: p.get('role') for p in attribution.get('new', [])}
fields = ('pid', 'start_abstime', 'coalition_resource_id', 'coalition_jetsam_id')
processes = [{**{key: p.get(key) for key in fields}, 'role': roles.get(p['pid'], 'root-attributed')} for p in values]
if args.main_pid not in [p['pid'] for p in processes]:
    parser.error('Main PID missing from explicit attribution')
result = {'schema': 1, 'renderer': args.renderer, 'main_pid': args.main_pid, 'processes': processes,
          'app_version': '0.14.2' if args.renderer == 'wk' else None,
          'body': {'stored': method['sphere_stored'], 'drawn': method['drawn'], 'shape': 0, 'label': 'white sphere'},
          'viewport': dict(width=method['viewport_requested'][0], height=method['viewport_requested'][1],
                           proof='requested; actual Metal telemetry checked, WK requires root inspection'),
          'conditions': dict(ui_confirmed=args.root_confirmed, heavy_work_absent=args.root_confirmed,
                             settled_body_confirmed=args.root_confirmed, proof='root supplied; not independently verified by this helper'),
          'expected_native_bytes': dict(instanceBytes=method['drawn']*80, uniformBytes=176) if args.renderer == 'metal' else {},
          'fixture_differences': {'perfect_body_or_pixel_equivalence': False, 'declared': method['visual_differences'],
                                  'history': method['history'], 'Metal_kinds': 22, 'WK_kinds': 24},
          'comparison_observations': {'camera_font_and_WK_bytes': 'Add root scene snapshot observations separately; not exposed by native WK telemetry'},
          'source': {'attribution': args.attribution.name, 'attribution_sha256': hashlib.sha256(attribution_bytes).hexdigest(),
                     'method': args.method.name, 'method_sha256': hashlib.sha256(method_bytes).hexdigest()}}
with args.output.open('x') as f:
    json.dump(result, f, indent=2, ensure_ascii=False, allow_nan=False);f.write('\n')
print(json.dumps({'renderer': args.renderer, 'explicit_pid_count': len(processes), 'root_conditions_confirmed': args.root_confirmed}))
