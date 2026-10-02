import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { FakeTextarea, artificialClock, artificialEvent } from './fake-dom-r1.mjs';

// Independent synthetic probe expectations. Fake isTrusted=true is only an
// artificial producer declaration; this runner is not a browser or real IME.
const source = process.argv[2] ?? 'experiments/ambient-editor-adapter-review-v1/snapshots/r2/experiments/ambient-editor-adapter-v1/adapter-r2.mjs';
const output = process.argv[3] ?? 'experiments/ambient-editor-adapter-review-v1/results-r2.json';
const { createAdapter } = await import(pathToFileURL(resolve(source)));
const rows = [];
function check(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Object.assign(new Error(label), { actual, expected });
}
function truth(actual, label) { check(Boolean(actual), true, label); }
function lab(value='', settings={}) {
  const field = new FakeTextarea(value), clock = artificialClock();
  const adapter = createAdapter({element:field,clock:clock.read,...settings});
  const at = n => { clock.set(n); return adapter.advance(n); };
  const event = (type,opts={}) => { clock.set(clock.now+1); return adapter.handle(artificialEvent(field,type,{isTrusted:true,...opts})); };
  const insert = (text,{type='insertText',data=text,finalData=data,start=field.selectionStart,end=field.selectionEnd}={}) => {
    field.setSelectionRange(start,end); const base=field.value;
    event('beforeinput',{inputType:type,data,isComposing:false});
    field.value=base.slice(0,start)+text+base.slice(end);
    return event('input',{inputType:type,data:finalData,isComposing:false});
  };
  const view=()=>adapter.inspectVolatile();
  return {field,clock,adapter,event,insert,at,view};
}
async function probe(id,expectation,fn) {
  try { const observed=await fn();rows.push({id,expectation,passed:true,observed}); }
  catch(e) { rows.push({id,expectation,passed:false,error:e.message,actual:e.actual??null,expected:e.expected??null}); }
}
await probe('P01-A01','initial baseline0; wrong target does not read either field; own listeners only',()=>{
  const l=lab('seed'), other=new FakeTextarea('other'); other.blockValueRead=true;
  const n=l.field.valueReads;l.field.blockValueRead=true;
  l.adapter.handle(artificialEvent(other,'input',{isTrusted:true,inputType:'insertText',data:'X'}));
  check(l.field.valueReads,n,'wrong target raw read');check(l.view().body,'','baseline material');
  check(other.valueReads,0,'other field read');check(other.listeners.size,0,'other listeners');
  return {units:l.view().units,ownListenerTypes:l.field.listeners.size,otherReads:other.valueReads};
});
await probe('P02-A02-A03','selected replacement adds onlyB once; duplicate echo0; new repeated content adds separately with preserved ink/IDs',()=>{
  const l=lab('a-c');l.insert('B',{start:1,end:2});
  check(l.view().body,'B','selected insertion');check(l.view().document,'aBc','doc');
  l.event('input',{inputType:'insertText',data:'B'});check(l.view().ids,[1],'echo ID');
  l.adapter.setInk('green');l.insert('B');check(l.view().body,'BB','new same text');
  check(l.view().ids,[1,2],'whole IDs');check(l.view().inks,['blue','green'],'inks');return l.view();
});
await probe('P03-A04-A05','trusted IME preedit/Enter do not admit; cancel clears; quiet cannot confirm',()=>{
  const l=lab();l.event('compositionstart',{data:''});
  for(const data of ['k','か','漢']) {l.field.value=data;l.event('compositionupdate',{data});l.event('input',{inputType:'insertCompositionText',data,isComposing:true});}
  l.event('keydown',{key:'Enter',code:'Enter',isComposing:true});check(l.view().units,0,'preedit admitted');
  check(l.view().shapePending,false,'preedit shape');l.field.value='';l.event('compositionend',{data:''});
  l.at(10000);check(l.view().units,0,'cancel promoted');check(l.view().composition,null,'cancel cleared');return l.view();
});
await probe('P04-A06','IME end after preedit input exact selected replacement adds final only once',()=>{
  const l=lab('a-c');l.field.setSelectionRange(1,2);l.event('compositionstart',{data:''});
  l.field.value='a漢字c';l.event('input',{inputType:'insertCompositionText',data:'漢字',isComposing:true});
  l.event('compositionend',{data:'漢字'});l.event('input',{inputType:'insertFromComposition',data:'漢字',isComposing:false});
  check(l.view().body,'漢字','final body');check(l.view().ids,[1,2],'IME duplicate');check(l.view().document,'a漢字c','final document');return l.view();
});
await probe('P05-A06','IME end before matching final input holds0 then adds once; missing/untrusted mismatch0',()=>{
  const l=lab();l.event('compositionstart',{data:''});l.event('compositionend',{data:'確定'});
  check(l.view().units,0,'early end');check(l.view().composition?.phase,'ended','ended slot');
  l.field.value='確定';l.event('input',{inputType:'insertFromComposition',data:'確定',isComposing:false});
  check(l.view().body,'確定','late final');
  const unknown=lab();unknown.field.value='不明';unknown.event('compositionend',{data:'不明'});unknown.at(10000);check(unknown.view().units,0,'missing start');
  const untrusted=lab();untrusted.event('compositionstart',{data:''});untrusted.field.value='不明';untrusted.event('compositionend',{data:'不明',isTrusted:false});untrusted.at(10000);check(untrusted.view().units,0,'untrusted end');
  return {known:l.view(),missing:unknown.view(),untrusted:untrusted.view()};
});
await probe('P06-A06','ended IME token expiry at5000ms and later never revives',()=>{
  const results=[];
  for(const endAt of [5001,5002,10000]) {
    const l=lab();l.event('compositionstart',{data:''});l.event('compositionend',{data:'終'});
    l.at(endAt);l.field.value='終';l.event('input',{inputType:'insertFromComposition',data:'終',isComposing:false});
    check(l.view().units,0,`expired at ${endAt}`);results.push(l.view());
  } return results;
});
await probe('P07-A07','unknown missing flags/type/trust/defaultPrevented/input-only never material nor timeout promoted',()=>{
  const variants=[{before:false},{isTrusted:false},{isComposing:undefined},{inputType:'insertUnknown'},{defaultPrevented:true}];const result=[];
  for(const v of variants) {
    const l=lab();if(v.before!==false)l.event('beforeinput',{inputType:'insertText',data:'X',isComposing:false,...v});
    l.field.value='X';l.event('input',{inputType:'insertText',data:'X',isComposing:false,...v});l.at(10000);
    check(l.view().units,0,`unknown ${JSON.stringify(v)}`);result.push(l.view());
  }return result;
});
await probe('P08-A08','nullable paste selected replacement reads no clipboard/DataTransfer/ranges; adds inserted only',()=>{
  const l=lab('abc');l.field.setSelectionRange(1,2);
  const poison={get dataTransfer(){throw new Error('DataTransfer read');},getTargetRanges(){throw new Error('ranges read');}};
  const event={...artificialEvent(l.field,'beforeinput',{isTrusted:true,inputType:'insertFromPaste',data:null}),getTargetRanges:poison.getTargetRanges};
  Object.defineProperty(event,'dataTransfer',{get:Object.getOwnPropertyDescriptor(poison,'dataTransfer').get});
  l.clock.set(1);l.adapter.handle(event);l.field.value='aP,Qc';
  const final={...artificialEvent(l.field,'input',{isTrusted:true,inputType:'insertFromPaste',data:null}),getTargetRanges:poison.getTargetRanges};
  Object.defineProperty(final,'dataTransfer',{get:Object.getOwnPropertyDescriptor(poison,'dataTransfer').get});
  l.clock.set(2);l.adapter.handle(final);check(l.view().body,'P,Q','paste body');check(l.view().document,'aP,Qc','paste doc');return l.view();
});
await probe('P09-A09-A10','undo/redo/delete update mirror only preserve appendIDs/ink and invalidate shape query',()=>{
  const l=lab('',{shapeMode:'deferred'});l.insert('球体');l.at(3000);const token=l.adapter.shapeRequest();
  for(const [type,value] of [['historyUndo',''],['historyRedo','球体'],['deleteContentBackward','球']]) {
    l.event('beforeinput',{inputType:type,data:null});l.field.value=value;l.event('input',{inputType:type,data:null});
    check(l.view().body,'球体',type);check(l.view().ids,[1,2],type+' IDs');
  }
  if(token)l.adapter.answerShape(token,l.clock.now);check(l.view().shape,'sphere','stale shape');return {tokenExisted:Boolean(token),...l.view()};
});
await probe('P10-A11','noACK captures recursively frozenX; retry does not reread mutated DOM/event; whole exactly once and off export no payload',()=>{
  const l=lab();l.adapter.setAdmissionReady(false,0);l.insert('X');
  check(l.view().units,0,'deferred body');truth(l.view().pendingRetry,'pending');truth(l.view().readOnly,'readonly');truth(l.view().frozenPending,'frozen');
  l.field.value='Y';l.adapter.setInk('green');l.adapter.setAdmissionReady(true,3);l.adapter.retry(4);
  check(l.view().body,'X','frozen body');check(l.view().document,'X','frozen doc');check(l.view().inks,['blue'],'frozen ink');check(l.view().ids,[1],'frozen IDs');
  l.adapter.retry(5);check(l.view().ids,[1],'retry duplicate');check(l.view().readOnly,false,'readonly restoration');
  truth(!JSON.stringify(l.adapter.exportState()).includes('"X"'),'off raw payload');return l.view();
});
await probe('P11-A12','different new value during noACK invalidates provenance; later automaticretry/newinput does not materialize',()=>{
  const l=lab();l.adapter.setAdmissionReady(false,0);l.insert('X');l.field.value='Y';l.event('input',{inputType:'insertText',data:'Y'});
  truth(l.view().unsupported,'overrun unsupported');check(l.view().pendingRetry,false,'pending cleared');l.adapter.setAdmissionReady(true,4);l.adapter.retry(5);l.insert('Z');
  check(l.view().units,0,'unsupported auto recovered');return l.view();
});
await probe('P12-A13','blur cancels IME before stalefinal; pending handoff does not cross blur without explicit policy',()=>{
  const l=lab();l.event('compositionstart',{data:''});l.field.value='漢';l.event('input',{inputType:'insertCompositionText',data:'漢',isComposing:true});l.event('blur');l.event('compositionend',{data:'漢'});check(l.view().units,0,'blur stale IME');
  const deferred=lab();deferred.adapter.setAdmissionReady(false,0);deferred.insert('X');deferred.event('blur');
  check(deferred.view().pendingRetry,false,'blur pending retained');deferred.adapter.setAdmissionReady(true,4);deferred.adapter.retry(5);check(deferred.view().units,0,'blur retry material');return {ime:l.view(),pending:deferred.view()};
});
await probe('P13-A14','wrongtarget and activity-only keydown never read text; unsupported policy toggles not invented',()=>{
  const l=lab();l.field.blockValueRead=true;const reads=l.field.valueReads;
  l.event('keydown',{key:'Enter',code:'Enter'});check(l.field.valueReads,reads,'activity raw read');check(l.view().units,0,'activity material');check(l.view().rawKeys,1,'key counter');
  return {reads:l.field.valueReads,rawKeys:l.view().rawKeys,unverified:'capture/policy APIs are not exposed by adapter'};
});
await probe('P14-A15','off export exact10keys through body/preedit/pending; body iterator derives single ID authority; restart separate empty baseline',()=>{
  const l=lab();l.insert('秘密');const rows=[...l.adapter.readBody()];check(rows.map(r=>r.id),l.view().ids,'body ID projection');truth(rows.every(Object.isFrozen),'body projection immutable');
  l.event('compositionstart',{data:''});l.field.value='秘密途中';l.event('compositionupdate',{data:'途中'});
  const off=l.adapter.exportState();check(Object.keys(off).sort(),['grammar','version','savingOff','seed','shape','now','count','presentedCount','inkCounts','counters'].sort(),'off allowlist');
  truth(!/秘密|途中|ownedEditor|operationId|documentId/.test(JSON.stringify(off)),'off leaked raw');
  const fresh=lab();check(fresh.view().units,0,'restart body');return {keys:Object.keys(off),projection:rows,scope:'module off export only; actual page persistence unverified'};
});
await probe('P15-A16','destroy detaches; new attach onebody; duplicate create same element must be rejected or share singleauthority',()=>{
  const l=lab();const old=l.adapter;l.adapter.destroy();check([...l.field.listeners.values()].reduce((n,s)=>n+s.size,0),0,'listener detach');
  old.handle(artificialEvent(l.field,'input',{isTrusted:true,inputType:'insertText',data:'X'}));check(old.inspectVolatile().units,0,'destroyed handles');
  let terminalRejected=false;try{createAdapter({element:l.field,clock:l.clock.read});}catch{terminalRejected=true;}
  truth(terminalRejected,'closed element silently re-created');
  const freshField=new FakeTextarea();const first=createAdapter({element:freshField,clock:l.clock.read});
  let second=null,rejected=false;try{second=createAdapter({element:freshField,clock:l.clock.read});}catch{rejected=true;}
  if(!rejected) {
    const counts=[...freshField.listeners.values()].map(s=>s.size);truth(counts.every(n=>n<=1),'duplicate element listener authorities');truth(second===first,'duplicate same authority');
  }
  return {terminalRejected,rejected,listeners:[...freshField.listeners.values()].map(s=>s.size)};
});
await probe('P16-A17','graphemes and literal text whole; surrogate range invalid0; >256event and >512doc hold0 then IDs contiguous',()=>{
  const l=lab();l.insert('👩‍💻á');check(l.view().units,2,'grapheme units');check(l.view().unitTexts,['👩‍💻','á'],'grapheme text');
  const bad=lab('😀');bad.insert('X',{start:1,end:1});check(bad.view().units,0,'split surrogate');
  const large=lab();large.insert('A'.repeat(257));check(large.view().units,0,'event-limit partial');large.field.value='';large.event('input',{inputType:'unknown'});large.insert('Z');check(large.view().ids,[1],'event-limit ID gap');
  const doc=lab();doc.insert('A'.repeat(513));check(doc.view().units,0,'doc-limit material');check(doc.view().document,'','doc-limit retained');
  const literal=lab();literal.insert('<script>x</script>');check(literal.view().body,'<script>x</script>','literal changed');return {graphemes:l.view(),malformed:bad.view(),eventBound:large.view(),docBound:doc.view(),literal:literal.view()};
});
await probe('P17-A17','original blueIDs survive body-capacity wholehold; next rejected long input cannot allocate partial units',()=>{
  const l=lab('',{bodyLimit:2});l.insert('A');l.adapter.setInk('purple');l.insert('BC');check(l.view().body,'A','capacity partial');check(l.view().ids,[1],'capacity IDs');check(l.view().inks,['blue'],'capacity originalink');return l.view();
});
const result={version:'ambient-editor-independent-probes-r2-lifecycle-policy-mapping',recordedAt:new Date().toISOString(),source,scope:'Synthetic owned-field module checks, fake UA trust declaration; no real DOM/IME/OS/UI',total:rows.length,passed:rows.filter(r=>r.passed).length,failed:rows.filter(r=>!r.passed).length,rows};
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,total:result.total,passed:result.passed,failed:result.failed,failures:rows.filter(r=>!r.passed)}));
