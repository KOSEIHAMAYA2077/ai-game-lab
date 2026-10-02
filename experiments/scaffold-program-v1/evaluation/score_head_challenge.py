"""First independent meaning comparison using identical recorded WASM vectors."""
import hashlib,json
from pathlib import Path
from score import score,summarize
D=Path(__file__).resolve().parent;M=D.parent/'model';fixture=D/'head-challenge-fixture.json';cases=json.loads(fixture.read_text())['cases'];digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert digest(fixture)==fixture.with_suffix('.sha256').read_text().split()[0]
assert digest(M/'wasm-head-v1/relation-head.json')=='af2289c3bccb20d0186fa2770460ba50b2d08413209ab5f866c0ae2aeff1203d'
assert digest(M/'relation-head.json')=='2b5e212a7b8fec5cbf9683620ba7883c77e74140ccb65a1e91bc5ca1f5618a87'
groups=[]
for name in ['new','old']:
 data=json.loads((D/f'head-challenge-{name}-head-output.json').read_text());rows=[]
 assert len(cases)==len(data['rows'])
 for case,output in zip(cases,data['rows']):
  assert case['text']==output['text']
  rows.append({'id':case['id'],'group':case['group'],'wallMs':None,'error':None,'output':output,**score(case,output)})
 groups.append({'head':name,'summary':summarize(rows),'rows':rows})
texts={c['text'].strip().casefold() for c in cases};overlap={f:len(texts&{json.loads(line)['text'].strip().casefold() for line in (M/f).read_text().splitlines() if line}) for f in ['training.jsonl','validation.jsonl']}
report={'evaluationUse':'First independent challenge frozen before WASM-specific head training completion. Old and new heads receive exactly the same recorded WASM batch-1 query vectors and batch-8 references.','fixtureSha256':digest(fixture),'newHeadSha256':digest(M/'wasm-head-v1/relation-head.json'),'oldHeadSha256':digest(M/'relation-head.json'),'controllerHashes':{name:digest(M/name) for name in ['config.py','predict.py']},'embeddingsSha256':digest(D/'head-challenge-embeddings.json'),'exactTextOverlap':overlap,'timingScope':'No performance claim: Python controller with prerecorded browser-WASM vectors, not live inference or app end-to-end.','groups':groups,'limitations':['Finite parts/relations only. No new app model or geometry is deployed by this test.','Per-case modelMs is lookup controller time and must not be cited as generation latency.','This fixture is now observed by development agents; any re-use after changes is regression.','Zero raw string overlap does not establish unseen relation templates.']}
p=D/'head-challenge-first.json'
if p.exists():raise SystemExit('Refusing overwrite')
p.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
for group in groups:print(group['head'],json.dumps(group['summary'],ensure_ascii=False,indent=2))
for i,case in enumerate(cases):print(case['id'],[(g['head'],g['rows'][i]['meaningPass'],g['rows'][i]['output']['reason'],[e for e in g['rows'][i]['output'].get('evidence',[]) if e['kind']=='learned-relation-head'])for g in groups])
