import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {FakeTextarea,artificialEvent,artificialClock} from './fake-dom-r1.mjs';
const source=process.argv[2]??'experiments/ambient-editor-adapter-review-v1/snapshots/r2/experiments/ambient-editor-adapter-v1/adapter-r2.mjs';
const output=process.argv[3]??'experiments/ambient-editor-adapter-review-v1/stale-shape-results-r2.json';
const {createAdapter}=await import(pathToFileURL(resolve(source)));
const clock=artificialClock(),field=new FakeTextarea(),a=createAdapter({element:field,clock:clock.read,shapeMode:'deferred'});
function e(type,options){clock.set(clock.now+1);return a.handle(artificialEvent(field,type,{isTrusted:true,...options}));}
e('beforeinput',{inputType:'insertText',data:'立方体'});field.value='立方体';e('input',{inputType:'insertText',data:'立方体'});
clock.set(3000);a.advance(3000);const token=a.shapeRequest(),before=a.inspectVolatile();
e('beforeinput',{inputType:'historyUndo',data:null});field.value='';e('input',{inputType:'historyUndo',data:null});
const afterUndo=a.inspectVolatile();a.answerShape(token,clock.now);const afterAnswer=a.inspectVolatile(),off=a.exportState();
const passed=token?.shape==='box'&&before.shape==='sphere'&&afterUndo.document===''&&afterUndo.shapePending===false&&afterAnswer.shape==='sphere'&&off.counters.staleAnswers===1&&afterAnswer.body==='立方体'&&JSON.stringify(afterAnswer.ids)==='[1,2,3]';
const result={source,scope:'Supplementary artificial stale-answer probe after R2 results; original P09 used sphere→sphere, so its unchanged-shape observation alone could not reject a false positive',recordedAt:new Date().toISOString(),expected:'A pending box answer invalidated by undo must increment staleAnswers and never change sphere; old body/IDs survive',passed,token,before,afterUndo,afterAnswer,off};
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,passed,tokenShape:token?.shape,finalShape:afterAnswer.shape,staleAnswers:off.counters.staleAnswers}));
