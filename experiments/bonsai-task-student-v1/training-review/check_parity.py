#!/usr/bin/env python3
"""Only author-provided train/dev fixtures and synthetic normalization probes.
Never reads the frozen evaluation folder. Writes only to training-review.
"""
import argparse,base64,collections,hashlib,importlib.util,json,math,pathlib,re,subprocess,sys,unicodedata
import numpy as np
sys.dont_write_bytecode=True
REVIEW=pathlib.Path(__file__).resolve().parent
TASK=REVIEW.parent
REPO=TASK.parent.parent
INFERENCE=REPO/'prototypes/glyph-creature/src/task-student-v1/inference.mjs'
HEADS=['shape','length','width','bend']
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def normalize(text):return re.sub(r'\s+',' ',unicodedata.normalize('NFKC',text).lower()).strip()
def features(text,dim,ngram_min=1,ngram_max=5):
    chars='^'+normalize(text)+'$'; result=set()
    for size in range(ngram_min,ngram_max+1):
        for i in range(len(chars)-size+1):
            value=2166136261
            for character in chars[i:i+size]:value=((value^ord(character))*16777619)&0xffffffff
            result.add(value%dim)
    return sorted(result)
def probability(logits):
    exp=np.exp(logits-np.max(logits));return exp/np.sum(exp)
def python_result(raw,text,key,float32=False):
    head=raw['heads'][key]; ids=features(text,raw['dimensions'],raw['ngramMin'],raw['ngramMax']); scale=1/math.sqrt(max(1,len(ids)))
    weights=np.frombuffer(base64.b64decode(head['weights']),dtype='<i2').reshape(raw['dimensions'],len(head['labels']))
    known=np.unpackbits(np.frombuffer(base64.b64decode(head['known']),dtype=np.uint8),bitorder='little')[:raw['dimensions']]
    if float32:
        w=weights.astype(np.float32)*head['scale']; logits=w[ids].sum(axis=0)*scale+np.asarray(head['bias'],dtype=np.float32)
    else:
        # Sum quantized coefficients exactly as integers, then scale once.
        logits=weights[ids].astype(np.int64).sum(axis=0)*head['scale']*scale+np.asarray(head['bias'],dtype=np.float64)
    p=probability(logits); order=sorted(range(len(p)),key=lambda i:-p[i])
    coverage=float(known[ids].mean()) if ids else 0.
    return [{'label':head['labels'][i],'score':float(p[i]),'coverage':coverage} for i in order]
def gated(raw,text,heads):
    shape=heads['shape']; first,second=shape[:2]; gate=raw['thresholds']
    held=not normalize(text) or first['label']=='hold' or first['score']<gate['score'] or first['score']-second['score']<gate['margin'] or first['coverage']<gate['coverage']
    if len(text)>512:return dict(shape='hold',length='neutral',width='neutral',bend='straight')
    return dict(shape='hold' if held else first['label'],**{k:heads[k][0]['label'] for k in HEADS[1:]})
