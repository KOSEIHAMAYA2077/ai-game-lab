#!/usr/bin/env python3
"""Reproducible output-based task training; no evaluation file is read here."""
import argparse, base64, hashlib, json, math, pathlib, re, time, unicodedata
import numpy as np

ROOT=pathlib.Path(__file__).resolve().parent
DIM=8192; SEED=31003; EPOCHS=100
ATTRS={'length':['short','neutral','long'],'width':['narrow','neutral','wide'],'bend':['straight','curved']}
DEFAULT={'length':'neutral','width':'neutral','bend':'straight'}
def norm(s): return re.sub(r'\s+',' ',unicodedata.normalize('NFKC',s).lower()).strip()
def features(text):
    text='^'+norm(text)+'$'; ids=set()
    for n in range(1,6):
        for i in range(len(text)-n+1):
            h=2166136261
            for c in text[i:i+n]: h=((h^ord(c))*16777619)&0xffffffff
            ids.add(h%DIM)
    a=np.array(sorted(ids),np.int32)
    return a,1/math.sqrt(max(1,len(a)))
def dump(path,data): path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def corpus(teacher_run=None):
    shapes=json.loads((ROOT/'seeds/shapes.json').read_text()); holds=json.loads((ROOT/'seeds/holds.json').read_text()); transforms=json.loads((ROOT/'seeds/transforms.json').read_text())
    base=[]
    for s in shapes:
        for text in list(dict.fromkeys([s['name']]+s['aliases'])): base.append(dict(text=text,label=s['shape'],split='train',family=s['shape']+'/name',source='ai-authored-seed'))
        for d in s['descriptions']: base.append(dict(text=d['text'],label=s['shape'],split=d['split'],family=s['shape']+'/'+d['family'],source='ai-authored-seed'))
    for h in holds: base.append(dict(text=h['text'],label='hold',split=h['split'],family='hold/'+h['family'],source='ai-authored-seed'))
    if teacher_run:
        for r in json.loads((ROOT/('teacher/curated-'+teacher_run+'.json')).read_text()):
            if r['accepted']: base.append(dict(text=r['text'],label=r['shape'],split='train',family=r['shape']+'/'+r['sourceFamily']+'/teacher-'+teacher_run,source='bonsai-caption-ai-reviewed'))
    rows=[]
    for b in base:
        for wrapper in ['{}','{}のような形','{}を表現したい','形は{}']:
            # Daily/negative rows keep their original semantics. A request
            # wrapper around a negative would turn it into a quoted request.
            if b['label']=='hold' and wrapper!='{}': continue
            rows.append(dict(b,head='shape',text=wrapper.format(b['text'])))
        if b['source']!='bonsai-caption-ai-reviewed':
            for head in ATTRS:
                rows.append(dict(b,head=head,label=DEFAULT[head]))
        # Global modifier cross-products use canonical shape names only. This
        # keeps variants bounded and avoids calling implicit body proportions
        # an instruction to deform the entire body.
        if b['label']=='hold' or b['source']=='bonsai-caption-ai-reviewed': continue
        canonical=next(s['name'] for s in shapes if s['shape']==b['label'])
        if b['text']!=canonical: continue
        for t in transforms:
            for phrase in t['phrases']:
                # Explicit global changes are distinguished from local shape
                # features such as a narrow neck of a vase.
                split='dev' if b['split']=='dev' or phrase['split']=='dev' else 'train'
                text=phrase['text'].replace('{}',b['text']) if '{}' in phrase['text'] else phrase['text']+' '+b['text']
                row=dict(b,text=text,split=split,family=b['family']+'/'+phrase['family'])
                # Shape identity remains invariant under bounded deformation.
                rows.append(dict(row,head='shape'))
                for head in ATTRS:
                    rows.append(dict(row,head=head,label=t['value'] if t['head']==head else DEFAULT[head]))
    # Whole-family split is preserved. Remove normalized duplicate utterances
    # from training if any identical utterance is reserved for development.
    dev_keys={(r['head'],norm(r['text'])) for r in rows if r['split']=='dev'}
    kept={}; collisions=[]
    for row in rows:
        key=(row['head'],norm(row['text']))
        if row['split']=='train' and key in dev_keys: collisions.append(row); continue
        if key in kept:
            if kept[key]['label']!=row['label']: raise ValueError('inconsistent label: '+str(key))
        else: kept[key]=row
    return list(kept.values()),collisions

