#!/usr/bin/env python3
"""Same seed task on Bonsai 8B, before any independent evaluation is read."""
import datetime,json,pathlib,time,urllib.request
ROOT=pathlib.Path(__file__).resolve().parent;REPO=ROOT.parent.parent
def main():
    raw=ROOT/'teacher/raw-r3.jsonl'
    if raw.exists():raise SystemExit('run exists')
    key=(REPO/'.local/bonsai-task-student-v1/api-key.txt').read_text().strip()
    with raw.open('x') as f:
        for shape in json.loads((ROOT/'seeds/shapes.json').read_text()):
            for i,d in enumerate([x for x in shape['descriptions'] if x['split']=='train'][:2]):
                body={'messages':[{'role':'system','content':'日本語の文を、意味を保ったまま別の短い日本語の一文に言い換えてください。答えの一文だけを書いてください。'},{'role':'user','content':d['text']}],'temperature':.4,'seed':10300+len(shape['shape'])+i,'max_tokens':96}
                row={'shape':shape['shape'],'sourceFamily':d['family'],'sourceText':d['text'],'teacher':'Bonsai-8B-Q1_0','request':body,'startedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()};start=time.perf_counter()
                try:
                    req=urllib.request.Request('http://127.0.0.1:4241/v1/chat/completions',json.dumps(body,ensure_ascii=False).encode(),{'Content-Type':'application/json','Authorization':'Bearer '+key})
                    with urllib.request.urlopen(req,timeout=60) as response:reply=json.load(response)
                    row['response']=reply;row['text']=reply['choices'][0]['message']['content'].strip();row['status']='generated' if reply['choices'][0]['finish_reason']=='stop' else 'truncated'
                except Exception as e:row.update(status='failed',error=str(e))
                row['seconds']=time.perf_counter()-start;f.write(json.dumps(row,ensure_ascii=False)+'\n');f.flush()
                print(json.dumps({k:row[k] for k in ['shape','status','seconds']},ensure_ascii=False),flush=True)
if __name__=='__main__':main()
