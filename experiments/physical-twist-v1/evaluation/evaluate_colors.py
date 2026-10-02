"""Independent metamorphic checks: ink words must not change structure."""
from pathlib import Path
import hashlib,importlib,json,sys,time
D=Path(__file__).resolve().parent;ROOT=D.parents[2];M=ROOT/'experiments/scaffold-program-v1/model'
p=D/'color-metamorphic.json';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();assert sha(p)==p.with_suffix('.sha256').read_text().split()[0]
hashes={name:sha(M/name) for name in ['config.py','predict.py','relation-head.json']};assert hashes['relation-head.json']=='2b5e212a7b8fec5cbf9683620ba7883c77e74140ccb65a1e91bc5ca1f5618a87'
sys.path.insert(0,str(M));module=importlib.import_module('predict');model=module.ProgramModel(Path(sys.argv[1]));rows=[]
for case in json.loads(p.read_text())['cases']:
 began=time.perf_counter();output=model.interpret(case['text']);rows.append({'id':case['id'],'group':case['group'],'baseId':case['baseId'],'ink':case['ink'],'wallMs':(time.perf_counter()-began)*1000,'output':output})
bases={r['id']:r for r in rows}
for row in rows:
 base=bases[row['baseId']]['output'];row['sameProgramAsBase']=row['output']['program']==base['program'];row['sameReasonAsBase']=row['output']['reason']==base['reason'];row['sameSourceAsBase']=row['output']['source']==base['source']
result={'evaluationUse':'Metamorphic color invariance, not unknown-language accuracy. Finite program outputs, no geometry/render time.','modelHashes':hashes,'modelUnchangedDuringRun':hashes=={name:sha(M/name) for name in hashes},'summary':{'cases':len(rows),'sameProgramAsBase':sum(r['sameProgramAsBase'] for r in rows),'sameReasonAsBase':sum(r['sameReasonAsBase'] for r in rows),'sameSourceAsBase':sum(r['sameSourceAsBase'] for r in rows)},'rows':rows}
out=D/'color-cpu-first.json'
if out.exists():raise SystemExit('Refusing overwrite')
out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result['summary']))
