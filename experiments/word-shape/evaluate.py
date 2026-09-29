"""Run after freezing the model. Does not optimize or change its weights/gates."""
import json,hashlib,argparse
from pathlib import Path
from model import predict,metrics,normalize
ROOT=Path(__file__).resolve().parent

def read(p): return [json.loads(s) for s in p.read_text().splitlines() if s.strip()]
parser=argparse.ArgumentParser();parser.add_argument('--model',type=Path,default=ROOT/'artifacts/model.json');parser.add_argument('--extra',type=Path);parser.add_argument('--output',type=Path,default=ROOT/'artifacts/evaluation.json');args=parser.parse_args()
modelpath=args.model; model=json.loads(modelpath.read_text())
rows=read(ROOT/'data/holdout.jsonl'); train=read(ROOT/'data/train.jsonl'); validation=read(ROOT/'data/validation.jsonl')
# Report overlap instead of silently changing the independently prepared evaluation.
extra=[]
if model.get('training',{}).get('extra_sha256'):
    assert args.extra and hashlib.sha256(args.extra.read_bytes()).hexdigest()==model['training']['extra_sha256'], 'Pass matching --extra data for overlap audit'
    extra=read(args.extra)
seen={normalize(r['text']) for r in train+validation+extra}
results=[{**r,**{'prediction':predict(model,r['text']),'exact_overlap':normalize(r['text']) in seen}} for r in rows]
unique=[r for r in results if not r['exact_overlap']]
report={'model_sha256':hashlib.sha256(modelpath.read_bytes()).hexdigest(),'holdout_sha256':hashlib.sha256((ROOT/'data/holdout.jsonl').read_bytes()).hexdigest(),'overlap_count':len(rows)-len(unique),'all':metrics(rows,[r['prediction'] for r in results]),'without_exact_overlap':metrics(unique,[r['prediction'] for r in unique]),'by_category':{c:metrics([r for r in unique if r['category']==c],[r['prediction'] for r in unique if r['category']==c]) for c in sorted({r['category'] for r in unique})},'results':results}
args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='results'},ensure_ascii=False,indent=2))
