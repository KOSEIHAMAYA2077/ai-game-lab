#!/usr/bin/env python3
"""One frozen stream into one frozen wire process, plus separate known-R5 oracle."""
import argparse, base64, datetime, hashlib, json, math, subprocess, time
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent


def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(path):
    raw=path.read_bytes();return len(raw),hashlib.sha256(raw).hexdigest()
def saved(path,value):
    assert not path.exists(), 'Do not overwrite previous evidence'
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def finite(value):
    if isinstance(value,float): return math.isfinite(value)
    if isinstance(value,dict): return all(finite(v) for v in value.values())
    if isinstance(value,list): return all(finite(v) for v in value)
    return True

def run(binary,payload):
    began=time.perf_counter()
    proc=subprocess.Popen([str(ROOT/binary)],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    timed_out=False
    try: stdout,stderr=proc.communicate(input=payload,timeout=15)
    except subprocess.TimeoutExpired:
        timed_out=True;proc.terminate()
        try: stdout,stderr=proc.communicate(timeout=5)
        except subprocess.TimeoutExpired: proc.kill();stdout,stderr=proc.communicate(timeout=5)
    return {'pid':proc.pid,'exitCode':proc.returncode,'batchWallSeconds':time.perf_counter()-began,'timedOut':timed_out},stdout,stderr

def pin_check(rows):
    result=[]
    for row in rows:
        n,h=digest(ROOT/row['path'])
        result.append({'path':row['path'],'bytes':n,'sha256':h,'matched':n==row['bytes'] and h==row['sha256']})
    assert all(r['matched'] for r in result), 'Frozen source changed'
    return result

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--candidate',required=True)
    parser.add_argument('--pins',required=True)
    parser.add_argument('--run-dir',required=True)
    args=parser.parse_args()
    run_dir=(ROOT/args.run_dir).resolve()
    assert HERE==run_dir.parent and not run_dir.exists(), 'Use a new owned output directory'
    fixture_path=HERE/'CASES-R1.json';fixture=json.loads(fixture_path.read_text())
    freeze=json.loads((HERE/'FREEZE-R1.json').read_text())
    for row in freeze['files']:
        assert digest(HERE/row['path'])==(row['bytes'],row['sha256'])
    pin=json.loads((ROOT/args.pins).read_text());before=pin_check(pin['files'])
    assert args.candidate in [row['path'] for row in pin['files']], 'Candidate binary must be pinned'
    run_dir.mkdir()
    flat=[];payloads=[]
    for case in fixture['cases']:
        data=base64.b64decode(case['payloadBase64'],validate=True)
        assert len(data)==case['payloadBytes'] and hashlib.sha256(data).hexdigest()==case['payloadSHA256']
        payloads.append(data)
        for e in case['expectedReplies']: flat.append((case['id'],e))
    normals=[(i,c,e) for i,(c,e) in enumerate(flat) if e['kind']=='normal-r5-parity']
    oracle_request=b''.join(json.dumps({'text':e['oracleText'],'registry':e['registry']},ensure_ascii=False).encode()+b'\n' for _,_,e in normals)
    oracle_meta,oracle_stdout,oracle_stderr=run('experiments/native-static-japanese-v1/native-static-r5',oracle_request)
    (run_dir/'ORACLE-STDOUT.jsonl').write_bytes(oracle_stdout)
    (run_dir/'ORACLE-STDERR.txt').write_bytes(oracle_stderr)
    saved(run_dir/'ORACLE-PROCESS.json',oracle_meta)
    assert not oracle_meta['timedOut'] and oracle_meta['exitCode']==0 and not oracle_stderr, 'Known-R5 oracle failed'
    old_replies=[json.loads(line) for line in oracle_stdout.splitlines()]
    assert len(old_replies)==len(normals), 'Known-R5 oracle reply count mismatch'
    expected={}
    for (index,case,e),reply in zip(normals,old_replies):
        expected[index]={'case':case,'requestId':e['requestId'],'registry':e['registry'],
                         'hold':reply['encoding'].get('hold'),
                         'ranks':[{'label':r['label'],'score':r['score']} for r in reply['ranks'][:3]]}
    saved(run_dir/'ORACLE-PROJECTION.json',{'createdUTC':now(),'knownR5Replies':len(old_replies),
          'semanticScoring':False,'maximumAbsoluteScoreError':1e-6,'byReplyIndex':expected})
    oracle_pins=[]
    for filename in ['ORACLE-STDOUT.jsonl','ORACLE-STDERR.txt','ORACLE-PROCESS.json','ORACLE-PROJECTION.json']:
        n,h=digest(run_dir/filename);oracle_pins.append({'path':filename,'bytes':n,'sha256':h})
    saved(run_dir/'ORACLE-FREEZE.json',{'atUTC':now(),'beforeFirstCandidateCall':True,'files':oracle_pins})
    before_candidate=pin_check(pin['files'])
    meta,stdout,stderr=run(args.candidate,b''.join(payloads))
    (run_dir/'WIRE-STDOUT.jsonl').write_bytes(stdout)
    (run_dir/'WIRE-STDERR.txt').write_bytes(stderr)
    saved(run_dir/'WIRE-PROCESS.json',meta)
    lines=stdout.splitlines();parsed=[];parse_errors=[]
    for i,line in enumerate(lines):
        try: parsed.append(json.loads(line))
        except Exception as exc: parsed.append(None);parse_errors.append({'replyIndex':i,'kind':type(exc).__name__})
    rows=[]
    all_holds={'frame_limit','invalid_utf8','invalid_json','invalid_schema','invalid_registry','input_limit',
               'native_normalization_byte_limit','token_limit','invalid_token_id','nonfinite_vector','empty_vector','unknown_tokens'}
    for i,(case,e) in enumerate(flat):
        reply=parsed[i] if i<len(parsed) else None
        flags={}
        if not isinstance(reply,dict): flags['jsonObject']=False
        else:
            rid=reply.get('requestId');registry=reply.get('registry');ranks=reply.get('ranks');hold=reply.get('hold');elapsed=reply.get('elapsedMs')
            flags['fixedFiveKeys']=set(reply)=={'requestId','registry','ranks','hold','elapsedMs'}
            flags['safeIntegerOrNullId']=rid is None or (type(rid) is int and 0<=rid<=9007199254740991)
            flags['knownRegistryOrNull']=registry in [None,'shape','primitive']
            flags['fixedHoldOrNull']=hold is None or hold in all_holds
            flags['finiteNonnegativeElapsed']=type(elapsed) in (int,float) and math.isfinite(elapsed) and elapsed>=0
            flags['rankSchema']=isinstance(ranks,list) and len(ranks)<=3 and all(isinstance(r,dict) and set(r)=={'label','score'} and isinstance(r['label'],str) and type(r['score']) in (int,float) and math.isfinite(r['score']) for r in ranks)
            flags['finiteReply']=finite(reply)
            flags['replyWithin2048ContentBytes']=len(lines[i])<=2048
            if e['kind']=='rejection':
                flags['expectedRejection']=hold==e['hold'] and ranks==[]
                flags['noInvalidFieldEcho']=rid in e['allowedRequestIds'] and registry in e['allowedRegistries']
            else:
                wanted=expected[i]
                flags['exactCorrelationAndRegistry']=rid==wanted['requestId'] and registry==wanted['registry']
                flags['sameR5Hold']=hold==wanted['hold']
                flags['sameR5RankLabelsAndOrder']=isinstance(ranks,list) and [r.get('label') for r in ranks]==[r['label'] for r in wanted['ranks']]
                flags['sameR5RankScores']=isinstance(ranks,list) and len(ranks)==len(wanted['ranks']) and all(type(a.get('score')) in (int,float) and math.isfinite(a['score']) and abs(a['score']-b['score'])<=1e-6 for a,b in zip(ranks,wanted['ranks']))
        rows.append({'replyIndex':i,'case':case,'expectationKind':e['kind'],'flags':flags,'pass':all(flags.values()),'reply':reply})
    after=pin_check(pin['files'])
    payload_counts=[]
    for case in fixture['cases']:
        subset=[r for r in rows if r['case']==case['id']]
        payload_counts.append({'case':case['id'],'replies':len(subset),'pass':all(r['pass'] for r in subset)})
    failure_markers=['SYNTH_INVALID_JSON_MARKER','SYNTH_EXTRA_KEY_MARKER','SYNTH_TEXT_TYPE_MARKER','SYNTH_UNKNOWN_REGISTRY_MARKER','SYNTH_FRAME_OVERSIZE_MARKER','青い球の人工文','底が閉じた花瓶']
    body_echo=[m for m in failure_markers if m.encode() in stdout or m.encode() in stderr]
    process_pass=not meta['timedOut'] and meta['exitCode']==0 and not stderr
    counts_pass=len(parsed)==len(flat) and len(flat)==fixture['expectedReplyCount']
    result={'atUTC':now(),'scope':'One synthetic bounded wire stream; not semantic or human evaluation',
            'candidate':args.candidate,'fixtureSHA256':digest(fixture_path)[1],'sourcePinsBefore':before,'sourcePinsBeforeCandidate':before_candidate,'sourcePinsAfter':after,
            'process':meta,'oracleProcess':oracle_meta,'knownR5OracleCalls':len(old_replies),'candidateProcesses':1,
            'payloadCases':len(payload_counts),'payloadPasses':sum(r['pass'] for r in payload_counts),
            'replyCount':len(parsed),'expectedReplyCount':len(flat),'replyPasses':sum(r['pass'] for r in rows),
            'normalParityReplies':len(normals),'normalEmbeddingRankReplies':sum(bool(v['ranks']) for v in expected.values()),
            'normalHeldReplies':sum(v['hold'] is not None for v in expected.values()),
            'processChecksPassed':process_pass,'replyCountChecksPassed':counts_pass,'parseErrors':parse_errors,'bodyEchoMarkers':body_echo,
            'cases':payload_counts,'replies':rows,'allChecksPassed':process_pass and counts_pass and not parse_errors and not body_echo and all(r['pass'] for r in rows),
            'newOSGPUUICalls':0,'actualIPCAuthentication':False,'modelSemanticAccuracy':False}
    saved(run_dir/'RESULTS.json',result)
    print(json.dumps({'runDir':str(run_dir.relative_to(ROOT)),'payloadCases':result['payloadCases'],'payloadPasses':result['payloadPasses'],
          'replyPasses':result['replyPasses'],'expectedReplies':len(flat),'allChecksPassed':result['allChecksPassed'],
          'normalEmbeddingRankReplies':result['normalEmbeddingRankReplies'],'normalHeldReplies':result['normalHeldReplies']}))

if __name__=='__main__': main()
