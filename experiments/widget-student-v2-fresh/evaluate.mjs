// No training, threshold changes, fallback rescue, or external requests.
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
const dir=dirname(fileURLToPath(import.meta.url)),repo=resolve(dir,'../..');
const bytes=await readFile(resolve(dir,'fixture.frozen.json')),fixture=JSON.parse(bytes),cases=fixture.cases;
const sha=createHash('sha256').update(bytes).digest('hex');
if(sha!=='df7105b2f8bd134944ca2029fcd215eed987bc3164d5e06cd32bc49fa3409f45')throw Error('Fixture changed');
execFileSync('python3',[resolve(repo,'experiments/widget-student-guard-v2/verify_freeze.py')]);
const {widgetStudentResolution,widgetStudentScores,inspectWidgetStudent}=await import(pathToFileURL(resolve(dir,'runtime/widget-student.mjs')));
const {widgetStudentGuardV2Resolution}=await import(pathToFileURL(resolve(dir,'runtime/widget-student-guard-v2.mjs')));
const {ruleProgramResolution}=await import(pathToFileURL(resolve(dir,'runtime/program-rules.mjs')));
const {validateProgram,compileScaffoldProgram,programPartSurface}=await import(pathToFileURL(resolve(dir,'runtime/scaffold-program.mjs')));
const pipelines={v1:widgetStudentResolution,guard_v2:widgetStudentGuardV2Resolution,rules:ruleProgramResolution};
const corpus=JSON.parse(await readFile(resolve(repo,'experiments/widget-student-v1/artificial-corpus.json'),'utf8'));
const norm=t=>t.normalize('NFKC').toLowerCase().replace(/\s+/gu,' ').trim();
const train=corpus.filter(x=>x.split==='train'),dev=corpus.filter(x=>x.split==='dev');
const textSet=rs=>new Set(rs.map(x=>x.text)),normSet=rs=>new Set(rs.map(x=>norm(x.text)));
const trainExact=textSet(train),trainNorm=normSet(train),devExact=textSet(dev),devNorm=normSet(dev);
const shapeMap={sphere:'sphere',box:'box',cylinder:'tube',torus:'ring',blade:'blade',vase:'vase'};
function representable(c){return c.expected.action==='render'&&(!c.expected.relation||['above','below'].includes(c.expected.relation.predicate));}
function attributesCorrect(part,attrs){
 const checks={size:v=>['height','width','depth'].every(k=>v==='small'?part[k]<=.8:part[k]>=1.2),height:v=>v==='tall'?part.height>=1.5:part.height<=.8,length:v=>v==='long'?part.height>=1.5:part.height<=.8,width:v=>v==='wide'?part.width>=1.2:part.width<=.7,depth:v=>part.depth<=.8,thickness:v=>v==='thick'?part.depth>=1.2:part.depth<=.8};
 return Object.entries(attrs).map(([key,value])=>({key,expected:value,correct:checks[key]?.(value)??false,actual:{height:part.height,width:part.width,depth:part.depth}}));
}
function meaning(c,p){
 if(c.expected.action==='hold')return {structureCorrect:!p,strictCorrect:!p,attributeChecks:[]};
 if(!p)return {structureCorrect:false,strictCorrect:false,attributeChecks:[],issue:'held-positive'};
 const ep=c.expected.parts;if(p.parts.length!==ep.length)return {structureCorrect:false,strictCorrect:false,attributeChecks:[],issue:'part-count'};
 let mapping;
 if(ep.length===1){mapping=[ep[0]];if(p.relation)return {structureCorrect:false,strictCorrect:false,attributeChecks:[],issue:'unexpected-relation'};}
 else {
  const r=c.expected.relation;
  if(!['above','below'].includes(r.predicate))return {structureCorrect:false,strictCorrect:false,attributeChecks:[],issue:'unrepresentable-relation-activated'};
  const childId=r.predicate==='above'?r.subject:r.object,parentId=r.predicate==='above'?r.object:r.subject;
  if(p.relation?.kind!=='above'||p.relation.parent!==p.parts[0].id||p.relation.child!==p.parts[1].id)return {structureCorrect:false,strictCorrect:false,attributeChecks:[],issue:'relation-kind'};
  mapping=[ep.find(x=>x.id===parentId),ep.find(x=>x.id===childId)];
 }
 const structureCorrect=p.parts.every((part,i)=>part.primitive===shapeMap[mapping[i].shape]);
 const attributeChecks=p.parts.flatMap((part,i)=>attributesCorrect(part,mapping[i].attributes).map(check=>({...check,partIndex:i})));
 return {structureCorrect,strictCorrect:structureCorrect&&attributeChecks.every(x=>x.correct),attributeChecks,...(!structureCorrect?{issue:'shape-or-direction'}:{})};
}
function geometry(p){
 if(!p)return {checked:false};
 let t=performance.now();const validated=validateProgram(p),schemaMs=performance.now()-t;
 t=performance.now();const compiled=compileScaffoldProgram(p),compileMs=performance.now()-t;
 if(!compiled)return {checked:true,schemaPass:!!validated,compilerPass:false,finiteSurfacePass:false,schemaMs,compileMs,sampledPoints:0};
 let sampledPoints=0,finite=true;const times=[0,10,100],seeds=[1,17,64];t=performance.now();
 for(let index=0;index<compiled.parts.length;index++)for(const time of times)for(const seed of seeds)for(let id=0;id<64;id++){
  const du=[0,0,0],dv=[0,0,0],point=programPartSurface(compiled,index,id,time,seed,[0,0,0],du,dv);sampledPoints++;
  if(![...point,...du,...dv].every(Number.isFinite))finite=false;
 }
 return {checked:true,schemaPass:!!validated,compilerPass:true,finiteSurfacePass:finite,schemaMs,compileMs,surfaceSampleMs:performance.now()-t,sampledPoints,times,seeds,adjustments:compiled.adjustments,throughCheck:compiled.throughCheck??null,bounds:compiled.bounds,compiledSource:compiled.spec};
}
const raw=[],scored=[];
for(const c of cases){
 const overlap={trainExact:trainExact.has(c.text),trainNormalized:trainNorm.has(norm(c.text)),devExact:devExact.has(c.text),devNormalized:devNorm.has(norm(c.text))};
 const results={};
 for(const [name,fn]of Object.entries(pipelines)){
  const started=performance.now();let prediction,error;
  try{prediction=fn(c.text);}catch(e){error=String(e);prediction={program:null,reason:'runtime-error'};}
  const wallMs=performance.now()-started;
  const semantic=meaning(c,prediction.program),checks=geometry(prediction.program);
  results[name]={prediction,wallMs,...(error?{error}:{}),semantic,geometry:checks};
 }
 raw.push({id:c.id,text:c.text,language:c.language,stratum:c.stratum,expected:c.expected,tags:c.tags,schemaRepresentable:representable(c),overlap,results});
 scored.push(raw.at(-1));
}
function metrics(rows,name){
 const positive=rows.filter(c=>c.expected.action==='render'),hold=rows.filter(c=>c.stratum==='hold'),amb=rows.filter(c=>c.stratum==='ambiguous'),supported=positive.filter(c=>c.schemaRepresentable),unsupported=positive.filter(c=>!c.schemaRepresentable),accepted=rows.filter(c=>c.results[name].prediction.program);
 const count=(rs,fn)=>rs.filter(fn).length,good=c=>c.results[name].semantic.strictCorrect,structure=c=>c.results[name].semantic.structureCorrect,active=c=>!!c.results[name].prediction.program;
 const attr=positive.flatMap(c=>c.results[name].semantic.attributeChecks);
 return {count:rows.length,strictCorrect:count(rows,good),structureCorrect:count(rows,structure),accepted:accepted.length,meaningful:{count:positive.length,accepted:count(positive,active),structureCorrect:count(positive,structure),strictCorrect:count(positive,good)},schemaRepresentable:{count:supported.length,accepted:count(supported,active),structureCorrect:count(supported,structure),strictCorrect:count(supported,good)},unrepresentable:{count:unsupported.length,accepted:count(unsupported,active),appropriatelyHeld:count(unsupported,c=>!active(c))},clearHold:{count:hold.length,correct:count(hold,good),falseActivations:count(hold,active)},ambiguous:{count:amb.length,correct:count(amb,good),falseActivations:count(amb,active)},attributeChecksOnReturnedCorrectlySizedPrograms:{count:attr.length,passed:attr.filter(x=>x.correct).length},geometry:{accepted:accepted.length,schemaPass:count(accepted,c=>c.results[name].geometry.schemaPass),compilerPass:count(accepted,c=>c.results[name].geometry.compilerPass),finiteSurfacePass:count(accepted,c=>c.results[name].geometry.finiteSurfacePass),strictSemanticRenderAndCompilerPass:count(positive,c=>good(c)&&c.results[name].geometry.compilerPass)},reasons:Object.fromEntries([...new Set(rows.map(c=>c.results[name].prediction.reason))].map(r=>[r,count(rows,c=>c.results[name].prediction.reason===r)]))};
}
function contribution(name){
 const rows=raw,accepted=rows.filter(c=>c.results[name].prediction.program),kinds={};
 for(const c of rows)for(const e of c.results[name].prediction.evidence??[]){kinds[e.kind]??={cases:new Set(),acceptedCases:new Set()};kinds[e.kind].cases.add(c.id);if(c.results[name].prediction.program)kinds[e.kind].acceptedCases.add(c.id);}
 const learnedRows=rows.filter(c=>(c.results[name].prediction.primitiveCandidates??[]).length);
 const rawCompletePrimitive=raw.filter(c=>c.expected.action==='render'&&(c.results[name].prediction.primitiveCandidates??[]).length===c.expected.parts.length);
 const primitiveRawInventoryCorrect=rawCompletePrimitive.filter(c=>JSON.stringify(c.results[name].prediction.primitiveCandidates.map(cs=>cs[0].label).sort())===JSON.stringify(c.expected.parts.map(p=>shapeMap[p.shape]).sort()));
 return {accepted:accepted.length,casesReachingPrimitiveClassifier:learnedRows.length,completePrimitiveInventoryHeadsAvailable:rawCompletePrimitive.length,rawTop1PrimitiveInventoryCorrect:primitiveRawInventoryCorrect.length,evidenceKinds:Object.fromEntries(Object.entries(kinds).map(([k,v])=>[k,{cases:v.cases.size,acceptedCases:v.acceptedCases.size}])),note:'Primitive inventory ignores relation direction and attributes. Guard classifierMs is the complete v1 pipeline, not a pure learned-head measurement; evidenceKinds are exposure counts, not causal ablations.'};
}
const summary={createdAtUtc:new Date().toISOString(),fixtureHash:sha,cases:cases.length,environment:{node:process.version,platform:process.platform,arch:process.arch},overlap:{trainExact:raw.filter(x=>x.overlap.trainExact).map(x=>x.id),trainNormalized:raw.filter(x=>x.overlap.trainNormalized).map(x=>x.id),devExact:raw.filter(x=>x.overlap.devExact).map(x=>x.id),devNormalized:raw.filter(x=>x.overlap.devNormalized).map(x=>x.id),trainRows:train.length,devRows:dev.length},full:Object.fromEntries(Object.keys(pipelines).map(n=>[n,metrics(raw,n)])),withoutExactTrainOverlap:Object.fromEntries(Object.keys(pipelines).map(n=>[n,metrics(raw.filter(c=>!c.overlap.trainNormalized),n)])),byLanguage:Object.fromEntries(['ja','en'].map(l=>[l,Object.fromEntries(Object.keys(pipelines).map(n=>[n,metrics(raw.filter(c=>c.language===l),n)]))])),byHoldReason:Object.fromEntries([...new Set(raw.filter(c=>c.expected.action==='hold').map(c=>c.expected.reason))].map(r=>[r,Object.fromEntries(Object.keys(pipelines).map(n=>[n,metrics(raw.filter(c=>c.expected.reason===r),n)]))])),contributions:Object.fromEntries(Object.keys(pipelines).map(n=>[n,contribution(n)])),model:inspectWidgetStudent()};
const transition=[];
for(const c of raw){const a=c.results.v1,b=c.results.guard_v2;if(JSON.stringify(a.prediction.program)!==JSON.stringify(b.prediction.program)||a.semantic.strictCorrect!==b.semantic.strictCorrect)transition.push({id:c.id,text:c.text,stratum:c.stratum,v1Program:a.prediction.program,guardV2Program:b.prediction.program,v1Correct:a.semantic.strictCorrect,guardV2Correct:b.semantic.strictCorrect,guardV2Reason:b.prediction.reason,guardV2Evidence:b.prediction.evidence});}
summary.v1ToGuardV2={changedCases:transition.length,improved:transition.filter(c=>!c.v1Correct&&c.guardV2Correct).length,regressed:transition.filter(c=>c.v1Correct&&!c.guardV2Correct).length,details:transition};
const percentiles=values=>{const vs=[...values].sort((a,b)=>a-b);return {count:vs.length,medianMs:vs[Math.floor(vs.length*.5)],p95Ms:vs[Math.floor(vs.length*.95)],maxMs:vs.at(-1)};};
const timing={scope:'Node interpreter only. Complete resolution includes authored rules, and guard_v2 includes compilation. No rendering, animation absorption, UI, native-widget footprint or network.',warm:{},coldProcesses:{},scores:{},decode:{}};
for(const [name,fn]of Object.entries(pipelines)){
 const walls=[],classifiers=[],guards=[];
 for(let rep=0;rep<10;rep++)for(const c of cases){const t=performance.now(),r=fn(c.text);walls.push(performance.now()-t);if(r.classifierMs!==undefined)classifiers.push(r.classifierMs);if(r.guardMs!==undefined)guards.push(r.guardMs);}
 timing.warm[name]={wall:percentiles(walls),...(classifiers.length?{classifier:percentiles(classifiers),guard:percentiles(guards)}:{})};
 timing.coldProcesses[name]=[0,1,2].map(()=>JSON.parse(execFileSync(process.execPath,[resolve(dir,'cold_probe.mjs'),name],{encoding:'utf8'})));
}
for(const head of ['primitive','relation']){const values=[];for(let rep=0;rep<5;rep++)for(const c of cases){const t=performance.now();widgetStudentScores(c.text,head);values.push(performance.now()-t);}timing.scores[head]={...percentiles(values),note:'Full raw sentences sent directly to public score API, a cost probe rather than the actual noun/masked queries used by the pipeline.'};}
const model=JSON.parse(await readFile(resolve(repo,'experiments/widget-student-v1/student-model.json'),'utf8'));
for(const [name,h]of Object.entries(model.heads)){
 const values=[];let decodedBytes=0;
 for(let rep=0;rep<20;rep++){const t=performance.now();const binary=atob(h.weights),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);const view=new DataView(bytes.buffer),weights=new Int16Array(bytes.length/2);for(let i=0;i<weights.length;i++)weights[i]=view.getInt16(i*2,true);const knownBin=atob(h.known),known=new Uint8Array(knownBin.length);for(let i=0;i<knownBin.length;i++)known[i]=knownBin.charCodeAt(i);decodedBytes=weights.byteLength+known.byteLength;values.push(performance.now()-t);}
 timing.decode[name]={...percentiles(values),decodedBytes,note:'Standalone equivalent decode loop; excludes module import/JSON parse/features/softmax and is not additive to measured cold totals.'};
}
const failures=raw.flatMap(c=>Object.entries(c.results).filter(([n,r])=>!r.semantic.strictCorrect||!!r.prediction.program&&!r.geometry.finiteSurfacePass).map(([pipeline,result])=>({pipeline,id:c.id,text:c.text,stratum:c.stratum,expected:c.expected,schemaRepresentable:c.schemaRepresentable,prediction:result.prediction,semantic:result.semantic,geometry:result.geometry})));
await writeFile(resolve(dir,'raw-predictions.json'),JSON.stringify(raw,null,2)+'\n');
await writeFile(resolve(dir,'failures.json'),JSON.stringify(failures,null,2)+'\n');
await writeFile(resolve(dir,'summary.json'),JSON.stringify(summary,null,2)+'\n');
await writeFile(resolve(dir,'timing.json'),JSON.stringify(timing,null,2)+'\n');
console.log(JSON.stringify({sha,overlap:summary.overlap,metrics:summary.full,transitions:{changed:transition.length,improved:summary.v1ToGuardV2.improved,regressed:summary.v1ToGuardV2.regressed},timing:timing.warm},null,2));
