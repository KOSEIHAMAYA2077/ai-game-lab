import json,subprocess,time,hashlib,sys
from pathlib import Path
H=Path(__file__).resolve().parent;ROOT=H.parents[1]
case_source=ROOT/'experiments/static-japanese-retrieval-v1/calibration.json'
texts=[r['text'] for r in json.loads(case_source.read_text())['rows']]
stderr_path=H/'LEAN-R4.time.log';stderr=stderr_path.open('x');start=time.perf_counter()
process=subprocess.Popen(['/usr/bin/time','-l',str(H/'native-static-r4')],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=stderr,text=True,bufsize=1)
latency=[];roundtrip=[];memories={};holds={};checksum=0
def query(text,registry='shape'):
 global checksum
 t=time.perf_counter();process.stdin.write(json.dumps({'text':text,'registry':registry},ensure_ascii=True)+'\n');process.stdin.flush();line=process.stdout.readline()
 if not line:raise RuntimeError('native EOF '+str(process.poll()))
 elapsed=(time.perf_counter()-t)*1000;r=json.loads(line);checksum+=len(r['ranks']);return r,elapsed
first,firstRound=query(texts[0]);coldReady=(time.perf_counter()-start)*1000;memories['firstResponse']=first['memory']
for i in range(200):r,rt=query(texts[i%len(texts)])
memories['afterWarm200']=r['memory']
for repeat in range(10):
 for text in texts:
  r,rt=query(text);latency.append(r['elapsedMs']);roundtrip.append(rt);reason=r['encoding'].get('hold') or 'vector';holds[reason]=holds.get(reason,0)+1
memories['afterTimed1120']=r['memory']
def stats(values):
 s=sorted(values);return {'n':len(s),'p50Ms':s[int((len(s)-1)*.5)],'p95Ms':s[int((len(s)-1)*.95)],'p99Ms':s[int((len(s)-1)*.99)],'maxMs':max(s),'meanMs':sum(s)/len(s)}
worst=[]
for name,text in [('ja4000','あ'*4000),('ascii4000','a'*4000),('emoji4000','😀'*4000)]:
 a=[]
 for i in range(20):r,rt=query(text);a.append(r['elapsedMs'])
 worst.append({'name':name,'scalars':len(text),'UTF16Units':len(text.encode('utf-16-le'))//2,'tokens':len(r['encoding']['tokens'].get('ids') or []),'hold':r['encoding'].get('hold'),'latency':stats(a),'memory':r['memory']})
memories['afterWorst']=r['memory'];limit,rt=query('a'*4001);assert limit['encoding']['hold']=='input_limit'
process.stdin.close();process.stdout.close();exit_code=process.wait();stderr.close();assert exit_code==0
time_text=stderr_path.read_text();peakLine=next(line for line in time_text.splitlines() if 'maximum resident set size' in line);peak=int(peakLine.split()[0])
result={'schema':1,'sourceVersion':'R4','sourceSHA256':hashlib.sha256((H/'NativeStaticR4.swift').read_bytes()).hexdigest(),'binarySHA256':hashlib.sha256((H/'native-static-r4').read_bytes()).hexdigest(),'methodSHA256':hashlib.sha256((H/'METHOD-LEAN-CPU-R4.md').read_bytes()).hexdigest(),'inputSourceSHA256':hashlib.sha256(case_source.read_bytes()).hexdigest(),'normalTimedCalls':len(latency),'warmCalls':200,'coldFirstQueryInnerMs':first['elapsedMs'],'coldProcessToFirstResponseMs':coldReady,'coldFirstRoundtripMs':firstRound,'latency':stats(latency),'driverRoundtrip':stats(roundtrip),'worst':worst,'memory':memories,'timeExitPeakResidentBytes':peak,'exitCode':exit_code,'checksumRankItems':checksum,'holdCounts':holds,'tableMappedFileBytes':8388608,'captionIndexPayloadBytes':343*128*4,'limit4001Held':True,'limits':'Mac optimized Swift CLI only; driver is not runtime, no UI/GPU/OS capture. JSONL I/O/serialization/startup excluded from inner query latency. Short batch, not long-term/16GBWindows/wholewidget/energy evidence.'}
with (H/'LEAN-CPU-R4.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({k:result[k] for k in ['coldFirstQueryInnerMs','coldProcessToFirstResponseMs','latency','memory','timeExitPeakResidentBytes','worst']}))
