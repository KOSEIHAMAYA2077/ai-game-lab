"""Root-confirmed sidecar from frozen explicit attribution, without OS discovery."""
import argparse,json,hashlib
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--raw',type=Path,required=True);p.add_argument('--shape',type=int,choices=range(13),required=True);p.add_argument('--phase',choices=['calm','paused','hidden'],required=True);p.add_argument('--output',type=Path,required=True)
a=p.parse_args();b=(a.raw/'attribution.json').read_bytes();att=json.loads(b);method=Path(__file__).with_name('METHOD-R1.json').read_bytes();freeze=(a.raw/'FREEZE.json').read_bytes()
keys=('pid','start_abstime','coalition_resource_id','coalition_jetsam_id');procs=[{**{k:x[k] for k in keys},'role':'root-attributed-single-native-process'} for x in att['processes']]
assert len(procs)==1
m=json.loads((a.raw/'metrics.json').read_bytes())
assert (m['pid'],m['shape'],m['storedGlyphs'],m['drawnGlyphs'],m['uniformBytes'],m['width'],m['height'])==(procs[0]['pid'],a.shape,1537,1536,336,400,440)
assert m['paused']==(a.phase=='paused') and m['hidden']==(a.phase=='hidden')
r=dict(schema=1,renderer='metal',main_pid=procs[0]['pid'],processes=procs,app_version='0.3.0',body=dict(stored=1537,drawn=1536,shape=a.shape),viewport=dict(width=400,height=440),conditions=dict(ui_confirmed=True,heavy_work_absent=True,settled_body_confirmed=True,proof='Root actual UI; quiet own/agent heavy tasks; concurrent R5 offscreen condition recorded in FREEZE'),expected_native_bytes=dict(instanceBytes=122880,uniformBytes=336),fixture_differences=dict(no_inference=True,no_history=True,concurrent_R5=True),source=dict(attribution_sha256=hashlib.sha256(b).hexdigest(),method_sha256=hashlib.sha256(method).hexdigest(),freeze_sha256=hashlib.sha256(freeze).hexdigest()),phase=a.phase)
with a.output.open('x') as f:json.dump(r,f,indent=2,allow_nan=False);f.write('\n')
print(json.dumps(dict(shape=a.shape,phase=a.phase,pid=procs[0]['pid'])))
