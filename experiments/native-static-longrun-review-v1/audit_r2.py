#!/usr/bin/env python3
"""Saved-file arithmetic only. Never launches native code or process samplers."""
import argparse, datetime, hashlib, json, math, re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent

def sha(data):
    return hashlib.sha256(data).hexdigest()

def load(path):
    return json.loads(path.read_text())

def instant(text):
    return datetime.datetime.fromisoformat(text)

def finite_tree(value):
    if isinstance(value, float):
        return math.isfinite(value)
    if isinstance(value, dict):
        return all(finite_tree(v) for v in value.values())
    if isinstance(value, list):
        return all(finite_tree(v) for v in value)
    return True

def number_summary(values):
    values = sorted(values)
    if not values:
        return {"count": 0}
    return {"count": len(values), "min": values[0], "max": values[-1],
            "median": values[len(values)//2], "mean": sum(values)/len(values)}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-dir', default='experiments/native-static-longrun-v1')
    parser.add_argument('--output', required=True)
    parser.add_argument('--allow-interim', action='store_true')
    args = parser.parse_args()
    source = ROOT / args.input_dir
    destination = Path(args.output)
    if not destination.is_absolute():
        destination = ROOT / destination
    if HERE != destination.parent and HERE not in destination.parents:
        raise ValueError('Output must remain in owned review folder')
    if destination.exists():
        raise ValueError('Do not overwrite prior audit')
    freeze = load(source/'FREEZE-R1.json'); run = load(source/'RUN-R1.json')
    cfg = load(source/'QUERIES-R1.json')
    summary = load(source/'SUMMARY-R1.json') if (source/'SUMMARY-R1.json').exists() else None
    if summary is None and not args.allow_interim:
        raise ValueError('Final summary absent; use explicit interim option')
    queries = load(source/'QUERIES-RAW-R1.json')
    samples = load(source/'SAMPLES-R1.json')
    source_pins = []
    for item in freeze['files']:
        data = (ROOT/item['path']).read_bytes()
        source_pins.append({"path": item['path'], "bytes": len(data), "sha256": sha(data),
                            "matched": len(data)==item['bytes'] and sha(data)==item['sha256']})
    raw_hashes=[]
    for filename in ['FREEZE-R1.json','RUN-R1.json','QUERIES-RAW-R1.json','SAMPLES-R1.json','SUMMARY-R1.json','TIME-R1.log']:
        path=source/filename
        if path.exists():
            data=path.read_bytes();raw_hashes.append({"path":str(path.relative_to(ROOT)),"bytes":len(data),"sha256":sha(data)})
    errors=[]; query_rows=[]; ordinary_index=0
    for i,query in enumerate(queries):
        kind=query['kind']; planned=query['scheduledOffsetSeconds']
        if kind=='ordinary':
            text=cfg['ordinary'][ordinary_index%len(cfg['ordinary'])]
            scheduled=ordinary_index*cfg['ordinaryIntervalSeconds'];ordinary_index+=1
        elif kind=='long4000':
            text=cfg['longText']; scheduled=planned
        else:
            text='';scheduled=None;errors.append({"code":"unknown-kind","index":i})
        request=json.dumps({"text":text,"registry":"shape"},ensure_ascii=False).encode()+b'\n'
        request_ok=query['requestBytes']==len(request) and query['requestSHA256']==sha(request)
        schedule_ok=planned==scheduled and (kind!='long4000' or planned in cfg['longOffsetsSeconds'])
        reply=query['reply']; enc=reply.get('encoding',{});tokens=enc.get('tokens',{});ranks=reply.get('ranks',[])
        ids=tokens.get('ids',[])
        ids_ok=isinstance(ids,list) and all(type(x) is int and 0<=x<32768 for x in ids)
        hold=enc.get('hold')
        structure_ok=(isinstance(enc,dict) and isinstance(ranks,list) and ids_ok and
                      (len(ids)<=4000 or hold=='token_limit') and (not hold or not ranks) and
                      (not enc.get('vector') or len(enc['vector'])==128) and
                      (not enc.get('mean') or len(enc['mean'])==128))
        sent=query['sentElapsedSeconds'];received=sent+query['rpcMilliseconds']/1000
        delta_utc=(instant(query['receivedUTC'])-instant(run['startedUTC'])).total_seconds()-received
        timing_ok=math.isfinite(sent) and sent>=planned and 0<=query['rpcMilliseconds']<=15000
        flags={"requestSHAAndBytes":request_ok,"scheduledOffset":schedule_ok,"finiteReply":finite_tree(reply),
               "replyStructure":structure_ok,"timingWithinDriverDeadline":timing_ok}
        if not all(flags.values()): errors.append({"code":"query-check","index":i,"flags":flags})
        query_rows.append({"index":i,"kind":kind,"scheduledOffsetSeconds":planned,
                           "sentElapsedSeconds":sent,"estimatedReceivedElapsedSeconds":received,
                           "latenessSeconds":sent-planned,"rpcMilliseconds":query['rpcMilliseconds'],
                           "utcMinusMonotonicSeconds":delta_utc,"tokenCount":len(ids),
                           "hold":hold,"rankCount":len(ranks),"memory":reply.get('memory',{}),"flags":flags})
    valid=[s for s in samples if not s.get('missing')]
    missing=[{"index":i,"elapsedSeconds":s['elapsedSeconds'],"psExit":s.get('psExit')} for i,s in enumerate(samples) if s.get('missing')]
    elapsed=[s['elapsedSeconds'] for s in samples]
    monotonic=all(b>a for a,b in zip(elapsed,elapsed[1:]))
    cpu=[s['cumulativeCPUSeconds'] for s in valid]
    cpu_monotonic=all(b>=a for a,b in zip(cpu,cpu[1:]))
    differences=[b-a for a,b in zip(elapsed,elapsed[1:])]
    sampled_cpu=None
    if len(valid)>1:
        interval=valid[-1]['elapsedSeconds']-valid[0]['elapsedSeconds']
        seconds=valid[-1]['cumulativeCPUSeconds']-valid[0]['cumulativeCPUSeconds']
        sampled_cpu={"firstElapsedSeconds":valid[0]['elapsedSeconds'],"lastElapsedSeconds":valid[-1]['elapsedSeconds'],
                     "observedIntervalSeconds":interval,"roundedCumulativeCPUDeltaSeconds":seconds,
                     "oneCorePercentFromRoundedTIME":100*seconds/interval,
                     "excludesBeforeFirstAndAfterLastSample":True}
    native_time=None;time_text=''
    if (source/'TIME-R1.log').exists():
        time_text=(source/'TIME-R1.log').read_text(errors='replace')
        match=re.search(r'([\d.]+)\s+real\s+([\d.]+)\s+user\s+([\d.]+)\s+sys',time_text)
        rss=re.search(r'(\d+)\s+maximum resident set size',time_text)
        if match:
            real,user,system=map(float,match.groups())
            native_time={"realSeconds":real,"userSeconds":user,"sysSeconds":system,
                         "oneCorePercent":100*(user+system)/real,
                         "maximumResidentBytes":int(rss.group(1)) if rss else None,
                         "chargedFootprint":None,"driverOrPsIncluded":False,
                         "driverElapsedMinusNativeRealSeconds":summary['elapsedSeconds']-real if summary else None}
    ordinary=[q['scheduledOffsetSeconds'] for q in queries if q['kind']=='ordinary']
    long=[q['scheduledOffsetSeconds'] for q in queries if q['kind']=='long4000']
    planned_ordinary=list(range(0,cfg['scheduledDurationSeconds'],cfg['ordinaryIntervalSeconds']))
    counters_agree=None
    if summary:
        counters_agree=(summary['queryCount']==len(queries) and summary['ordinaryCount']==len(ordinary) and
                        summary['longCount']==len(long) and summary['sampleCount']==len(samples) and
                        summary['validSampleCount']==len(valid) and summary['freezeSHA256']==sha((source/'FREEZE-R1.json').read_bytes()))
    completion=bool(summary and summary['exitCode']==0 and summary['failure'] is None and
                    summary['elapsedSeconds']>=cfg['scheduledDurationSeconds'] and all(x['matched'] for x in source_pins) and
                    ordinary==planned_ordinary and long==cfg['longOffsetsSeconds'] and counters_agree and
                    native_time is not None and not errors)
    result={"auditUTC":datetime.datetime.now(datetime.timezone.utc).isoformat(),"interim":summary is None,
            "scope":"Saved files of native R5 CPU CLI; not UI, OS input, power or semantic quality",
            "rawFiles":raw_hashes,"sourcePins":source_pins,"run":run,
            "completionChecksSatisfied":completion,"summary":summary,"countersAgree":counters_agree,
            "queryCounts":{"ordinary":len(ordinary),"long4000":len(long),"total":len(queries)},
            "ordinaryOffsets":ordinary,"longOffsets":long,"queryRows":query_rows,
            "rpcMilliseconds":number_summary([r['rpcMilliseconds'] for r in query_rows]),
            "latenessSeconds":number_summary([r['latenessSeconds'] for r in query_rows]),
            "sampleCounts":{"total":len(samples),"valid":len(valid),"missing":len(missing),"ideal":600},
            "missingSamples":missing,"sampleTimeStrictlyIncreasing":monotonic,"sampleCPUMonotonic":cpu_monotonic,
            "sampleIntervalSeconds":number_summary(differences),
            "residentBytesFromPs":number_summary([s['residentBytes'] for s in valid]),
            "replyPhysicalFootprintBytes":number_summary([r['memory']['physicalFootprintBytes'] for r in query_rows if 'physicalFootprintBytes' in r['memory']]),
            "replyResidentBytes":number_summary([r['memory']['residentBytes'] for r in query_rows if 'residentBytes' in r['memory']]),
            "roundedSampledCPU":sampled_cpu,"nativeTimeL":native_time,"errors":errors,
            "priorReviewCountsAdded":False,"freshModelCalls":0,"additionalProcessSamples":0}
    destination.parent.mkdir(exist_ok=True,parents=True)
    destination.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({"output":str(destination.relative_to(ROOT)),"interim":result['interim'],
                      "completion":completion,"queryCounts":result['queryCounts'],"sampleCounts":result['sampleCounts'],
                      "errors":errors,"sha256":sha(destination.read_bytes())},ensure_ascii=False))

if __name__=='__main__':
    main()
