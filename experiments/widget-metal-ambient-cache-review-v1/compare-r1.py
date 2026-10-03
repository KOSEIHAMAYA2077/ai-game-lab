"""Static comparison of frozen independent cases; no new candidate/model calls."""
from pathlib import Path
import json,hashlib,sys
H=Path(__file__).resolve().parent
old_node=json.loads((H/'OLD-NODE-R1.json').read_text())
new_node=json.loads((H/'CANDIDATE-NODE-R1.json').read_text())
old_native=json.loads((H/'OLD-JSC-SWIFT-R1.json').read_text())
native_name=sys.argv[1] if len(sys.argv)>1 else 'CANDIDATE-JSC-SWIFT-R2.json'
out_name=sys.argv[2] if len(sys.argv)>2 else 'COMPARISON-R1.json'
new_native=json.loads((H/native_name).read_text())
failures=[];normal_steps=0;instance_records=0;float_fields=0;identity_fields=0;idle_no_delta=0;growth_delta=0;transfer=[]
def fail(case,step,kind):failures.append({'case':case,'step':step,'kind':kind})
for a,b,c,d in zip(old_node['runs'],new_node['runs'],old_native['runs'],new_native['runs']):
 assert len({a['id'],b['id'],c['id'],d['id']})==1;case=a['id']
 if d.get('error'):fail(case,None,'native-exception:'+d['error'])
 if len(a['traces'])!=len(b['traces']) or len(c['traces'])!=len(d['traces']):fail(case,None,'trace-count');continue
 for old,new,oldc,newc in zip(a['traces'],b['traces'],c['traces'],d['traces']):
  if old.get('reset'):
   if not(new.get('reset') and oldc.get('reset') and newc.get('reset')):fail(case,old['step'],'reset')
   continue
  step=old['step'];normal_steps+=1
  for key in ['aggregate','units','presentedCount','shape']:
   if old['view'][key]!=new['view'][key]:fail(case,step,'node.'+key)
  for key in ['aggregate','bodyLiteral','bodyIDs','bodyInks','glyphs','projectionChanged','instances']:
   if oldc[key]!=newc[key]:fail(case,step,'native.'+key)
  instance_records+=len(oldc['instances']);float_fields+=16*len(oldc['instances']);identity_fields+=4*len(oldc['instances'])
  if newc['metadataBytes']!=new['metadataBytes'] or newc['bodyBytes']!=new['bodyBytes']:fail(case,step,'node-jsc-transferBytes')
  if newc['deltaIDs']!=new['deltaIDs']:fail(case,step,'node-jsc-deltaIDs')
  if not newc['deltaIDs']:
   idle_no_delta+=1
   if newc['bodyCalls']!=0 or newc['bodyBytes']!=0:fail(case,step,'no-growth-body-transfer')
  else:growth_delta+=1
  if newc['validatedUnits']!=newc['aggregate']['bodyCount']:fail(case,step,'validate-only-received-units')
 if a['offExport']!=b['offExport'] or c['offExport']!=d['offExport']:fail(case,None,'offExport')
 transfer.append({'case':case,'oldNodeFullViewBytes':a['wireBytes'],'newNodeMetadataPlusDeltaBytes':b['wireBytes'],'newJSCMetadataBytes':d['totalMetadataBytes'],'newJSCBodyBytes':d['totalBodyBytes'],'oldUnitsTransferred':a['transferUnits'],'newUnitsTransferred':b['transferUnits'],'oldUTF16Transferred':a['transferUTF16'],'newUTF16Transferred':b['transferUTF16'],'newBodyCalls':d['totalBodyCalls']})
normal_passed=12-len({x['case'] for x in failures})
result={'version':'independent-cache-comparison-r1','candidateNativeFile':native_name,'sessionCases':12,'oldNodeHandExpectedPassed':old_node['passed'],'candidateNodeHandExpectedPassed':new_node['passed'],'nativeSessionsComparedPassed':normal_passed,'normalSteps':normal_steps,'normalFailures':failures,'instanceRecordsCompared':instance_records,'float32FieldsBitwiseCompared':float_fields,'uint32FieldsCompared':identity_fields,'wireParentCases':new_native['wireParentCases'],'wireAttempts':new_native['wireAttempts'],'wirePassedAttempts':new_native['wirePassed'],'wireFailedAttempts':[r['id'] for r in new_native['wireRuns'] if not r['passed']],'noGrowthStepsNoBodyTransfer':idle_no_delta,'growthSteps':growth_delta,'transferByCase':transfer,'transferTotals':{key:sum(r[key] for r in transfer) for key in transfer[0] if key!='case'},'references':[{'path':p,'sha256':hashlib.sha256((H/p).read_bytes()).hexdigest()} for p in ['OLD-NODE-R1.json','CANDIDATE-NODE-R1.json','OLD-JSC-SWIFT-R1.json',native_name]],'scope':'Fixed synthetic12 session/14 wire parent cases, component transfer and real CPU 80B field parity. No app/UI/GPU/IME/OS/resource/model or comfort claim.'}
with (H/out_name).open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({k:result[k] for k in ['nativeSessionsComparedPassed','normalSteps','normalFailures','instanceRecordsCompared','float32FieldsBitwiseCompared','uint32FieldsCompared','wireAttempts','wirePassedAttempts','wireFailedAttempts','noGrowthStepsNoBodyTransfer','growthSteps','transferTotals']}))
