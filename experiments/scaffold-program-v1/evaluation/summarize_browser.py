import argparse
import json
from pathlib import Path
from score import score,summarize,quantile
D=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--run',default='browser-ui-1');p.add_argument('--cpu',default='regression-cpu-1');p.add_argument('--followup-cpu',default='followup-cpu-1');a=p.parse_args()
raw=json.loads((D/f'{a.run}.json').read_text())
cpu=json.loads((D/f'{a.cpu}.json').read_text());followup=json.loads((D/f'{a.followup_cpu}.json').read_text())
cpu_rows={r['id']:r for group in cpu['fixtures']+followup['fixtures'] for r in group['rows']}
groups=[]
for source in raw['fixtures']:
 fixture=source['file'];cases={r['id']:r for r in json.loads((D/fixture).read_text())['cases']};rows=[]
 for row in [r for r in raw['rows'] if r['fixture']==fixture]:
  cpu_output=cpu_rows[row['id']]['output'];value={**row,**score(cases[row['id']],row['output'],row['error'])}
  value['cpuOutputMatchesUi']=cpu_output.get('program')==row['output'].get('program')
  value['geometryRejected']=row['output'].get('reason')=='unsupported-relation-geometry'
  value['cpuSemanticMeaningPass']=cpu_rows[row['id']]['meaningPass']
  rows.append(value)
 summary=summarize(rows);summary['uiCompletionP50Ms']=quantile([r['timing']['totalMs'] for r in rows],.5);summary['uiCompletionP95Ms']=quantile([r['timing']['totalMs'] for r in rows],.95);summary['uiCompletionMaxMs']=max(r['timing']['totalMs'] for r in rows);summary['geometryRejected']=sum(r['geometryRejected'] for r in rows);summary['cpuOutputMatchesUi']=sum(r['cpuOutputMatchesUi'] for r in rows)
 groups.append({'fixture':fixture,'summary':summary,'rows':rows})
report={'runId':a.run,'evaluationUse':raw['evaluationUse'],'summary':raw['summary'],'fixtures':groups,'cold':raw['cold'],'warm':raw['warm'],'stress':raw['stress'],'errors':raw['errors'],'distributionUnchanged':raw['distributionUnchanged'],'historySequence':{'cases':len([r for r in raw['rows'] if r['fixture']=='history-sequence']),'retainedCharactersAndBatches':sum(r['previousCharactersRetained'] and r['previousBatchesRetained'] for r in raw['rows'] if r['fixture']=='history-sequence')},'limitations':raw['limitations'],'timingScopes':{'wallMs':'Normal UI fill/Enter through polling completion, includes test driver overhead.','totalMs':'App submit start through geometry/glyphs, first render, 3.95s absorption and visible completion.','modelMs':'Worker controller only.','firstFrameMs':'First partially forming frame, not completed shape.'}}
out=D/f'{a.run}-scored.json'
if out.exists():raise SystemExit('Refusing overwrite')
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({**report,'fixtures':[{k:v for k,v in f.items() if k!='rows'} for f in groups],'stress':raw['stress'] and raw['stress']['timing']},ensure_ascii=False,indent=2))
