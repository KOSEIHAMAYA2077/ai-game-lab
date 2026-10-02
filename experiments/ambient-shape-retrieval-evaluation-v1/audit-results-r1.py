"""Read saved first-run outputs only. No imports/model calls or policy edits."""
from pathlib import Path
from collections import Counter
import json, hashlib, math, datetime
p=Path(__file__).parent
cs=json.loads((p/'FIXTURES-R1.json').read_text())['cases']
r=json.loads((p/'RESULTS-R1.json').read_text()); s=json.loads((p/'SUMMARY-R1.json').read_text())
checks=[]; details={}
for mode,rows in r['output'].items():
 assert len(rows)==120 and len({x['id'] for x in rows})==120
 byid={x['id']:x for x in rows}; summary=s['summaries'][mode]
 stats={}; bykind={}; rawhits=0; nonzero_top3=0; zero_only_top3=[]
 for group in ('positive','no_shape','unresolved'):
  cases=[c for c in cs if c['group']==group]
  accepted=sum(byid[c['id']]['acceptedShape'] is not None for c in cases)
  hit=sum((byid[c['id']]['acceptedShape'] in c['allowedShapes']) if group=='positive' else (byid[c['id']]['acceptedShape'] is None) for c in cases)
  wrong=accepted-hit if group=='positive' else 0
  fp=accepted if group!='positive' else 0
  got={'total':len(cases),'accepted':accepted,'hit':hit,'abstained':len(cases)-accepted,'falsePositive':fp,'wrongShape':wrong}
  for k,v in got.items(): assert summary['groups'][group][k]==v,(mode,group,k)
  stats[group]=got
  for kind in sorted({c['sourceKind'] for c in cases}):
   cr=[c for c in cases if c['sourceKind']==kind]; acc=sum(byid[c['id']]['acceptedShape'] is not None for c in cr); hits=sum(byid[c['id']]['acceptedShape'] in c['allowedShapes'] if group=='positive' else byid[c['id']]['acceptedShape'] is None for c in cr)
   sub={'total':len(cr),'accepted':acc,'hit':hits,'falsePositive':acc if group!='positive' else 0,'wrongShape':acc-hits if group=='positive' else 0,'abstained':len(cr)-acc}
   assert summary['groups'][group]['sourceKinds'][kind]==sub
   bykind[group+':'+kind]=sub
 if mode!='baseline':
  rawhits=sum(byid[c['id']]['raw']['rawTop1'] in c['allowedShapes'] for c in cs if c['group']=='positive')
  assert rawhits==summary['rawTop1Positive']['hits']
  ranked_hits=0
  for c in cs:
   if c['group']!='positive': continue
   raw=byid[c['id']]['raw']; top3=raw['ranking'][:3]
   hit=any(x['shape'] in c['allowedShapes'] for x in top3)
   informative=any(x['shape'] in c['allowedShapes'] and x['score']>0 for x in top3)
   ranked_hits+=int(hit);nonzero_top3+=int(informative)
   if hit and not informative:zero_only_top3.append(c['id'])
  assert ranked_hits==summary['groups']['positive']['top3Hit']
 times=sorted(x['elapsedMs'] for x in rows)
 for q,label in ((.5,'p50Ms'),(.95,'p95Ms'),(.99,'p99Ms')): assert math.isclose(times[math.ceil(len(times)*q)-1],summary['latency'][label],rel_tol=0,abs_tol=1e-12)
 assert math.isclose(max(times),summary['latency']['maxMs'],rel_tol=0,abs_tol=1e-12)
 checks.append({'mode':mode,'savedOutputIndependentArithmeticMatches':True,'modelCalls':0})
 details[mode]={'groups':stats,'sourceKinds':bykind,'rawTop1Positive':rawhits if mode!='baseline' else None,'posthocNonzeroTop3Diagnostic':{'hits':nonzero_top3,'total':60,'zeroOnlyHitCaseIds':zero_only_top3,'note':'After-result diagnostic; original top3 metric unchanged. Full60ranking includes0-score inventory-order entries.'} if mode!='baseline' else None}
# Verify freeze files remain unchanged; additional support only verified after comparison.
root=p.resolve().parents[1]; candidate=root/'experiments/ambient-shape-retrieval-v1'
support=json.loads((candidate/'FREEZE-SUPPORT-R1.json').read_text()); supportrows=[]
for x in support['files']:
 b=(root/x['path']).read_bytes(); actual=hashlib.sha256(b).hexdigest(); assert actual==x['sha256'] and len(b)==x['bytes']; supportrows.append({**x,'currentMatches':True})
report={'version':'post-result-readonly-arithmetic-r1','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':checks,'candidateCalls':0,'details':details,'supportManifestSHA256':hashlib.sha256((candidate/'FREEZE-SUPPORT-R1.json').read_bytes()).hexdigest(),'supportFiles':supportrows,'supportTiming':'Support manifest received after first evaluation and verified now. Initial41-file candidate pin +3fixturechecks are separate; no retrospective assertion that these3supportfiles had been pinned before execution.'}
out=p/'AUDIT-R1.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'modesRecomputed':len(checks),'mismatches':0,'candidateCalls':0,'nonzeroTop3':{k:v['posthocNonzeroTop3Diagnostic'] for k,v in details.items() if k!='baseline'},'supportFiles':len(supportrows)}))
