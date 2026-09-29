"""Train from scratch with NumPy; select rejection gates on validation only."""
import argparse, hashlib, json, time
from collections import Counter
from pathlib import Path
import numpy as np
from model import LABELS, grams, features, predict, metrics, normalize
ROOT=Path(__file__).resolve().parent

def read(path): return [json.loads(s) for s in path.read_text(encoding='utf-8').splitlines() if s.strip()]
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--extra',type=Path); parser.add_argument('--output',type=Path,default=ROOT/'artifacts'); args=parser.parse_args(); args.output.mkdir(parents=True,exist_ok=True)
    train=read(ROOT/'data/train.jsonl'); validation=read(ROOT/'data/validation.jsonl')
    if args.extra: train+=read(args.extra)
    assert all(r['label'] in LABELS and normalize(r['text']) for r in train+validation)
    assert not {normalize(r['text']) for r in train}&{normalize(r['text']) for r in validation}, 'train/validation duplicate'
    started=time.perf_counter()
    # Only training text is allowed to determine vocabulary or document frequency.
    df=Counter(g for row in train for g in grams(row['text']))
    vocabulary=sorted(df); vocab={g:i for i,g in enumerate(vocabulary)}
    idf=np.array([np.log((1+len(train))/(1+df[g]))+1 for g in vocabulary],dtype=np.float32)
    x=np.zeros((len(train),len(vocabulary)),dtype=np.float32)
    for row,item in enumerate(train):
        values,_=features(item['text'],vocab,idf)
        for i,v in values: x[row,i]=v
    y=np.array([LABELS.index(r['label']) for r in train]); onehot=np.eye(len(LABELS),dtype=np.float32)[y]
    # Class balancing prevents frequent negative templates from dominating all shapes.
    counts=np.bincount(y,minlength=len(LABELS)); sample_weights=(len(y)/(len(LABELS)*counts[y])).astype(np.float32)
    rng=np.random.default_rng(17); weights=rng.normal(0,.001,(len(vocabulary),len(LABELS))).astype(np.float32); bias=np.zeros(len(LABELS),np.float32)
    mw=np.zeros_like(weights); vw=np.zeros_like(weights); mb=np.zeros_like(bias); vb=np.zeros_like(bias)
    curve=[]; l2=.0001; epochs=240; rate=.06
    for epoch in range(1,epochs+1):
        logits=x@weights+bias; logits-=logits.max(axis=1,keepdims=True)
        probs=np.exp(logits); probs/=probs.sum(axis=1,keepdims=True)
        error=(probs-onehot)*sample_weights[:,None]/len(y)
        gw=x.T@error+l2*weights; gb=error.sum(axis=0)
        mw=.9*mw+.1*gw; vw=.999*vw+.001*gw*gw; mb=.9*mb+.1*gb; vb=.999*vb+.001*gb*gb
        weights-=rate*(mw/(1-.9**epoch))/(np.sqrt(vw/(1-.999**epoch))+1e-8)
        bias-=rate*(mb/(1-.9**epoch))/(np.sqrt(vb/(1-.999**epoch))+1e-8)
        if epoch==1 or epoch%20==0:
            loss=float(np.mean(-np.log(np.maximum(probs[np.arange(len(y)),y],1e-9))*sample_weights)+l2*.5*np.sum(weights*weights))
            curve.append({'epoch':epoch,'loss':loss,'train_accuracy':float(np.mean(probs.argmax(axis=1)==y))})
    model={'format':'glyph-linear-v1','version':'0.1.0','labels':LABELS,'maxChars':256,'ngram':[1,3],
           'vocabulary':vocabulary,'idf':[round(float(v),6) for v in idf],'weights':[[round(float(v),6) for v in row] for row in weights],'bias':[round(float(v),6) for v in bias],
           'thresholds':{'score':0,'margin':0,'coverage':0},'training':{'seed':17,'epochs':epochs,'l2':l2,'learning_rate':rate,'train_sha256':sha(ROOT/'data/train.jsonl'),'validation_sha256':sha(ROOT/'data/validation.jsonl'),'extra_sha256':sha(args.extra) if args.extra else None}}
    raw=[predict(model,r['text']) for r in validation]
    best=None
    for score in [.35,.45,.55,.65,.75,.85,.9]:
        for margin in [.1,.2,.3]:
            for coverage in [.35,.5,.65]:
                predictions=[dict(p,label=p['candidate'] if p['score']>=score and p['margin']>=margin and p['coverage']>=coverage else 'none') for p in raw]
                m=metrics(validation,predictions)
                # Validation objective penalizes false transformations without rewarding an always-reject model.
                key=(m['shape_recall'] - 4*m['none_false_positive_rate'] - (1-m['accepted_precision']), m['accepted_precision'], m['shape_recall'],score,margin,coverage)
                if best is None or key>best[0]: best=(key,{'score':score,'margin':margin,'coverage':coverage},m)
    model['thresholds']=best[1]
    path=args.output/'model.json'; path.write_text(json.dumps(model,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    report={'model_sha256':sha(path),'numpy':np.__version__,'train_n':len(train),'validation_n':len(validation),'features':len(vocabulary),'parameters':weights.size+bias.size,'elapsed_seconds':round(time.perf_counter()-started,3),'curve':curve,'thresholds':best[1],'validation':best[2],'holdout_used':False,'validation_objective':'shape_recall - 4*none_false_positive_rate - (1-accepted_precision)'}
    (args.output/'training.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='curve'},ensure_ascii=False,indent=2))
if __name__=='__main__': main()
