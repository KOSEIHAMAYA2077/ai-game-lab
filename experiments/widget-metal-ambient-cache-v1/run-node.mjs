import { readFile,writeFile,mkdir,access } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { createContext,runInContext } from 'node:vm';
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../..'),out=resolve(here,'results-node-r1');
try{await access(out);throw new Error('preserve outputs');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(out);
const {createSession,TEST_SESSIONS}=await import(pathToFileURL(resolve(repo,'desktop/glyph-metal-ambient-cache-v1/Sources/receiver-policy.mjs')).href);
const {evaluateCore}=await import(pathToFileURL(resolve(repo,'desktop/glyph-metal-ambient-cache-v1/Tests/core-replay.mjs')).href);
const fixture=JSON.parse(await readFile(resolve(here,'fixtures/native14-r1.json'),'utf8'));
const oldContext=createContext({});runInContext(await readFile(resolve(repo,'experiments/widget-metal-ambient-v1/work/GlyphMatter-Ambient-ProducerR2-BridgeR2-BuildR5.app/Contents/Resources/Receiver.js'),'utf8'),oldContext);
const nativeRuns=[];
for(const f of fixture.cases){
 let cached=createSession(f.id),old=runInContext('AmbientNativeReceiver.createSession()',oldContext),session=f.id,known=0,bodyCalls=0,throws=0,doc='',traces=[],failures=[];
 const execute=c=>{
  const oldView=JSON.parse(old.executeJSON(JSON.stringify(c))),meta=JSON.parse(cached.executeMetaJSON(JSON.stringify(c)));
  const delta=meta.bodyCount>known?JSON.parse(cached.readBodyDeltaJSON(JSON.stringify({cacheVersion:meta.cacheVersion,receiverSession:session,materialGeneration:meta.materialGeneration,afterId:known}))):null;
  if(delta)bodyCalls++;
  const {state}=TEST_SESSIONS.get(cached);
  const exact=JSON.stringify(oldView.units)===JSON.stringify(state.material.body)&&oldView.presentedCount===meta.presentedCount&&oldView.shape===meta.shape;
  if(!exact)failures.push('old-core-body-parity');known=meta.bodyCount;
  traces.push({command:c,metadata:meta,delta,oldView});
  doc=state.canonical.document?.text??'';
 };
 for(const original of f.commands){
  if(original.op==='reset-session'){old.destroy();cached.destroy();session=original.session;cached=createSession(session);old=runInContext('AmbientNativeReceiver.createSession()',oldContext);known=0;bodyCalls=0;doc='';continue;}
  if(original.op==='unsupported-command'){
   let a=false,b=false;try{old.executeJSON(JSON.stringify(original.original));}catch{a=true;}try{cached.executeMetaJSON(JSON.stringify(original.original));}catch{b=true;}
   if(!a||!b)failures.push('unsupported-command-rejected');throws++;continue;
  }
  if(original.op==='idle-ticks'){for(let i=1;i<=original.count;i++)execute({op:'advance',at:original.at+i*original.step});continue;}
  let c=original;
  if(c.op==='commit-repeat'||c.op==='commit-after-current'){const text=c.op==='commit-repeat'?c.text.repeat(c.count):c.text;c={op:'commit',at:c.at,base:doc,value:doc+text,text,range:[doc.length,0]};}
  execute(c);
 }
 const state=TEST_SESSIONS.get(cached).state,body=state.material.body;
 const actual={body:body.map(x=>x.text).join(''),unitCount:body.length,inks:body.map(x=>x.ink),unitTexts:body.map(x=>x.text),shape:state.shape.current,document:state.canonical.document?.text??'',presented:state.material.presented,
  bodyCalls,bodyCallsPerFinalSession:bodyCalls,throws,lastHold:state.history.admissions.filter(x=>x.added===0).at(-1)?.reason??null,idleBodyTransfers:0};
 for(const [k,v]of Object.entries(f.expected))if(JSON.stringify(actual[k])!==JSON.stringify(v))failures.push({key:k,actual:actual[k],expected:v});
 nativeRuns.push({id:f.id,passed:failures.length===0,failures,actual,traces});
}
const core=evaluateCore(JSON.parse(await readFile(resolve(here,'fixtures/core3-r1.json'),'utf8')));
await writeFile(resolve(out,'native14.json'),JSON.stringify({passed:nativeRuns.filter(x=>x.passed).length,runs:nativeRuns},null,2)+'\n',{flag:'wx'});
await writeFile(resolve(out,'core3.json'),JSON.stringify(core,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({native14Passed:nativeRuns.filter(x=>x.passed).length,core3Passed:core.passed,failures:nativeRuns.filter(x=>!x.passed).map(x=>({id:x.id,failures:x.failures}))}));
if(nativeRuns.some(x=>!x.passed)||core.passed!==3)process.exitCode=1;
