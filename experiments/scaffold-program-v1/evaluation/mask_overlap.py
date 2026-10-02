"""Audit relation-input overlap against the frozen first parser revision."""
import ast
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import unicodedata
D=Path(__file__).resolve().parent;M=D.parent/'model';F=M/'freeze-regression-1'
spec=importlib.util.spec_from_file_location('frozen_config',F/'config.py');config=importlib.util.module_from_spec(spec);spec.loader.exec_module(config)
namespace={'re':re,'unicodedata':unicodedata,'ALIASES':config.ALIASES,'PATTERNS':config.PATTERNS}
tree=ast.parse((F/'predict.py').read_text());functions=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in {'normalize','alias_pattern','clean_negation','relation_scope'}]
exec(compile(ast.Module(body=functions,type_ignores=[]),'<frozen-pure-preprocessing>','exec'),namespace)
train={}
for filename in ['training.jsonl','validation.jsonl']:
 data=[json.loads(x) for x in (M/filename).read_text().splitlines() if x]
 queries=[config.relation_query(item['text']) for item in data]
 train[filename]={'samples':len(data),'uniqueQueries':len(set(queries)),'queries':set(queries),'folded':{q.casefold() for q in queries}}
fixtures=[]
for filename in ['fixture.json','same-type-fixture.json','followup-fixture.json']:
 cases=json.loads((D/filename).read_text())['cases'];rows=[]
 for case in cases:
  text=namespace['normalize'](case['text']);cleaned,_=namespace['clean_negation'](text);query=config.relation_query(namespace['relation_scope'](cleaned))
  rows.append({'id':case['id'],'requestedRelation':bool(case['expected'] and case['expected']['relation']),'effectiveMaskedRelationQuery':query,'trainingExact':query in train['training.jsonl']['queries'],'validationExact':query in train['validation.jsonl']['queries'],'trainingCasefold':query.casefold() in train['training.jsonl']['folded'],'validationCasefold':query.casefold() in train['validation.jsonl']['folded']})
 fixtures.append({'fixture':filename,'cases':len(rows),'requestedRelationCases':sum(r['requestedRelation'] for r in rows),'exactMaskedTrainingMatches':sum(r['trainingExact'] for r in rows),'exactMaskedValidationMatches':sum(r['validationExact'] for r in rows),'casefoldMaskedTrainingMatches':sum(r['trainingCasefold'] for r in rows),'casefoldMaskedValidationMatches':sum(r['validationCasefold'] for r in rows),'rows':rows})
report={'frozenConfigSha256':hashlib.sha256((F/'config.py').read_bytes()).hexdigest(),'frozenPredictSha256':hashlib.sha256((F/'predict.py').read_bytes()).hexdigest(),'datasets':{name:{k:v for k,v in d.items() if k not in {'queries','folded'}} for name,d in train.items()},'fixtures':fixtures,'scope':'Exact input-string overlap after the same rule preprocessing. Zero raw fixture sentence overlap does not imply unseen relation templates. These are synthetic finite-grammar evaluations.'}
p=D/'masked-overlap-1.json'
if p.exists():raise SystemExit('Refusing overwrite')
p.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({**report,'fixtures':[{k:v for k,v in f.items() if k!='rows'} for f in fixtures]},ensure_ascii=False,indent=2))
