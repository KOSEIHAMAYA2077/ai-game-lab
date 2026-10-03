/** Sparse char-ngram task classifier. No transformer, network, or dynamic code. */
// Explicitly match Python whitespace; JS \s differs for BOM/NEL/separators.
const normalize = text => String(text).normalize('NFKC').toLowerCase().replace(/[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/gu,' ').replace(/^ +| +$/gu,'');
export function featureIds(text, dimensions, min=1, max=5) {
  const chars = Array.from('^'+normalize(text)+'$'), ids = new Set();
  for(let n=min;n<=max;n++) for(let i=0;i+n<=chars.length;i++) {
    let h=2166136261;
    for(let j=i;j<i+n;j++) h=Math.imul(h ^ chars[j].codePointAt(0),16777619)>>>0;
    ids.add(h % dimensions);
  }
  return [...ids].sort((a,b)=>a-b);
}
function bytes(value) {
  const binary=atob(value), result=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) result[i]=binary.charCodeAt(i);
  return result;
}
export function loadModel(raw) {
  if(raw.format!=='glyph-task-student-v1') throw new Error('Unsupported task model');
  const heads={};
  for(const [key,h] of Object.entries(raw.heads)) {
    const b=bytes(h.weights), view=new DataView(b.buffer), w=new Int16Array(b.length/2);
    for(let i=0;i<w.length;i++) w[i]=view.getInt16(i*2,true);
    heads[key]={...h, weights:w, known:bytes(h.known)};
  }
  return {...raw,heads};
}
export function scores(model,text,key) {
  const h=model.heads[key], ids=featureIds(text,model.dimensions), f=1/Math.sqrt(Math.max(1,ids.length));
  const logits=h.bias.slice(); let seen=0;
  for(const id of ids) {
    if(h.known[id>>3] & (1<<(id&7))) seen++;
    for(let j=0;j<logits.length;j++) logits[j]+=h.weights[id*logits.length+j]*h.scale*f;
  }
  const m=Math.max(...logits), exp=logits.map(x=>Math.exp(x-m)), sum=exp.reduce((a,b)=>a+b,0);
  return h.labels.map((label,i)=>({label,score:exp[i]/sum,coverage:seen/Math.max(1,ids.length)})).sort((a,b)=>b.score-a.score);
}
export function predict(model,text) {
  const start=performance.now();
  if(typeof text!=='string'||Array.from(text).length>512) return {shape:'hold',length:'neutral',width:'neutral',bend:'straight',score:0,margin:0,coverage:0,modelMs:performance.now()-start,reason:'input-boundary'};
  const candidates=scores(model,text,'shape'), [a,b]=candidates, gate=model.thresholds;
  const held=!normalize(text)||a.label==='hold'||a.score<gate.score||a.score-b.score<gate.margin||a.coverage<gate.coverage;
  const result={shape:held?'hold':a.label,score:a.score,margin:a.score-b.score,coverage:a.coverage,candidates:candidates.slice(0,3),reason:held?'hold-or-uncertain':'selected'};
  for(const key of ['length','width','bend']) result[key]=scores(model,text,key)[0].label;
  return {...result,modelMs:performance.now()-start};
}
