#!/usr/bin/env python3
"""Frozen static Japanese token vectors + learned task heads, dev-only selection.

No frozen evaluation input is read. This is a second candidate, not Bonsai
weight distillation. The feature table remains frozen; only four heads train.
"""
import os
os.environ.setdefault('OPENBLAS_NUM_THREADS','1')
os.environ.setdefault('TOKENIZERS_PARALLELISM','false')
import argparse,base64,hashlib,importlib.util,json,pathlib,time
import numpy as np
from train import ROOT,ATTRS,SEED,corpus,dump,sha

spec=importlib.util.spec_from_file_location('static_features',ROOT/'static-candidate/export_features.py')
features=importlib.util.module_from_spec(spec);spec.loader.exec_module(features)
LABELS=[s['shape'] for s in json.loads((ROOT/'seeds/shapes.json').read_text())]+['hold']
CONFIGS=[dict(lr=lr,l2=l2,epochs=160,batch=128) for lr in [.02,.06] for l2 in [.0001,.005]]

def probabilities(x,w,b):
    z=x@w+b;z-=z.max(axis=1,keepdims=True);p=np.exp(z);return p/p.sum(axis=1,keepdims=True)

def fit(x,y,labels,config):
    w=np.zeros((128,len(labels)),np.float32);b=np.zeros(len(labels),np.float32)
    mw=np.zeros_like(w);vw=np.zeros_like(w);mb=np.zeros_like(b);vb=np.zeros_like(b)
    counts=np.bincount(y,minlength=len(labels));cw=(len(y)/(len(labels)*np.maximum(1,counts))).astype(np.float32)
    rng=np.random.default_rng(SEED);step=0
    for epoch in range(config['epochs']):
        order=rng.permutation(len(y))
        for start in range(0,len(y),config['batch']):
            ids=order[start:start+config['batch']];xb=x[ids];yb=y[ids]
            g=probabilities(xb,w,b);g[np.arange(len(ids)),yb]-=1;g*=cw[yb,None]/len(ids)
            gw=xb.T@g+config['l2']*w;gb=g.sum(axis=0);step+=1
            mw=.9*mw+.1*gw;vw=.999*vw+.001*gw*gw;mb=.9*mb+.1*gb;vb=.999*vb+.001*gb*gb
            w-=config['lr']*(mw/(1-.9**step))/(np.sqrt(vw/(1-.999**step))+1e-8)
            b-=config['lr']*(mb/(1-.9**step))/(np.sqrt(vb/(1-.999**step))+1e-8)
    return w,b

def grouped(rows,p,labels,gates=None):
    pred=p.argmax(axis=1);score=p.max(axis=1);sorted_p=np.sort(p,axis=1);margin=sorted_p[:,-1]-sorted_p[:,-2]
    if gates:
        pred=pred.copy();pred[(score<gates['score'])|(margin<gates['margin'])]=labels.index('hold')
    groups={}
    for i,r in enumerate(rows):
        k='hold' if r['label']=='hold' else 'named' if '/name/' in r['family'] else 'description'
        z=groups.setdefault(k,dict(count=0,correct=0));z['count']+=1;z['correct']+=labels[pred[i]]==r['label']
    for z in groups.values():z['accuracy']=z['correct']/z['count']
    return groups

def macro(rows,p,labels):
    pred=p.argmax(axis=1);y=np.array([labels.index(r['label']) for r in rows]);return float(np.mean([np.mean(pred[y==i]==i) for i in range(len(labels)) if np.any(y==i)]))

