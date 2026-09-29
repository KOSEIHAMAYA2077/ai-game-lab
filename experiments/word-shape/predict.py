"""Inspect a prediction and the learned letter fragments that contributed to it."""
import argparse,json
from pathlib import Path
from model import predict,features
parser=argparse.ArgumentParser();parser.add_argument('text');parser.add_argument('--model',type=Path,default=Path(__file__).resolve().parent/'artifacts/model.json');args=parser.parse_args()
model=json.loads(args.model.read_text());p=predict(model,args.text)
vocab={g:i for i,g in enumerate(model['vocabulary'])};items,_=features(args.text,vocab,model['idf']);label=model['labels'].index(p['candidate'])
contributions=sorted([(model['vocabulary'][i],v*model['weights'][i][label]) for i,v in items],key=lambda item:-item[1])[:8]
print(json.dumps({'text':args.text,**p,'positive_fragments':contributions},ensure_ascii=False,indent=2))