def fit(rows,labels,epochs=EPOCHS):
    train=[r for r in rows if r['split']=='train']; dev=[r for r in rows if r['split']=='dev']
    mapped=[(*features(r['text']),labels.index(r['label'])) for r in train]
    w=np.zeros((DIM,len(labels)),np.float32); bias=np.zeros(len(labels),np.float32); rng=np.random.default_rng(SEED)
    counts=np.bincount([r[2] for r in mapped],minlength=len(labels)); weight=np.sqrt(counts.max()/np.maximum(counts,1)); weight=np.minimum(weight,2.5)
    loss_log=[]
    for epoch in range(epochs):
        lr=.35/(1+epoch*.035); loss=0
        for j in rng.permutation(len(mapped)):
            ids,f,target=mapped[j]; z=w[ids].sum(axis=0)*f+bias; p=np.exp(z-z.max());p/=p.sum(); loss-=math.log(max(1e-12,float(p[target])))
            p[target]-=1; p*=weight[target]
            w[ids]-=lr*f*p; bias-=lr*.08*p
        w*=1-lr*.0001
        if epoch in [0,24,49,74,epochs-1]: loss_log.append([epoch+1,loss/len(mapped)])
    scale=float(np.abs(w).max())/32760 or 1.; q=np.rint(w/scale).astype('<i2'); w=q.astype(np.float32)*scale
    known=np.zeros(DIM,np.uint8)
    for ids,_,_ in mapped: known[ids]=1
    model=dict(labels=labels,scale=scale,bias=[float(x) for x in bias],weights=base64.b64encode(q.tobytes()).decode(),known=base64.b64encode(np.packbits(known,bitorder='little').tobytes()).decode())
    predictions=[]
    for r in dev:
        ids,f=features(r['text']); z=w[ids].sum(axis=0)*f+bias;p=np.exp(z-z.max());p/=p.sum();order=np.argsort(-p)
        predictions.append(dict(text=r['text'],family=r['family'],label=r['label'],prediction=labels[order[0]],score=float(p[order[0]]),margin=float(p[order[0]]-p[order[1]]),coverage=float(known[ids].mean())))
    return model,dict(trainCount=len(train),devCount=len(dev),devTop1Correct=sum(r['prediction']==r['label'] for r in predictions),loss=loss_log,predictions=predictions)

def thresholds(rows):
    positive=[r for r in rows if r['label']!='hold']; negative=[r for r in rows if r['label']=='hold']
    tested=[]
    for score in [.1,.2,.3,.4,.5,.6]:
        for margin in [0,.05,.1,.15]:
            for coverage in [0,.2]:
                def selection(r): return r['prediction'] if r['score']>=score and r['margin']>=margin and r['coverage']>=coverage else 'hold'
                pos=sum(selection(r)==r['label'] for r in positive)/max(1,len(positive)); neg=sum(selection(r)=='hold' for r in negative)/max(1,len(negative))
                tested.append(dict(score=score,margin=margin,coverage=coverage,objective=(pos+neg)/2,positiveAccuracy=pos,holdAccuracy=neg))
    best=max(tested,key=lambda x:(x['objective'],x['holdAccuracy'],x['positiveAccuracy'],-x['score'],-x['margin']))
    return {k:best[k] for k in ['score','margin','coverage']},dict(method='development only; equally weighted positive exactness and hold accuracy',selected=best,candidates=tested)

def main():
    p=argparse.ArgumentParser();p.add_argument('--kind',choices=['seed','bonsai4','bonsai8'],required=True);p.add_argument('--epochs',type=int,default=EPOCHS);args=p.parse_args()
    out=ROOT/'artifacts';out.mkdir(exist_ok=True);start=time.perf_counter()
    teacher_run={'bonsai4':'r2','bonsai8':'r3'}.get(args.kind)
    rows,duplicates=corpus(teacher_run); labels=[x['shape'] for x in json.loads((ROOT/'seeds/shapes.json').read_text())]+['hold']
    assert len(labels)==61
    models={}; reports={}
    for key,classes in [('shape',labels)]+list(ATTRS.items()):
        models[key],reports[key]=fit([r for r in rows if r['head']==key],classes,args.epochs)
        print(json.dumps({'kind':args.kind,'head':key,'train':reports[key]['trainCount'],'dev':reports[key]['devCount'],'correct':reports[key]['devTop1Correct']},ensure_ascii=False),flush=True)
    gates,gating=thresholds(reports['shape']['predictions'])
    artifact=dict(format='glyph-task-student-v1',dimensions=DIM,ngramMin=1,ngramMax=5,normalization='NFKC-lowercase-space',hash='fnv1a-codepoint',kind=args.kind,seed=SEED,epochs=args.epochs,thresholds=gates,heads=models)
    modelpath=out/(args.kind+'-model.json');corpuspath=out/(args.kind+'-corpus.json');dump(modelpath,artifact);dump(corpuspath,rows)
    reports['gating']=gating;reports['meta']=dict(kind=args.kind,modelBytes=modelpath.stat().st_size,modelSha256=sha(modelpath),corpusSha256=sha(corpuspath),epochs=args.epochs,seconds=time.perf_counter()-start,seed=SEED,dimensions=DIM,removedTrainDuplicatesOfDev=len(duplicates),method='AI-authored hard labels; teacher only adds AI-reviewed paraphrases for the shape head; shape/attribute sparse linear softmax heads, not a distilled general LLM',teacherUsed=bool(teacher_run),teacherRun=teacher_run)
    dump(out/(args.kind+'-training.json'),reports)
    print(json.dumps(reports['meta'],ensure_ascii=False),flush=True)
if __name__=='__main__':main()
