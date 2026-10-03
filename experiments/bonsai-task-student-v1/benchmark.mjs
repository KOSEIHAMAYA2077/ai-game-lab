import {readFileSync} from 'node:fs';
import {loadModel,predict} from '../../prototypes/glyph-creature/src/task-student-v1/inference.mjs';
const kind=process.argv[2]??'student';
const started=performance.now(), raw=readFileSync(new URL('./artifacts/'+kind+'-model.json',import.meta.url),'utf8');
const model=loadModel(JSON.parse(raw)), loadMs=performance.now()-started;
const texts=['花瓶','全体を細くして縦に伸ばした立方体','海の中をふわふわ漂う、傘の下に触手が垂れた生き物','今日は作業を進めた','あ'.repeat(512)];
for(let i=0;i<50;i++)predict(model,texts[i%texts.length]);
const results=[];
for(const text of texts) {
  const samples=[];let last;
  for(let i=0;i<300;i++) {last=predict(model,text);samples.push(last.modelMs);}
  samples.sort((a,b)=>a-b);
  results.push({characters:Array.from(text).length,label:text.length>100?'512-character-boundary':text,shape:last.shape,p50Ms:samples[150],p95Ms:samples[284],maxMs:samples[299]});
}
console.log(JSON.stringify({kind,modelBytes:Buffer.byteLength(raw),loadMs,decodedWeightBytes:Object.values(model.heads).reduce((s,h)=>s+h.weights.byteLength+h.known.byteLength,0),rssNowBytes:process.memoryUsage().rss,rssMaxKiB:process.resourceUsage().maxRSS,host:{platform:process.platform,arch:process.arch,node:process.version},results,scope:'Single Node CPU process. Load excludes download. p50/p95 exclude model parsing/loading and drawing; 512-character input included. Not the full widget or general laptop validation.'},null,2));
