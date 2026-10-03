#!/usr/bin/env python3
"""One persistent CPU encoder and frozen task head; JSONL stdin/stdout."""
import os
os.environ.setdefault('OPENBLAS_NUM_THREADS','1')
import argparse,base64,importlib.util,json,pathlib,sys,time
import numpy as np
HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('feature_export',HERE/'static-candidate/export_features.py');features=importlib.util.module_from_spec(spec);spec.loader.exec_module(features)

class StaticTask:
    def __init__(self,path):
        j=json.loads(pathlib.Path(path).read_text())
        if j['format']!='glyph-static-task-v1' or j['dimensions']!=128:raise ValueError('unsupported model')
        self.encoder=features.StaticFeatureEncoder();self.gates=j['thresholds'];self.heads={}
        for key,head in j['heads'].items():
            w=np.frombuffer(base64.b64decode(head['weights']),dtype='<f4').reshape(128,len(head['labels']))
            if not np.isfinite(w).all():raise ValueError('nonfinite weight')
            self.heads[key]=(head['labels'],w,np.array(head['bias'],np.float32))
    def predict(self,text):
        started=time.perf_counter();f=self.encoder.encode(text);base=dict(shape='hold',length='neutral',width='neutral',bend='straight',score=0.,margin=0.,coverage=0.,candidates=[],reason=f['hold'])
        if f['vector'] is not None:
            vector=np.array(f['vector'],np.float32);ranks={}
            for key,(labels,w,b) in self.heads.items():
                z=vector@w+b;p=np.exp(z-z.max());p/=p.sum();ranks[key]=[dict(label=labels[int(i)],score=float(p[i])) for i in np.argsort(-p)]
            shape=ranks['shape'];margin=shape[0]['score']-shape[1]['score'];accept=shape[0]['score']>=self.gates['score'] and margin>=self.gates['margin']
            base.update(shape=shape[0]['label'] if accept else 'hold',score=shape[0]['score'],margin=margin,coverage=1-f['unknownFraction'],candidates=shape[:3],reason='learned_static_head' if accept else 'low_confidence')
            for key in ['length','width','bend']:base[key]=ranks[key][0]['label']
        base['modelMs']=(time.perf_counter()-started)*1000;return base

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--kind',choices=['static-seed','static-bonsai8'],required=True);args=parser.parse_args();model=StaticTask(HERE/'artifacts'/(args.kind+'-model.json'))
    for line in sys.stdin:
        row=json.loads(line);print(json.dumps(dict(id=row.get('id'),**model.predict(row.get('text'))),ensure_ascii=False),flush=True)
if __name__=='__main__':main()
