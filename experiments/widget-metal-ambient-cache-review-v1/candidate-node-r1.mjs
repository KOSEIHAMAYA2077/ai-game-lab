import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const read=p=>fs.readFileSync(path.resolve(root,p));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const freeze=JSON.parse(fs.readFileSync(path.join(here,'FREEZE-R1.json')));
for(const row of freeze.readOnlyInputs)if(sha(read(row.path))!==row.sha256)throw Error('read-only drift '+row.path);
const bundlePath='experiments/widget-metal-ambient-cache-v1/work/GlyphMatter-Ambient-Cache-R1.app/Contents/Resources/Receiver.js';
const context=vm.createContext({Intl,console});vm.runInContext(read(bundlePath).toString(),context);
const api=context.AmbientCacheReceiver;if(!api?.createSession)throw Error('candidate public API missing');
const fixture=JSON.parse(fs.readFileSync(path.join(here,'CASES-R1.json'))),runs=[];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
for(const row of fixture.sessions){
 let serial=0,session=api.createSession(row.id+"-0"),units=[],glyphs=[],traces=[],failures=[],wireBytes=0,transferUnits=0,transferUTF16=0;
 const check=(a,b,label)=>{if(!same(a,b))failures.push({label,actual:a,expected:b});};
 let view;
 try{
  for(let i=0;i<row.steps.length;i++){
   const step=row.steps[i];
   if(step.op==='reset-review-session'){session.destroy();serial++;session=api.createSession(row.id+"-"+serial);units=[];glyphs=[];traces.push({step:i,reset:true});continue;}
   const {projectionTime,...command}=step,metaJSON=session.executeMetaJSON(JSON.stringify(command)),m=JSON.parse(metaJSON);let bodyJSON='',added=[];
   if(m.bodyCount>units.length){bodyJSON=session.readBodyDeltaJSON(JSON.stringify({cacheVersion:m.cacheVersion,receiverSession:m.receiverSession,materialGeneration:m.materialGeneration,afterId:units.length}));const d=JSON.parse(bodyJSON);added=d.units;check(d.afterId,units.length,'range:'+i);units.push(...added);}
   view={aggregate:m.aggregate,units:units.map(u=>({...u})),presentedCount:m.presentedCount,shape:m.shape};
   wireBytes+=Buffer.byteLength(metaJSON)+Buffer.byteLength(bodyJSON);transferUnits+=added.length;transferUTF16+=added.reduce((n,u)=>n+u.text.length,0);
   check(view.units.length,view.aggregate.bodyCount,'count:'+i);check(view.presentedCount>=glyphs.length&&view.presentedCount<=view.units.length,true,'presented-bound:'+i);
   for(let j=0;j<view.units.length;j++){
    const unit=view.units[j];check(unit.id,j+1,'id:'+i+':'+j);
    if(j<glyphs.length){check(unit.text,glyphs[j].text,'literal:'+i+':'+j);check(unit.ink,glyphs[j].ink,'ink:'+i+':'+j);}
   }
   for(let j=glyphs.length;j<view.presentedCount;j++)glyphs.push({...view.units[j],born:projectionTime});
   const observed={bodyCount:view.aggregate.bodyCount,presentedCount:view.presentedCount,shape:view.shape,status:view.aggregate.status,reason:view.aggregate.reason,unitTexts:view.units.map(u=>u.text)};
   for(const point of row.checkpoints.filter(c=>c.step===i))for(const [k,v]of Object.entries(point))if(k!=='step')check(observed[k],v,'checkpoint:'+i+':'+k);
   traces.push({step:i,view,projectionTime,glyphs:glyphs.map(g=>({...g})),wireBytes:Buffer.byteLength(metaJSON)+Buffer.byteLength(bodyJSON),metadataBytes:Buffer.byteLength(metaJSON),bodyBytes:Buffer.byteLength(bodyJSON),deltaIDs:added.map(u=>u.id)});
  }
  const actual={unitTexts:view.units.map(u=>u.text),ids:view.units.map(u=>u.id),inks:view.units.map(u=>u.ink),bodyCount:view.aggregate.bodyCount,presentedCount:view.presentedCount,shape:view.shape,born:glyphs.map(g=>g.born)};
  for(const [key,value]of Object.entries(row.expectedFinal))check(actual[key],value,'final:'+key);
  const off=JSON.parse(session.offExportJSON());
  function forbiddenKeys(v){if(!v||typeof v!=='object')return false;return Object.entries(v).some(([k,x])=>['text','ids','id','body','units','glyphs','document','preview'].includes(k)||forbiddenKeys(x));}
  check(off.savingOff,true,'off-saving');check(forbiddenKeys(off),false,'off-no-material');
  runs.push({id:row.id,passed:failures.length===0,failures,actual,traces,offExport:off,wireBytes,transferUnits,transferUTF16});
 }catch(error){runs.push({id:row.id,passed:false,failures:[...failures,{label:'exception',message:error.message}],traces});}
 session.destroy();
}
const result={version:'independent-candidate-cache-node-r1',engine:process.version,bundlePath,bundleSHA256:sha(read(bundlePath)),fixtureSHA256:sha(fs.readFileSync(path.join(here,'CASES-R1.json'))),cases:runs.length,passed:runs.filter(r=>r.passed).length,runs,candidateCalls:runs.reduce((n,r)=>n+r.traces.filter(t=>!t.reset).length,0),scope:'Candidate immutable pure JS bundle public metadata/delta APIs, fixed independent12 sessions; no native app/UI/GPU/OS/model or whole-widget resource claims.'};
fs.writeFileSync(path.join(here,'CANDIDATE-NODE-R1.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:result.cases,passed:result.passed,failures:runs.filter(r=>!r.passed).map(r=>({id:r.id,failures:r.failures}))}));
