import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FakeTextarea, artificialEvent } from './fake-dom-r1.mjs';
const source=process.argv[2]??'experiments/ambient-editor-adapter-review-v1/snapshots/r2/experiments/ambient-editor-adapter-v1/adapter-r2.mjs';
const output=process.argv[3]??'experiments/ambient-editor-adapter-review-v1/retired-callbacks-results-r2.json';
const {createAdapter}=await import(pathToFileURL(resolve(source)));
let at=0,clockReads=0,retired=false;
const clock=()=>{clockReads++;if(retired)throw new Error('retired clock read');return at;};
const field=new FakeTextarea();const a=createAdapter({element:field,clock});
const send=(type,options)=>{at++;return a.handle(artificialEvent(field,type,{isTrusted:true,...options}));};
send('beforeinput',{inputType:'insertText',data:'A'});field.value='A';send('input',{inputType:'insertText',data:'A'});
a.setAdmissionReady(false,at);send('beforeinput',{inputType:'insertText',data:'X'});field.value='AX';send('input',{inputType:'insertText',data:'X'});
a.destroy();const baseline=a.inspectVolatile(),rawReads=field.valueReads,oldClockReads=clockReads;
retired=true;field.blockValueRead=true;
const poisoned=new Proxy({},{get(){throw new Error('retired payload read');}});
const methods=[['handle',()=>a.handle(poisoned)],['advance',()=>a.advance(NaN)],['setInk',()=>a.setInk(poisoned)],
 ['setAdmissionReady',()=>a.setAdmissionReady(poisoned)],['retry',()=>a.retry()],['setVisible',()=>a.setVisible(poisoned)],
 ['setPaused',()=>a.setPaused(poisoned)],['shapeRequest',()=>a.shapeRequest()],['answerShape',()=>a.answerShape(poisoned)],['destroy-again',()=>a.destroy()]];
const rows=[];
for(const [name,run] of methods) {
 try { const result=run();const final=a.inspectVolatile();const unchanged=JSON.stringify(final)===JSON.stringify(baseline);
  const passed=unchanged&&field.valueReads===rawReads&&clockReads===oldClockReads&&(name!=='shapeRequest'||result===null);
  rows.push({name,passed,unchanged,rawReads:field.valueReads-rawReads,clockReads:clockReads-oldClockReads});
 }catch(e){rows.push({name,passed:false,error:e.message});}
}
const result={source,scope:'Known terminal-lifecycle supplementary artificial regression after R2 source/results read; no realDOM/IME/OS/UI',recordedAt:new Date().toISOString(),expected:'Every retired mutation callback ignores time/payload, does not read owned text, keeps old material/IDs/ink/counters unchanged; shapeRequest null',total:rows.length,passed:rows.filter(r=>r.passed).length,failed:rows.filter(r=>!r.passed).length,baseline,rows};
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,total:result.total,passed:result.passed,failed:result.failed,failures:rows.filter(r=>!r.passed)}));
