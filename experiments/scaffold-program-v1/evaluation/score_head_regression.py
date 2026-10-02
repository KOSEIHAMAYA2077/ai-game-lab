"""Previously observed examples; regression comparison, never new accuracy."""
import hashlib,json
from pathlib import Path
from score import score,summarize
D=Path(__file__).resolve().parent;M=D.parent/'model';names=['fixture.json','same-type-fixture.json','followup-fixture.json'];groups=[]
for head in ['new','old']:
 outputs=iter(json.loads((D/f'head-regression-{head}-head-output.json').read_text())['rows']);sets=[]
 for name in names:
  rows=[]
  for case in json.loads((D/name).read_text())['cases']:
   output=next(outputs);assert case['text']==output['text'];rows.append({'id':case['id'],'group':case['group'],'wallMs':None,'error':None,'output':output,**score(case,output)})
  sets.append({'fixture':name,'summary':summarize(rows),'rows':rows})
 groups.append({'head':head,'fixtures':sets})
changes=[]
for n,o in zip([r for f in groups[0]['fixtures'] for r in f['rows']],[r for f in groups[1]['fixtures'] for r in f['rows']]):
 if n['meaningPass']!=o['meaningPass']:changes.append({'id':n['id'],'newMeaningPass':n['meaningPass'],'oldMeaningPass':o['meaningPass'],'newReason':n['output']['reason'],'oldReason':o['output']['reason']})
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
report={'evaluationUse':'Regression on the 44 previously observed cases. Equal recorded WASM batch-1 query vectors; fixed batch-8 reference vectors.','newHeadSha256':sha(M/'wasm-head-v1/relation-head.json'),'oldHeadSha256':sha(M/'relation-head.json'),'embeddingsSha256':sha(D/'head-regression-embeddings.json'),'timingScope':'No performance claim: prerecorded browser vectors with Python controller. Geometry rejection excluded.','groups':groups,'meaningChanges':changes}
p=D/'head-regression-first.json'
if p.exists():raise SystemExit('Refusing overwrite')
p.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
for head in groups:
 print(head['head'],[(f['fixture'],f['summary']['meaningPass'],f['summary']['cases']) for f in head['fixtures']])
print('CHANGES',json.dumps(changes,ensure_ascii=False))
