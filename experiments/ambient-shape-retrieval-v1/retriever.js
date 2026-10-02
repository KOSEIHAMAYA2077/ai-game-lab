/* Pure CPU JavaScript; no filesystem, network, module, clock, model, UI or body state. */
(function (global) {
 'use strict';
 const LIMIT=512;
 const STOP=new Set(('a an and are as at be been being by can could did do does each for from had has have he her hers him his how i if in into is it its itself may might more most my no nor not of on one or our ours out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who will with would you your').split(' '));
 const normalize=s=>s.normalize('NFKC').toLowerCase();
 function features(text) {
  const out=new Set(), words=(normalize(text).match(/[a-z][a-z'-]{1,30}/g)||[]).filter(w=>!STOP.has(w));
  for(const w of words)out.add('e:'+w);
  for(let i=1;i<words.length;i++)out.add('eb:'+words[i-1]+' '+words[i]);
  for(const run of normalize(text).match(/[一-龯々ぁ-ゖァ-ヶー]{2,}/gu)||[])for(let i=1;i<run.length;i++)out.add('j:'+run.slice(i-1,i+1));
  return [...out];
 }
 const asian=c=>/[一-龯々ぁ-ゖァ-ヶー]/u.test(c||'');
 const particles=c=>/[のはがとをにでへやも]/u.test(c||'');
 function boundary(source,start,end,term,kind){
  if(/^[a-z0-9\s'-]+$/i.test(term))return !/[a-z0-9_]/i.test(source[start-1]||'')&&!/[a-z0-9_]/i.test(source[end]||'');
  if(kind==='graph')return true;
  // Conservative authored heuristic, not Japanese morphological analysis.
  return (!asian(source[start-1])||particles(source[start-1]))&&(!asian(source[end])||particles(source[end]));
 }
 function occurrences(source,row){
  const hits=[];let start=0;
  while((start=source.indexOf(row.term,start))!==-1){const end=start+row.term.length;if(boundary(source,start,end,row.term,row.kind))hits.push({start,end,term:row.term,kind:row.kind,shapes:row.shapes,concept:row.concept||null,path:row.path||null});start=end;}
  return hits;
 }
 function longest(hits){
  const out=[];
  for(const hit of hits.sort((a,b)=>(b.end-b.start)-(a.end-a.start)||a.start-b.start||a.kind.localeCompare(b.kind))){
   const same=out.find(o=>o.start===hit.start&&o.end===hit.end&&o.term===hit.term&&o.kind===hit.kind);
   if(same){same.shapes=[...new Set([...same.shapes,...hit.shapes])];continue;}
   if(!out.some(o=>hit.start<o.end&&hit.end>o.start))out.push(hit);
  }
  return out.sort((a,b)=>a.start-b.start);
 }
 function guardSource(source){
  const reasons=[];let visible=source;
  // Whole-query technical/negation guards are intentionally broad and may suppress real objects.
  if(/```|`|\b(?:function|const|let|var|return|class|interface|import|export|await|undefined|null|select|insert|update|git|npm|sql|api|json|html|css)\b|=>|[{}]|\b[a-z]+\.[a-z]+\(|\b(?:binary tree|search tree|decision tree|syntax tree|shell command|shell script|spring framework|cloud server|cloud storage|gear ratio)\b|(?:関数|変数|クラス|メソッド|配列|構文木|二分木|実装|コンパイル|サーバー|データベース|コマンド)/iu.test(source))reasons.push('technical-context');
  if(/(?:ない|なく|なかった|ありません|以外|不要|やめる|やめて|取り消|中止)|\b(?:not|no|never|without|avoid|cancel|stop|neither|nothing)\b/iu.test(source))reasons.push('negation-or-cancellation');
  const quotePattern=/「[^」]*」|『[^』]*』|“[^”]*”|"[^"\n]*"|'[^'\n]*'/gu;
  const quotes=[];visible=visible.replace(quotePattern,(part,at)=>{quotes.push({start:at,end:at+part.length});return ' '.repeat(part.length);});
  if(quotes.length)reasons.push('quoted-spans-masked');
  if(/[「『“"]/u.test(visible)){reasons.push('unclosed-quote');}
  return {visible,reasons,quotes,hard:reasons.some(r=>r!=='quoted-spans-masked')};
 }
 function createRetriever(weights){
  if(weights.schema!==1||weights.shapes.length!==60||new Set(weights.shapes).size!==60||weights.terms.length>4096||weights.features.length>16384)throw Error('Weight schema/size');
  const shapeSet=new Set(weights.shapes), featureIds=new Map(weights.features.map((f,i)=>[f[0],i]));
  const terms=weights.terms.map(row=>({...row,term:normalize(row.term)}));
  for(const row of terms)if(!row.term||row.shapes.some(s=>!shapeSet.has(s)))throw Error('Term schema');
  const graph=weights.graphProfiles, docs=weights.profiles.map(d=>new Map(d));
  const info={weightSchema:weights.schema,shapes:60,terms:terms.length,features:featureIds.size,profiles:docs.length,graphNodes:weights.graphNodes,maxUTF16:LIMIT,thresholds:{...weights.thresholds}};
  function compute(source,mode){
   const useSyn=mode!=='alias',useGraph=!['alias','alias_wordnet'].includes(mode),useSparse=['full','unguarded','sparse_only'].includes(mode);
   const hits=mode==='sparse_only'?[]:longest(terms.filter(r=>r.kind==='alias'||useSyn&&r.kind==='synonym'||useGraph&&r.kind==='graph').flatMap(row=>occurrences(source,row)));
   const ranks=weights.shapes.map(shape=>({shape,score:0,channel:null,evidence:[],cosine:0,matchedFeatures:[],rareFeatures:0}));
   const byShape=new Map(ranks.map(r=>[r.shape,r]));
   for(const hit of hits){
    const candidates=hit.kind==='graph'?graph[hit.path]:hit.shapes.map(shape=>[shape,hit.kind==='alias'?1:.96]);
    for(const [shape,score] of candidates){const r=byShape.get(shape);r.evidence.push({...hit,score});if(score>r.score){r.score=score;r.channel=hit.kind;}}
   }
   if(useSparse){
    const queryFeatures=features(source).map(f=>featureIds.get(f)).filter(i=>i!==undefined);let qnorm=0;
    for(const i of queryFeatures)qnorm+=weights.features[i][1]**2;qnorm=Math.sqrt(qnorm);
    if(qnorm)for(let j=0;j<ranks.length;j++){
     let dot=0;const matched=[];
     for(const i of queryFeatures){const v=docs[j].get(i);if(v!==undefined){dot+=weights.features[i][1]*v;matched.push(i);}}
     const cosine=dot/qnorm, r=ranks[j];r.cosine=cosine;r.matchedFeatures=matched.map(i=>weights.features[i][0]);r.rareFeatures=matched.filter(i=>weights.features[i][2]<=6).length;
     const score=.8*cosine;if(score>r.score){r.score=score;r.channel='sparse';}
    }
   }
   ranks.sort((a,b)=>b.score-a.score||b.cosine-a.cosine||weights.shapes.indexOf(a.shape)-weights.shapes.indexOf(b.shape));
   return {ranks,hits};
  }
  function predict(text,options){
   options=options||{};const mode=options.mode||'full',current=shapeSet.has(options.current)?options.current:null;
   if(!['alias','alias_wordnet','alias_wordnet_graph','full','unguarded','sparse_only'].includes(mode))throw Error('Unknown mode');
   const base={mode,current,accepted:false,shape:null,proposal:null,nextShape:current,reason:null,inputUTF16:typeof text==='string'?text.length:null,queryUTF16:0,query:null,rawTop1:null,score:0,margin:0,ranking:[],evidence:[],guards:[]};
   if(typeof text!=='string'){base.reason='invalid-input';return base;}
   if(text.length>LIMIT){base.reason='overlength-input';return base;}
   const source=normalize(text);if(source.length>LIMIT){base.reason='overlength-normalized';return base;}
   const raw=compute(source,mode), rawFirst=raw.ranks[0];base.rawTop1=rawFirst.score>0?rawFirst.shape:null;
   const guarded=mode==='unguarded'?{visible:source,reasons:[],hard:false}:guardSource(source);
   const query=guarded.visible;const selected=query===source?raw:compute(query,mode), top=selected.ranks[0], next=selected.ranks[1];
   base.query=query;base.queryUTF16=query.length;base.ranking=selected.ranks;base.evidence=selected.hits;base.guards=guarded.reasons;base.score=top.score;base.margin=top.score-next.score;
   if(guarded.hard){base.reason=guarded.reasons.find(x=>x!=='quoted-spans-masked');return base;}
   if(!query.trim()){base.reason='empty-or-quoted';return base;}
   if(top.score<=0){base.reason='no-evidence';return base;}
   const distinct=new Set(selected.hits.filter(h=>h.kind!=='graph').flatMap(h=>h.shapes));
   if(distinct.size>1){base.reason='conflicting-object-mentions';return base;}
   const t=weights.thresholds;
   if(top.channel==='sparse'){
    if(top.cosine<t.sparseCosine||top.cosine-next.cosine<t.sparseMargin||top.matchedFeatures.length<t.sparseMatched||top.rareFeatures<t.sparseRare){base.reason='weak-sparse-evidence';return base;}
   }else if(top.score<t.anchorScore||base.margin<t.anchorMargin){base.reason='weak-or-near-tied-anchor';return base;}
   base.accepted=true;base.shape=top.shape;base.proposal=top.shape;base.nextShape=top.shape;base.reason='accepted-'+top.channel;return base;
  }
  return {predict,rank:text=>predict(text,{mode:'unguarded'}).ranking,info};
 }
 global.AmbientShapeRetrieval={createRetriever,features,normalize,version:'1.0.0'};
})(typeof globalThis!=='undefined'?globalThis:this);
