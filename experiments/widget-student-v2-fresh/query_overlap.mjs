// Audit the primitive queries reconstructed from frozen explicit noun aliases.
// Verify every query's scores exactly reproduce the stored raw candidate list.
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const dir=dirname(fileURLToPath(import.meta.url)),repo=resolve(dir,'../..');
const raw=JSON.parse(await readFile(resolve(dir,'raw-predictions.json'),'utf8'));
const corpus=JSON.parse(await readFile(resolve(repo,'experiments/widget-student-v1/artificial-corpus.json'),'utf8'));
const source=await readFile(resolve(repo,'prototypes/glyph-creature/src/widget-student.ts'),'utf8');
const aliases=JSON.parse(source.match(/const aliases = (\[[^;]+\]);/u)[1].replaceAll("'",'"'));
const norm=t=>t.normalize('NFKC').toLowerCase().replace(/\s+/gu,' ').trim();
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&');
const aliasPattern=s=>/^[a-z]+$/u.test(s)?`(?<![a-z])${escape(s)}(?![a-z])`:s.length===1?`(?<![\u3400-\u9fff])${escape(s)}(?![\u3400-\u9fff])`:escape(s);
const spans=text=>{const all=aliases.flatMap(a=>[...text.matchAll(new RegExp(aliasPattern(a),'gu'))].map(m=>({start:m.index,end:m.index+m[0].length,text:m[0]}))).sort((a,b)=>a.start-b.start||b.end-a.end),chosen=[];for(const s of all)if(!chosen.some(o=>s.start<o.end&&s.end>o.start))chosen.push(s);return chosen;};
const withoutColor=t=>t.replace(/赤(?:色)?(?:い|の)?|白(?:色)?(?:い|の)?|黒(?:色)?(?:い|の)?|黄(?:色)?(?:い|の)?|青(?:色)?(?:い|の)?|緑(?:色)?(?:い|の)?|紫(?:色)?(?:い|の)?|ピンク|橙(?:色)?(?:い|の)?|\b(?:red|white|black|yellow|blue|green|purple|pink|orange)\b/gu,'').replace(/\s+/gu,' ').trim();
const train=new Set(corpus.filter(c=>c.split==='train'&&c.head==='primitive').map(c=>norm(c.text))),dev=new Set(corpus.filter(c=>c.split==='dev'&&c.head==='primitive').map(c=>norm(c.text)));
const {widgetStudentScores}=await import(pathToFileURL(resolve(dir,'runtime/widget-student.mjs')));
const audit=[];
for(const c of raw){
 const text=norm(c.text),ss=spans(text),targets=ss.length?ss.map(s=>s.text):[withoutColor(text)];
 const per={};
 for(const name of ['v1','guard_v2']){
 const cs=c.results[name].prediction.primitiveCandidates??[];
 per[name]=cs.map((cand,i)=>{const q=targets[i],match=JSON.stringify(cand)===JSON.stringify(widgetStudentScores(q,'primitive'));if(!match)throw Error('Reconstruction mismatch '+c.id+' '+name);return {query:q,trainExactNormalized:train.has(norm(q)),devExactNormalized:dev.has(norm(q)),scoresExactlyMatched:true};});
 }
 audit.push({id:c.id,text:c.text,queries:per});
}
const summary={method:'Reconstruct frozen alias spans, or whole phrase when no alias; public scoring API output must exactly equal every stored candidate array. Primitive only; no claim about relation query overlap.',byPipeline:Object.fromEntries(['v1','guard_v2'].map(name=>{const qs=audit.flatMap(r=>r.queries[name]);return [name,{queryCalls:qs.length,trainExactNormalized:qs.filter(q=>q.trainExactNormalized).length,devExactNormalized:qs.filter(q=>q.devExactNormalized).length,casesWithAtLeastOneTrainQueryOverlap:audit.filter(r=>r.queries[name].some(q=>q.trainExactNormalized)).length}]})),cases:audit};
await writeFile(resolve(dir,'primitive-query-overlap.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary.byPipeline,null,2));
