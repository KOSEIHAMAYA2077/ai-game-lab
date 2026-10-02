#!/usr/bin/env python3
import hashlib, json, pathlib
root=pathlib.Path(__file__).resolve().parents[1]
# File keys are relative to the repository, not a machine-specific directory.
repo=root.parent
manifest=json.loads((pathlib.Path(__file__).resolve().parent/'FREEZE.json').read_text())
fail=[]
for name,expected in manifest['files'].items():
    path=repo/name
    actual=hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
    if actual!=expected: fail.append(name)
if fail: raise SystemExit('Freeze mismatch: '+', '.join(fail))
print('Verified frozen data, model, thresholds, runtime and validator.')
