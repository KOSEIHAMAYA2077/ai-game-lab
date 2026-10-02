"""Frozen numerical/ID gates, no semantic quality scoring or threshold search."""
import json,math,sys,hashlib
from pathlib import Path
H=Path(__file__).resolve().parent
expected=json.loads((H/'EXPECTED-R1.json').read_text());native=json.loads(Path(sys.argv[1]).read_text());out=Path(sys.argv[2])
by_id={r['id']:r for r in native['cases']};failures=[];groups={};maxima={'meanAbs':0,'unitAbs':0,'cosineAbs':0};rankDiagnostics={'top1Different':0,'completeOrderDifferent':0,'captionChoiceDifferent':0,'nearTiePairReversed':0,'separatedPairReversed':0}
def fail(case,kind,detail=None):failures.append({'id':case['id'],'group':case['group'],'kind':kind,'detail':detail})
for row in expected['cases']:
 e=row['expected'];n=by_id[row['id']];enc=n['encoding'];t=enc['tokens'];g=groups.setdefault(row['group'],{'cases':0,'idExact':0,'pieceExact':0,'normalizationExact':0,'pretokenExact':0,'holdExact':0,'shapeTop1Exact':0,'primitiveTop1Exact':0});g['cases']+=1
 for key,dest in [('ids','idExact'),('pieces','pieceExact')]:
  equal=t.get(key)==e[key];g[dest]+=equal
  if not equal:fail(row,key,{'expectedCount':len(e[key] or []),'actualCount':len(t.get(key) or [])})
 for key,dest in [('normalization','normalizationExact'),('pretokenizedWholeNormalization','pretokenExact')]:
  equal=t.get(key)==e.get(key);g[dest]+=equal
  if not equal:fail(row,key)
 equal=enc.get('hold')==e['hold'];g['holdExact']+=equal
 if not equal:fail(row,'hold',{'expected':e['hold'],'actual':enc.get('hold')})
 for key,stat in [('mean','meanAbs'),('vector','unitAbs')]:
  a,b=e[key],enc.get(key)
  if (a is None)!=(b is None):fail(row,key+' existence');continue
  if a is not None:
   if len(a)!=len(b) or not all(math.isfinite(x) for x in b):fail(row,key+' finite/shape');continue
   error=max(abs(x-y) for x,y in zip(a,b));maxima[stat]=max(maxima[stat],error)
   if error>1e-5:fail(row,key+' numeric',error)
 for registry in ['shape','primitive']:
  a,b=e['ranks'][registry],n['ranks'][registry];at=a[0]['label'] if a else None;bt=b[0]['label'] if b else None;g[registry+'Top1Exact']+=at==bt
  if at!=bt:fail(row,registry+' top1',{'expected':at,'actual':bt});rankDiagnostics['top1Different']+=1
  aa={r['label']:r for r in a};bb={r['label']:r for r in b};orderA=[r['label'] for r in a];orderB=[r['label'] for r in b]
  if orderA!=orderB:rankDiagnostics['completeOrderDifferent']+=1
  if aa.keys()!=bb.keys():fail(row,registry+' labelset');continue
  for label in aa:
   error=abs(aa[label]['score']-bb[label]['score']);maxima['cosineAbs']=max(maxima['cosineAbs'],error)
   if not math.isfinite(bb[label]['score']) or error>1e-5:fail(row,registry+' cosine',{'label':label,'error':error})
   if aa[label]['captionIndex']!=bb[label]['captionIndex']:rankDiagnostics['captionChoiceDifferent']+=1
  bpos={label:i for i,label in enumerate(orderB)}
  for i,left in enumerate(orderA):
   for right in orderA[i+1:]:
    if bpos[left]>bpos[right]:
     if aa[left]['score']-aa[right]['score']>2e-5:rankDiagnostics['separatedPairReversed']+=1;fail(row,registry+' separated order',{'left':left,'right':right})
     else:rankDiagnostics['nearTiePairReversed']+=1
result={'schema':1,'expectedSHA256':hashlib.sha256((H/'EXPECTED-R1.json').read_bytes()).hexdigest(),'nativeFile':Path(sys.argv[1]).name,'nativeSHA256':hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest(),'cases':len(expected['cases']),'old455':sum(g['cases'] for k,g in groups.items() if k.startswith('old-')),'extra':sum(g['cases'] for k,g in groups.items() if not k.startswith('old-')),'gatesUnchanged':True,'gatePassed':not failures,'failures':failures,'groups':groups,'maxima':maxima,'rankDiagnostics':rankDiagnostics,'limitations':'Original calibration/captions and synthetic edge runtime parity, not new semantic quality or unseen evaluation. nearTie pair reversals separately disclosed.'}
with out.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({k:result[k] for k in ['cases','old455','extra','gatePassed','maxima','rankDiagnostics']}));print(json.dumps({'failureCounts':{k:sum(x['kind']==k for x in failures) for k in sorted(set(x['kind'] for x in failures))}}))