def encode_model(w,b,labels):
    return dict(labels=labels,weights=base64.b64encode(w.astype('<f4').tobytes()).decode(),bias=[float(v) for v in b])

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--kind',choices=['static-seed','static-bonsai8'],required=True);args=parser.parse_args()
    started=time.perf_counter();encoder=features.StaticFeatureEncoder();rows,duplicates=corpus('r3' if args.kind=='static-bonsai8' else None)
    vectors={};invalid=[]
    for text in dict.fromkeys(r['text'] for r in rows):
        answer=encoder.encode(text)
        if answer['vector'] is None:invalid.append(dict(text=text,reason=answer['hold']))
        else:vectors[text]=np.asarray(answer['vector'],np.float32)
    if invalid:raise ValueError('training/dev input failed encoder: '+str(invalid[:3]))
    reports={};models={};gates=None
    for head,labels in [('shape',LABELS)]+list(ATTRS.items()):
        train=[r for r in rows if r['head']==head and r['split']=='train'];dev=[r for r in rows if r['head']==head and r['split']=='dev']
        x=np.stack([vectors[r['text']] for r in train]);y=np.array([labels.index(r['label']) for r in train]);xd=np.stack([vectors[r['text']] for r in dev]);trials=[]
        for config in CONFIGS:
            w,b=fit(x,y,labels,config);p=probabilities(xd,w,b)
            objective=float(np.mean([v['accuracy'] for v in grouped(dev,p,labels).values()])) if head=='shape' else macro(dev,p,labels)
            trials.append(dict(config=config,objective=objective,w=w,b=b,p=p))
        selected=max(trials,key=lambda t:t['objective']);w,b,p=selected['w'],selected['b'],selected['p'];models[head]=encode_model(w,b,labels)
        report=dict(trainCount=len(train),devCount=len(dev),selectedConfig=selected['config'],selectionObjective='mean named/description/hold group accuracy' if head=='shape' else 'macro per-label accuracy',selectedObjective=selected['objective'],trials=[dict(config=t['config'],objective=t['objective']) for t in trials])
        if head=='shape':
            gs=[]
            for score in [0,.1,.2,.3,.4,.5]:
                for margin in [0,.05,.1,.15]:
                    gate=dict(score=score,margin=margin);g=grouped(dev,p,labels,gate);gs.append(dict(gate=gate,objective=np.mean([v['accuracy'] for v in g.values()]),groups=g))
            chosen=max(gs,key=lambda t:(t['objective'],t['groups']['hold']['accuracy'],-t['gate']['score'],-t['gate']['margin']));gates=chosen['gate'];report.update(rawGroups=grouped(dev,p,labels),gatedGroups=chosen['groups'],gateSelection=gs)
        report['byLabel']={label:dict(count=sum(r['label']==label for r in dev),correct=sum(r['label']==label and labels[int(p[i].argmax())]==label for i,r in enumerate(dev))) for label in labels}
        report['predictions']=[dict(text=r['text'],family=r['family'],label=r['label'],prediction=labels[int(p[i].argmax())],score=float(p[i].max()),margin=float(np.sort(p[i])[-1]-np.sort(p[i])[-2])) for i,r in enumerate(dev)]
        reports[head]=report;print(json.dumps(dict(kind=args.kind,head=head,objective=selected['objective'],config=selected['config'])),flush=True)
    out=ROOT/'artifacts';artifact=dict(format='glyph-static-task-v1',kind=args.kind,dimensions=128,seed=SEED,featureModel=encoder.metadata(),thresholds=gates,heads=models)
    # Initialization timing belongs to a benchmark, not the fixed model.
    artifact['featureModel'].pop('initializationMs',None)
    modelpath=out/(args.kind+'-model.json');corpuspath=out/(args.kind+'-corpus.json');dump(modelpath,artifact);dump(corpuspath,rows)
    reports['meta']=dict(kind=args.kind,modelBytes=modelpath.stat().st_size,modelSha256=sha(modelpath),corpusSha256=sha(corpuspath),seconds=time.perf_counter()-started,seed=SEED,featureTableBytes=8388608,teacherUsed=args.kind=='static-bonsai8',teacherRun='r3' if args.kind=='static-bonsai8' else None,removedTrainDuplicatesOfDev=len(duplicates),method='Frozen pretrained Japanese static embeddings; trained balanced linear softmax task heads; no LLM weights/logits/hidden states transferred')
    dump(out/(args.kind+'-training.json'),reports);print(json.dumps(reports['meta']),flush=True)
if __name__=='__main__':main()
