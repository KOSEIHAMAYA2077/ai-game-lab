#!/usr/bin/env python3
"""Local, bounded Bonsai caption generation. Never executes generated text."""
import argparse, datetime, hashlib, json, pathlib, re, time, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent.parent

def catalog():
    base = (REPO/'prototypes/glyph-creature/src/language.ts').read_text()
    expanded = (REPO/'prototypes/glyph-creature/src/shape-catalog.ts').read_text()
    names = dict(re.findall(r"(\w+): '([^']+)'", base.split('export const SHAPE_NAMES:')[1].split('};')[0]))
    names.update(dict(re.findall(r"(\w+): '([^']+)'", expanded.split('export const EXPANDED_NAMES:')[1].split('};')[0])))
    basic = re.findall(r"'([^']+)'",base.split('export const SHAPES = [')[1].split('] as const')[0])
    extra = re.findall(r"'([^']+)'",expanded.split('export const EXPANDED_SHAPES = [')[1].split('] as const')[0])
    labels = basic+extra
    assert len(labels)==len(set(labels))==60
    return [(label,names[label]) for label in labels]

def main():
    p=argparse.ArgumentParser(); p.add_argument('--url',default='http://127.0.0.1:4241'); p.add_argument('--limit',type=int,default=60); args=p.parse_args()
    out=ROOT/'teacher'; out.mkdir(exist_ok=True)
    raw=out/'raw-r1.jsonl'
    if raw.exists(): raise SystemExit('immutable run exists: choose a new run, do not overwrite')
    schema={'type':'array','items':{'type':'string'},'minItems':4,'maxItems':4}
    system='形を日本語の短い描写に言い換える。指定された形を必ず保つ。各描写は15〜35文字程度。4個の文字列だけのJSON配列を出す。説明やマークダウンは出さない。'
    results=[]
    with raw.open('x') as f:
        for label,name in catalog()[:args.limit]:
            prompt=f'対象: {name} ({label})。この名前を直接使わず、輪郭・部位・用途からこの形を連想できる描写を4種類作る。他の物の名前への置換や比喩だけは避ける。追加の色や寸法変更の注文を入れず標準形の特徴を描写する。'
            body={'messages':[{'role':'system','content':system},{'role':'user','content':prompt}], 'temperature':0.65,'seed':1003+len(results),'max_tokens':256,'response_format':{'type':'json_schema','json_schema':{'name':'captions','strict':True,'schema':schema}}}
            start=time.perf_counter(); record={'shape':label,'name':name,'request':body,'startedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()}
            try:
                headers={'Content-Type':'application/json'}
                key=REPO/'.local/bonsai-task-student-v1/api-key.txt'
                if key.exists(): headers['Authorization']='Bearer '+key.read_text().strip()
                req=urllib.request.Request(args.url+'/v1/chat/completions',json.dumps(body,ensure_ascii=False).encode(),headers)
                with urllib.request.urlopen(req,timeout=90) as response: reply=json.load(response)
                record['response']=reply
                content=reply['choices'][0]['message']['content']; captions=json.loads(content)
                record['captions']=captions if isinstance(captions,list) and len(captions)==4 and all(isinstance(x,str) for x in captions) else []
                record['status']='generated' if record['captions'] else 'invalid-array'
            except Exception as error: record.update(status='failed',error=str(error))
            record['seconds']=time.perf_counter()-start
            f.write(json.dumps(record,ensure_ascii=False)+'\n');f.flush();results.append(record)
            print(json.dumps({'shape':label,'status':record['status'],'seconds':round(record['seconds'],2)},ensure_ascii=False),flush=True)
    metadata={'teacher':'prism-ml/Bonsai-4B-gguf/Q1_0','modelBytes':572270624,'modelSha256':'4524b3f997f0f06444e568d1f26e2efd69effa3218c7ad3047432fb171e42168','method':'teacher-generated captions with externally specified shape targets; output-based task training, no hidden-state or logit distillation','rawSha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'requests':len(results),'successfulArrays':sum(x['status']=='generated' for x in results),'seconds':sum(x['seconds'] for x in results),'inputPrivacy':'only artificial shape names and author prompts; localhost inference'}
    (out/'generation-r1.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__': main()