def fixtures():
    shapes=json.loads((TASK/'seeds/shapes.json').read_text()); rows=[]
    selected={'condense','cube','vase','mobius','jellyfish','lotus','bottle','snake'}
    for shape in shapes:
        if shape['shape'] not in selected:continue
        rows.append(dict(id=shape['shape']+'.name',kind='train-name',text=shape['name']))
        for split in ['train','dev']:
            row=next(d for d in shape['descriptions'] if d['split']==split)
            rows.append(dict(id=row['family'],kind=split+'-description',text=row['text']))
    probes=[
        ('ascii-ws','  花瓶\t\n 球体  '),('fullwidth',' ＡＢＣ　花瓶 '),('combining','e\u0301 花瓶'),('astral','𠮷😀花瓶'),
        ('case-expansion','İﬃＡ'),('unicode-16-case','\u1c89 花瓶'),('unicode-15-nfkc','\U0001e030 花瓶'),('nbsp','花瓶\u00a0球体'),('next-line','花瓶\u0085球体'),
        ('file-separator','花瓶\u001c球体'),('bom','花瓶\ufeff球体'),('empty',''),('only-space',' \t\n '),
        ('512-chars','あ'*512),('513-chars','あ'*513),
        ('whole-modifiers','短い 太い 曲がった 球体'),('implicit-neck','胴がふくらみ、上へ向かう首が細くなった口の開いた容器。'),
        ('hold-command','花瓶の姿を作るのはやめて。'),
    ]
    rows.extend(dict(id='probe.'+name,kind='normalization-or-contract-probe',text=text) for name,text in probes)
    return rows
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--kind',default='seed',choices=['seed','bonsai4','bonsai8']);parser.add_argument('--round',default='r2',choices=['r2','r3']);args=parser.parse_args()
    model_path=TASK/'artifacts'/f'{args.kind}-model.json'; raw=json.loads(model_path.read_text())
    cases=fixtures(); fixture_path=REVIEW/f'parity-fixtures-{args.round}.json'; fixture_path.write_text(json.dumps(cases,ensure_ascii=False,indent=2)+'\n')
    output=subprocess.check_output(['node',str(REVIEW/'probe.mjs'),str(INFERENCE),str(model_path),str(fixture_path)],cwd=REPO,text=True)
    js=json.loads(output); (REVIEW/f'{args.kind}-node-raw-{args.round}.json').write_text(json.dumps(js,ensure_ascii=False,indent=2)+'\n')
    spec=importlib.util.spec_from_file_location('reviewed_train',TASK/'train.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    evidence=[];max_error=0.;max_float32_error=0.
    for row in js['rows']:
        text=row['text']; ids=features(text,raw['dimensions']); trainer_ids=list(map(int,module.features(text)[0]))
        assert ids==trainer_ids,('independent feature implementation diverged from trainer',row['id'])
        pyheads={key:python_result(raw,text,key) for key in HEADS}; pypred=gated(raw,text,pyheads)
        py32={key:python_result(raw,text,key,True) for key in HEADS}
        errors=[];errors32=[]
        for key in HEADS:
            by_label={r['label']:r for r in row['heads'][key]}
            errors += [abs(by_label[q['label']]['score']-q['score']) for q in pyheads[key]]
            errors32 += [abs(by_label[q['label']]['score']-q['score']) for q in py32[key]]
        same_features=ids==row['featureIds'];same_prediction=all(row['prediction'][key]==pypred[key] for key in HEADS)
        same_top1=all(row['heads'][key][0]['label']==pyheads[key][0]['label'] for key in HEADS)
        same_float32_top1=all(py32[key][0]['label']==pyheads[key][0]['label'] for key in HEADS)
        err=max(errors);err32=max(errors32);max_error=max(max_error,err);max_float32_error=max(max_float32_error,err32)
        evidence.append(dict(id=row['id'],kind=row['kind'],pythonFeatureCount=len(ids),jsFeatureCount=len(row['featureIds']),sameFeatures=same_features,sameHeadTop1=same_top1,samePrediction=same_prediction,sameFloat32Top1=same_float32_top1,maxScoreError=err,maxFloat32ScoreError=err32,pythonPrediction=pypred,jsPrediction={k:row['prediction'][k] for k in HEADS},featureOnlyPython=sorted(set(ids)-set(row['featureIds']))[:10],featureOnlyJS=sorted(set(row['featureIds'])-set(ids))[:10]))
    compatible=[r for r in evidence if not r['id'].startswith(('probe.unicode-16-case','probe.unicode-15-nfkc'))]
    summary=dict(normalizationCompatibleCases=len(compatible),normalizationCompatibleFeaturesEqual=sum(r['sameFeatures'] for r in compatible),normalizationCompatibleTop1Equal=sum(r['sameHeadTop1'] for r in compatible),normalizationCompatiblePredictionEqual=sum(r['samePrediction'] for r in compatible),normalizationCompatibleMaxScoreError=max(r['maxScoreError'] for r in compatible),normalizationCompatibleMaxFloat32ScoreError=max(r['maxFloat32ScoreError'] for r in compatible),unsupportedUnicodeCaseIds=[r['id'] for r in evidence if r['id'].startswith(('probe.unicode-16-case','probe.unicode-15-nfkc'))],kind=args.kind,round=args.round,cases=len(evidence),featuresEqual=sum(r['sameFeatures'] for r in evidence),top1Equal=sum(r['sameHeadTop1'] for r in evidence),predictionEqual=sum(r['samePrediction'] for r in evidence),float32Top1Equal=sum(r['sameFloat32Top1'] for r in evidence),maxScoreError=max_error,maxFloat32ScoreError=max_float32_error,python=sys.version,numpy=np.__version__,unicodeVersion=unicodedata.unidata_version,node=js['node'],files={str(path.relative_to(REPO)):sha(path) for path in [TASK/'train.py',INFERENCE,model_path,fixture_path]},scope='Train/dev seeds and reviewer normalization probes only. No frozen evaluation input or prediction read.',rows=evidence)
    (REVIEW/f'{args.kind}-parity-{args.round}.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in summary.items() if k not in ['rows','files']},ensure_ascii=False))
    print(json.dumps({'mismatches':[r for r in evidence if not r['sameFeatures'] or not r['samePrediction'] or not r['sameHeadTop1']]},ensure_ascii=False))
if __name__=='__main__':main()
