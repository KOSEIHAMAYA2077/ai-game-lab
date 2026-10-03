#!/usr/bin/env python3
"""Refit the stored seed train rows with the current training core, in memory.
Writes a summary only to training-review; no model artifact is replaced.
"""
import hashlib,importlib.util,json,pathlib,sys,time
sys.dont_write_bytecode=True
REVIEW=pathlib.Path(__file__).resolve().parent;TASK=REVIEW.parent

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    script=TASK/'train.py';before=sha(script)
    spec=importlib.util.spec_from_file_location('current_training_core',script);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    stored=json.loads((TASK/'artifacts/seed-corpus.json').read_text());artifact=json.loads((TASK/'artifacts/seed-model.json').read_text());checks={};started=time.perf_counter()
    for head in ['shape','length','width','bend']:
        model,report=module.fit([r for r in stored if r['head']==head],artifact['heads'][head]['labels'],artifact['epochs'])
        checks[head]=dict(modelExactEquality=model==artifact['heads'][head],trainCount=report['trainCount'],devCount=report['devCount'],devCorrect=report['devTop1Correct'])
        print(json.dumps({'head':head,**checks[head]}),flush=True)
    after=sha(script);result=dict(checks=checks,trainCoreSha256=before,trainCoreUnchangedDuringCheck=before==after,seconds=time.perf_counter()-started,seedModelSha256=sha(TASK/'artifacts/seed-model.json'),seedCorpusSha256=sha(TASK/'artifacts/seed-corpus.json'),scope='Stored train/dev corpus refit in memory using current training core, including gate-independent head fits. No evaluation files or artifact writes.')
    (REVIEW/'seed-reproduction.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
