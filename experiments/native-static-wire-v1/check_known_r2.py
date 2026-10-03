#!/usr/bin/env python3
# coding: utf-8
import datetime
import hashlib
import json
import math
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
cases = json.loads((HERE / 'KNOWN-CASES-R1.json').read_text())

def run(binary, rows):
    data = b''.join(json.dumps(x, ensure_ascii=False).encode() + b'\n' for x in rows)
    out = subprocess.run([str(binary)], cwd=ROOT, input=data, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, timeout=20)
    return {'exit': out.returncode, 'stderr': out.stderr.decode(),
            'stdout': out.stdout.decode(), 'replies': [json.loads(s) for s in out.stdout.splitlines()]}

a = run(ROOT / 'experiments/native-static-japanese-v1/native-static-r5',
        [{'text': x['text'], 'registry': x['registry']} for x in cases])
b = run(HERE / 'work/NativeStaticWireR2', cases)
raw = {'UTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
       'fixedArtificialKnownCases': 5, 'oldCalls': 5, 'newCalls': 5,
       'old': a, 'new': b, 'independentOrSemanticEvaluation': False,
       'candidateSHA256': hashlib.sha256((HERE / 'CANDIDATE-R2.json').read_bytes()).hexdigest()}
(HERE / 'KNOWN-RAW-HELPER-R2.json').write_text(json.dumps(raw, ensure_ascii=False, indent=2) + '\n')
assert len(a['replies']) == len(b['replies']) == len(cases)
checks = []
for x, y, z in zip(cases, a['replies'], b['replies']):
    expected = [{'label': r['label'], 'score': r['score']} for r in y['ranks'][:3]]
    checks.append({'requestId': x['requestId'], 'top3Exact': expected == z['ranks'],
                   'holdExact': y['encoding'].get('hold') == z['hold'],
                   'fiveKeys': set(z) == {'requestId', 'registry', 'ranks', 'hold', 'elapsedMs'},
                   'finiteElapsed': math.isfinite(z['elapsedMs']) and z['elapsedMs'] >= 0,
                   'replyBytes': len(json.dumps(z, separators=(',', ':')).encode()),
                   'oldTokenCount': len(y['encoding']['tokens'].get('ids') or [])})
summary = {'checks': checks, 'oldExit': a['exit'], 'newExit': b['exit'],
           'pass': a['exit'] == b['exit'] == 0 and all(all(c[k] for k in
                  ('top3Exact', 'holdExact', 'fiveKeys', 'finiteElapsed')) for c in checks)}
(HERE / 'KNOWN-SUMMARY-HELPER-R2.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary))
assert summary['pass']
