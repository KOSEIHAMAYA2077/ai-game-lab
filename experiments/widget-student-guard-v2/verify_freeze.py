#!/usr/bin/env python3
import hashlib,json,pathlib,subprocess,sys
folder=pathlib.Path(__file__).resolve().parent
repo=folder.parents[1]
subprocess.run([sys.executable,str(repo/'experiments/widget-student-v1/verify_freeze.py')],check=True)
manifest=json.loads((folder/'FREEZE.json').read_text())
fail=[]
for path,expected in manifest['files'].items():
 p=repo/path
 actual=hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
 if actual!=expected: fail.append(path)
if fail: raise SystemExit('Guard freeze mismatch: '+', '.join(fail))
print('Verified guard-v2 and unchanged student freeze-1.')
