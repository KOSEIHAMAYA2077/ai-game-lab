from pathlib import Path
import hashlib,json,re

HERE=Path(__file__).resolve().parent
EXPERIMENT=HERE.parents[1]
REPO=HERE.parents[3]
metrics=json.loads((HERE.parent/'metrics.json').read_text())
top=REPO/'README.md';candidate=EXPERIMENT/'README.md'
toptext=top.read_text();text=candidate.read_text()
checks=[]
mapping={'既存形ルール＋明示変形':'rules','文字seed':'seed','文字Bonsai4':'bonsai4','文字Bonsai8':'bonsai8','意味seed':'static-seed','意味Bonsai8':'static-bonsai8'}
for displayed,method in mapping.items():
    line=next((s for s in text.splitlines() if s.startswith('| '+displayed+' |')),None)
    observed=[int(s.strip()) for s in line.split('|')[2:-1]] if line else None
    m=metrics['methods'][method]
    expected=[m['shapeByCategory']['description']['correct'],m['shapeByCategory']['named']['correct'],m['hold']['negation']['falseReactions'],m['hold']['unrelated']['falseReactions']]
    checks.append({'claim':'candidate README table: '+displayed,'observed':observed,'expected':expected,'equal':observed==expected})
headline=next((s for s in toptext.splitlines() if s.startswith('**新しい専用モデル比較:')),None)
for phrase,expected in [('名称なし描写',metrics['methods']['static-seed']['shapeByCategory']['description']),('否定文',{'correct':metrics['methods']['static-seed']['hold']['negation']['falseReactions'],'total':20})]:
    match=re.search(phrase+r'(\d+)/(\d+)',headline or '')
    observed=[int(v) for v in match.groups()] if match else None
    pair=[expected['correct'],expected['total']]
    checks.append({'claim':'top README '+phrase,'observed':observed,'expected':pair,'equal':observed==pair})
for method in ['static-seed','static-bonsai8']:
    m=metrics['methods'][method]
    for key in ['length','width','bend']:
        expected=f"{key}{m['attributes'][key]['modifier24']['correct']}/24"
        checks.append({'claim':'candidate README modifiers '+method+' '+key,'expectedPhrase':expected,'equal':expected in text})
    expected=f"{m['jointModifier24']['correct']}/24"
    checks.append({'claim':'candidate README joint24 '+method,'expectedPhrase':expected,'equal':('全部満たしたのは'+expected) in text})
    nondefault='・'.join(f"{m['attributes'][key]['nonDefaultOnly']['correct']}/{m['attributes'][key]['nonDefaultOnly']['total']}" for key in ['length','width','bend'])
    checks.append({'claim':'candidate README nondefault '+method,'expectedPhrase':nondefault,'equal':nondefault in text})
checks.append({'claim':'candidate README char nondefault all0','equal':all(metrics['methods'][method]['attributes'][key]['nonDefaultOnly']['correct']==0 for method in ['seed','bonsai4','bonsai8'] for key in ['length','width','bend']) and '文字方式は非defaultで全て0' in text})
table=EXPERIMENT/'static-candidate/assets/table-128-float16.bin';model=EXPERIMENT/'artifacts/static-seed-model.json'
checks.append({'claim':'top README fixed table8MiB','observedBytes':table.stat().st_size,'expectedBytes':8*1024*1024,'equal':table.stat().st_size==8*1024*1024 and '固定日本語特徴8MiB' in (headline or '')})
checks.append({'claim':'top README approximately52KB dense model JSON','observedBytes':model.stat().st_size,'equal':51000<=model.stat().st_size<53000 and '約52KB' in (headline or '')})
result={'scope':'Only current task holdout counts, modifier counts and stated table/head byte scale. Older experiment results, dev scores, licenses, publication/URL availability and product behavior were not rechecked. Root documents were not edited.','files':{str(path.relative_to(REPO)):hashlib.sha256(path.read_bytes()).hexdigest() for path in [top,candidate,HERE.parent/'metrics.json']},'checks':checks,'mismatchCount':sum(not c['equal'] for c in checks)}
(HERE/'document-check.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'checks':len(checks),'mismatchCount':result['mismatchCount'],'mismatches':[c for c in checks if not c['equal']]},ensure_ascii=False))
