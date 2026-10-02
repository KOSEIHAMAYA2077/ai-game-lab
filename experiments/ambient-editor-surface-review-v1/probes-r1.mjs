import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { FakeTextarea, artificialClock, artificialEvent } from './fake-dom.mjs';
import { createAdapter } from './snapshots/dependencies/experiments/ambient-editor-adapter-v1/adapter-r2.mjs';
import { vertexShader, fragmentShader } from './snapshots/r1/shaders.mjs';

const projectionSource = process.argv[2] ?? 'experiments/ambient-editor-surface-review-v1/snapshots/r1/projection.mjs';
const output = process.argv[3] ?? 'experiments/ambient-editor-surface-review-v1/results-r1.json';
const { createProjection, createFrameGate } = await import(pathToFileURL(resolve(projectionSource)));
const cases = JSON.parse(await readFile('experiments/ambient-editor-surface-review-v1/CASES-R1.json'));
const results = [];
function inspect(p) { return { ...p.inspect(), ids: [...p.ids.slice(0,p.count)], inks: p.inks.slice(0,p.count), born: [...p.born.slice(0,p.count)], tiles:[...p.tiles.slice(0,p.count)] }; }
const bodies = Object.freeze([
  Object.freeze({id:17,text:'漢',ink:'blue'}),
  Object.freeze({id:43,text:'👩‍💻',ink:'green'}),
  Object.freeze({id:91,text:'á',ink:'purple'}),
]);
function fixture() {
  const field = new FakeTextarea(), clock = artificialClock();
  const a = createAdapter({element:field,clock:clock.read,shapeMode:'deferred'});
  const event=(type,options={})=>{clock.set(clock.now+1);return a.handle(artificialEvent(field,type,{isTrusted:true,...options}));};
  const insert=text=>{ const value=field.value,start=field.selectionStart,end=field.selectionEnd;event('beforeinput',{inputType:'insertText',data:text});field.value=value.slice(0,start)+text+value.slice(end);return event('input',{inputType:'insertText',data:text});};
  const edit=(type,value)=>{event('beforeinput',{inputType:type,data:null});field.value=value;return event('input',{inputType:type,data:null});};
  const advance=at=>{clock.set(at);return a.advance(at);};
  return {field,clock,a,event,insert,edit,advance};
}
function timerFixture({floor=false}={}) {
  let at=0, id=0; const callbacks=new Map(), packets=[];
  const gate=createFrameGate({clock:()=>at,schedule:(fn,ms)=>{const token=++id;callbacks.set(token,{at:at+(floor?Math.floor(ms):ms),fn});return token;},cancel:token=>callbacks.delete(token),frame:p=>packets.push(p)});
  function until(end){while(true){let next=null;for(const [token,row] of callbacks)if(row.at<end&&(!next||row.at<next.row.at))next={token,row};if(!next)break;callbacks.delete(next.token);at=next.row.at;next.row.fn();}at=end;}
  return {gate,packets,callbacks,until,get at(){return at;}};
}
async function probe(id,fn) {
  try { results.push({id,expected:cases.find(c=>c.id===id).expected,passed:true,observed:await fn()}); }
  catch(e) { results.push({id,expected:cases.find(c=>c.id===id).expected,passed:false,error:e.message,actual:e.actual??null,wanted:e.expected??null}); }
}
await probe('P01',()=>{const p=createProjection();const result=p.sync([][Symbol.iterator](),0,0,()=>{throw new Error('placeholder allocated atlas')});assert.equal(p.count,0);assert.equal(result.placeholder,true);return inspect(p);});
await probe('P02',()=>{const p=createProjection(),texts=[];p.sync(bodies[Symbol.iterator](),3,2,text=>{texts.push(text);return texts.length+9});assert.deepEqual([...p.ids.slice(0,3)],[17,43,91]);assert.deepEqual(p.inks.slice(0,3),bodies.map(u=>u.ink));assert.deepEqual(texts,bodies.map(u=>u.text));assert.deepEqual([...p.tiles.slice(0,3)],[10,11,12]);return inspect(p);});
await probe('P03',()=>{const p=createProjection();p.sync(bodies,3,2,()=>4);const before=inspect(p);p.sync(bodies,3,99,()=>{throw new Error('old text reallocated')});assert.deepEqual(inspect(p),before);return inspect(p);});
await probe('P04',()=>{const p=createProjection();p.sync(bodies.slice(0,2),2,2,()=>4);p.sync(bodies,3,99,()=>8);assert.deepEqual([...p.born.slice(0,3)],[2,2,99]);assert.deepEqual([...p.tiles.slice(0,3)],[4,4,8]);assert.deepEqual(p.inks.slice(0,3),['blue','green','purple']);return inspect(p);});
await probe('P05',()=>{const before=JSON.stringify(bodies),p=createProjection();p.sync(bodies,3,2,()=>5);assert.equal(JSON.stringify(bodies),before);assert(bodies.every(Object.isFrozen));p.born[0]=100;assert.equal(JSON.stringify(bodies),before);return {canonicalFrozen:true,units:bodies.length,viewCount:p.count};});
await probe('P06',()=>{const p=createProjection();p.sync(bodies,0,0,()=>4);p.sync(bodies,1,2,()=>4);assert.equal(bodies.length,3);p.sync(bodies,3,8,()=>4);assert.deepEqual([...p.ids.slice(0,3)],[17,43,91]);assert.deepEqual([...p.born.slice(0,3)],[2,8,8]);return inspect(p);});
await probe('P07',()=>{const {a,insert,clock}=fixture(),p=createProjection();a.setAdmissionReady(false,0);insert('漢👩‍💻');assert.equal(a.snapshot().bodyCount,0);p.sync(a.readBody(),0,0,()=>4);a.setInk('green');a.setAdmissionReady(true,3);a.retry(4);clock.set(4);const s=a.advance(3000);clock.set(3000);assert.equal(s.bodyCount,2);p.sync(a.readBody(),s.presentedCount,5,()=>4);const first=inspect(p);a.retry(3001);clock.set(3001);p.sync(a.readBody(),a.snapshot().presentedCount,6,()=>{throw new Error('duplicate tile')});assert.deepEqual(inspect(p),first);assert.deepEqual(first.ids,[1,2]);assert.deepEqual(first.inks,['blue','blue']);return {bodyCount:s.bodyCount,...first};});
await probe('P08',()=>{const l=fixture(),p=createProjection();l.insert('漢字');l.advance(3000);p.sync(l.a.readBody(),l.a.snapshot().presentedCount,5,()=>4);const before=inspect(p);l.edit('deleteContentBackward','漢');l.edit('historyUndo','');p.sync(l.a.readBody(),l.a.snapshot().presentedCount,8,()=>{throw new Error('undo allocated material')});assert.deepEqual(inspect(p),before);assert.equal(l.a.inspectVolatile().document,'');assert.deepEqual([...l.a.readBody()].map(u=>u.id),[1,2]);return {...inspect(p),retainedCount:l.a.snapshot().bodyCount,documentLength:0};});
await probe('P09',()=>{const l=fixture(),p=createProjection(),timer=timerFixture();l.insert('漢');l.advance(3000);p.sync(l.a.readBody(),l.a.snapshot().presentedCount,5,()=>4);timer.gate.setActive(true);timer.until(250);timer.gate.setActive(false);l.a.setPaused(true,3000);l.a.setVisible(false,3000);const stopped=timer.gate.inspect();timer.until(10250);assert.equal(timer.gate.inspect().frames,stopped.frames);assert.equal(timer.gate.inspect().visualSeconds,stopped.visualSeconds);l.a.setInk('green');l.insert('字');assert.equal(l.a.snapshot().bodyCount,2);assert.equal(l.a.snapshot().presentedCount,1);l.advance(14000);l.a.setPaused(false,14000);l.a.setVisible(true,14000);l.advance(17000);p.sync(l.a.readBody(),l.a.snapshot().presentedCount,6,()=>4);timer.gate.setActive(true);timer.until(10251);assert.equal(timer.packets.at(-1).dt,0);assert.deepEqual([...p.ids.slice(0,p.count)],[1,2]);assert.deepEqual(p.inks.slice(0,p.count),['blue','green']);return {stoppedFrames:stopped.frames,resumeDt:timer.packets.at(-1).dt,...inspect(p)};});
await probe('P10',()=>{const l=fixture(),p=createProjection();l.insert('立方体');l.advance(3000);const answer=l.a.shapeRequest();assert.equal(answer.shape,'box');p.sync(l.a.readBody(),l.a.snapshot().presentedCount,5,()=>4);const original=inspect(p);l.edit('historyUndo','');l.a.answerShape(answer,l.clock.now);p.sync(l.a.readBody(),l.a.snapshot().presentedCount,8,()=>{throw new Error('shape allocated text')});assert.equal(l.a.snapshot().shape,'sphere');assert.equal(l.a.exportState().counters.staleAnswers,1);assert.deepEqual(inspect(p),original);return {shape:l.a.snapshot().shape,staleAnswers:1,...inspect(p)};});
await probe('P11',()=>{const l=fixture();l.insert('人工');const off=l.a.exportState();assert.deepEqual(Object.keys(off).sort(),['grammar','version','savingOff','seed','shape','now','count','presentedCount','inkCounts','counters'].sort());assert(!/人工|operationId|documentId|ownedEditor/.test(JSON.stringify(off)));return {offKeys:Object.keys(off),count:off.count};});
await probe('P12',async()=>{const source=await readFile('prototypes/glyph-creature/src/scene.ts','utf8');function extract(label,next){const start=source.indexOf(label+': `')+(label+': ').length,end=source.indexOf(next,start);assert(start>label.length);return Function('options','return '+source.slice(start,end))({dynamicAtlas:true});}assert.equal(vertexShader,extract('vertexShader',',\n      fragmentShader:'));assert.equal(fragmentShader,extract('fragmentShader',',\n    });'));return {vertexExact:true,fragmentExact:true,evidence:'CPU string identity only, not GPU compile/visual test'};});
const supplement=[];
for(const floor of [false,true]) {
  const timer=timerFixture({floor});timer.gate.setActive(true);timer.until(1000);
  supplement.push({name:floor?'floor-setTimeout-simulation':'exact-fractional-simulation',expectedMax15:15,observed:timer.packets.length,passed:timer.packets.length<=15,first:timer.packets[0]?.wall,last:timer.packets.at(-1)?.wall});
  timer.gate.destroy();
}
const result={version:'independent-r1',recordedAt:new Date().toISOString(),projectionSource,scope:'synthetic CPU only; fake trusted declarations are not browser/IME/OS evidence',cases:results,totals:{executable:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,sourceReviewOnly:1},timerKnownDefectSensitivity:supplement};
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,...result.totals,timer:supplement.map(r=>({name:r.name,passed:r.passed,observed:r.observed}))}));
