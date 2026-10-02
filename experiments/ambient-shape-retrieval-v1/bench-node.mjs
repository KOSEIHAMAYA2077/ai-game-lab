import fs from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
const here=import.meta.dirname,gc=()=>{globalThis.gc?.();globalThis.gc?.();},mem=()=>{gc();return process.memoryUsage();};
const before=mem(),t0=performance.now();await import('./retriever.js');const afterCode=mem(),raw=fs.readFileSync(path.join(here,'weights-r1.json'),'utf8'),parseStart=performance.now(),weights=JSON.parse(raw),parseMs=performance.now()-parseStart,createStart=performance.now(),r=globalThis.AmbientShapeRetrieval.createRetriever(weights),createMs=performance.now()-createStart,initialMs=performance.now()-t0,afterInit=mem();
const dev=JSON.parse(fs.readFileSync(path.join(here,'DEV.json'),'utf8')).rows.map(x=>x.text);
for(let i=0;i<200;i++)r.predict(dev[i%dev.length]);
const latencies=[],checksums={accepted:0,rankings:0};
for(let repeat=0;repeat<10;repeat++)for(const text of dev){const t=performance.now(),p=r.predict(text);latencies.push(performance.now()-t);checksums.accepted+=p.accepted;checksums.rankings+=p.ranking.length;}
const worst=[{name:'ja512',text:'文章を整理して記録を続ける'.repeat(80).slice(0,512)},{name:'en512',text:'ordinary task documentation review writing schedule '.repeat(30).slice(0,512)},{name:'alias512',text:'bird fish tree flower star cube snake shell '.repeat(20).slice(0,512)}];
const stats=a=>{const s=[...a].sort((a,b)=>a-b);return{n:s.length,p50:s[Math.floor((s.length-1)*.5)],p95:s[Math.floor((s.length-1)*.95)],p99:s[Math.floor((s.length-1)*.99)],max:s.at(-1),mean:s.reduce((a,b)=>a+b,0)/s.length};};
const worstResults=worst.map(x=>{const a=[];for(let i=0;i<100;i++){const t=performance.now();r.predict(x.text);a.push(performance.now()-t);}return{name:x.name,UTF16:x.text.length,latencyMs:stats(a)};});
const afterQueries=mem(),result={schema:1,node:process.version,platform:process.platform,arch:process.arch,GCRequested:Boolean(globalThis.gc),serializedWeightBytes:Buffer.byteLength(raw),memory:{before,afterCode,afterInit,afterQueries,initHeapDeltaBytes:afterInit.heapUsed-before.heapUsed,initRSSDeltaBytes:afterInit.rss-before.rss,maxRSSKiB:process.resourceUsage().maxRSS},timing:{initialMs,parseMs,createMs,warmCalls:200,dev:stats(latencies),worst:worstResults},checksums,limitations:'Single Mac process; explicit GC and no Oxc/baseline. RSS is whole candidate process, not app/widget or 16GB Windows. Timing excludes external I/O/bridge/GPU/input, not a hard realtime guarantee.'};
fs.writeFileSync(path.join(here,'CPU-NODE-R1.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({weight:result.serializedWeightBytes,initHeap:result.memory.initHeapDeltaBytes,initRSS:result.memory.initRSSDeltaBytes,maxRSSKiB:result.memory.maxRSSKiB,dev:result.timing.dev,worst:worstResults}));
