#!/usr/bin/env python3
"""Feature-only parity on author train/dev fixtures; no task head or evaluation."""
import hashlib,importlib.util,json,pathlib,subprocess,sys
import numpy as np
sys.dont_write_bytecode=True
HERE=pathlib.Path(__file__).resolve().parent;TASK=HERE.parent;REPO=HERE.parents[2]

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def module(path,name):
    spec=importlib.util.spec_from_file_location(name,path);result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result

def main():
    encoder_source=HERE/'export_features.py';native_source=HERE/'StaticFeatureR1.swift';binary=HERE/'static-feature-r1';original_native=REPO/'experiments/native-static-japanese-v1/NativeStaticR5.swift';original_sha=sha(original_native)
    encoder=module(encoder_source,'new_feature_encoder').StaticFeatureEncoder()
    oracle=module(REPO/'experiments/static-japanese-retrieval-v1/retrieval.py','existing_static_encoder').StaticEncoder(REPO/'.local/static-japanese-v1','128-float16')
    fixtures=json.loads((TASK/'training-review/parity-fixtures-r2.json').read_text())
    fixtures += [{'id':'static.mask-lstrip','kind':'added-token-probe','text':'花瓶  <mask> 球体'},{'id':'static.literal-special','kind':'added-token-probe','text':'<s>花瓶</s>'},{'id':'static.unk','kind':'unknown-probe','text':'<unk>'}]
    payload=''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in fixtures)
    (HERE/'feature-fixtures.jsonl').write_text(payload)
    output=subprocess.check_output([str(binary),'--model-dir',str(REPO/'.local/static-japanese-v1'),'--debug'],input=payload,cwd=REPO,text=True)
    native=[json.loads(line) for line in output.splitlines()]
    python=[dict(id=r['id'],**encoder.encode(r['text'],True)) for r in fixtures]
    (HERE/'python-feature-raw.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in python))
    (HERE/'native-feature-raw.jsonl').write_text(output)
    rows=[];issues=[];max_error=0.;max_mean_error=0.;max_oracle_error=0.
    assert len(native)==len(fixtures)
    for fixture,py,nat in zip(fixtures,python,native):
        text=fixture['text'];token_equal=py['tokenIds']==nat['tokenIds'];hold_equal=py['hold']==nat['hold'];vector_error=0.;mean_error=0.;oracle_error=0.
        if py['vector'] is not None and nat['vector'] is not None:vector_error=float(np.max(np.abs(np.asarray(py['vector'])-np.asarray(nat['vector']))))
        if py['mean'] is not None and nat['mean'] is not None:mean_error=float(np.max(np.abs(np.asarray(py['mean'])-np.asarray(nat['mean']))))
        if len(text)<=512:
            old,meta=oracle.encode(text)
            oracle_hold=meta.get('hold')
            if oracle_hold!=py['hold']:issues.append(dict(id=fixture['id'],check='existing_python_hold',old=oracle_hold,new=py['hold']))
            if old is not None and py['vector'] is not None:oracle_error=float(np.max(np.abs(old-np.asarray(py['vector']))))
        max_error=max(max_error,vector_error);max_mean_error=max(max_mean_error,mean_error);max_oracle_error=max(max_oracle_error,oracle_error)
        if not token_equal or not hold_equal or vector_error>1e-5 or mean_error>1e-5 or oracle_error>1e-7:issues.append(dict(id=fixture['id'],check='feature_parity',token_equal=token_equal,hold_equal=hold_equal,vector_error=vector_error,mean_error=mean_error,oracle_error=oracle_error))
        rows.append(dict(id=fixture['id'],kind=fixture['kind'],tokenIdsEqual=token_equal,holdsEqual=hold_equal,hold=py['hold'],tokenCount=py['tokenCount'],vectorError=vector_error,meanError=mean_error,existingPythonVectorError=oracle_error))
    # Stream boundary checks ensure a rejected record does not consume the next.
    stream=[b'not-json\n',b'{}\n',b'{"id":"wrong-type","text":7}\n',json.dumps({'text':'x'*66000}).encode()+b'\n',b'{"id":"following","text":"vase"}\n']
    boundary={}
    for name,command in [('python',[sys.executable,'-B',str(encoder_source)]),('native',[str(binary),'--model-dir',str(REPO/'.local/static-japanese-v1')])]:
        raw=subprocess.check_output(command,input=b''.join(stream),cwd=REPO)
        replies=[json.loads(line) for line in raw.splitlines()];boundary[name]=[r['hold'] for r in replies]
        if len(replies)!=5 or boundary[name]!=['invalid_json','invalid_request','input_limit','jsonl_line_limit',None] or replies[-1]['id']!='following' or len(replies[-1]['vector'])!=128:issues.append(dict(check='jsonl_boundary_recovery',implementation=name,holds=boundary[name]))
    if sha(original_native)!=original_sha:issues.append(dict(check='original_native_changed'))
    result=dict(cases=len(rows),tokenIdsEqual=sum(r['tokenIdsEqual'] for r in rows),holdsEqual=sum(r['holdsEqual'] for r in rows),maxNativeVectorError=max_error,maxNativeMeanError=max_mean_error,maxExistingPythonVectorError=max_oracle_error,gateBeforeRunning={'nativeVectorAndMeanAbsoluteTolerance':1e-5,'existingPythonVectorAbsoluteTolerance':1e-7},jsonlBoundaryRecovery=boundary,originalNativeSourceUnchanged=sha(original_native)==original_sha,metadata=encoder.metadata(),files={str(p.relative_to(REPO)):sha(p) for p in [encoder_source,native_source,binary,original_native,REPO/'experiments/static-japanese-retrieval-v1/retrieval.py']},issues=issues,scope='Feature parity on AI-authored seed train/dev fixtures and synthetic input probes only. No new quality evaluation, frozen evaluation read, task head, training or threshold.',rows=rows)
    (HERE/'feature-parity.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k not in ['rows','files']},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
