import fs from 'node:fs';
import path from 'node:path';
import './retriever.js';
const here=import.meta.dirname,read=name=>JSON.parse(fs.readFileSync(path.join(here,name),'utf8'));
const inventory=read('inventory.json'),dictionary=read('dictionary.json'),graph=read('graph.json'),seeds=read('profiles-source.json'),F=globalThis.AmbientShapeRetrieval.features;
const profiles=inventory.shapes.map(()=>new Set()),shapeIndex=new Map(inventory.shapes.map((s,i)=>[s,i])),terms=[],graphProfiles={};
for(const row of inventory.aliases){for(const term of row.terms){terms.push({term,kind:'alias',shapes:[row.shape]});for(const f of F(term))profiles[shapeIndex.get(row.shape)].add(f);}}
for(const row of dictionary.entries){terms.push({term:row.term,kind:'synonym',shapes:row.shapes,concept:row.concept});for(const shape of row.shapes)for(const f of F(row.term))profiles[shapeIndex.get(shape)].add(f);}
const nodes=new Map(graph.map(n=>[n.id,n]));
for(const node of graph){
 const best=new Map();
 function visit(id,score,path){if(path.length>=3||path.includes(id))return;const n=nodes.get(id);if(!n)return;for(const [shape,w] of n.forms||[])best.set(shape,Math.max(best.get(shape)||0,score*w));for(const [next,w] of n.links||[])visit(next,score*w,[...path,id]);}
 visit(node.id,.9,[]);graphProfiles[node.id]=[...best];
 for(const term of node.words)terms.push({term,kind:'graph',shapes:[...best.keys()],path:node.id});
 for(const [shape] of best)for(const word of node.words)for(const f of F(word))profiles[shapeIndex.get(shape)].add(f);
}
for(const seed of seeds.seeds)for(const text of [seed.definition,...seed.englishLemmas.map(s=>s.replaceAll('_',' '))])for(const f of F(text))profiles[shapeIndex.get(seed.shape)].add(f);
const counts=new Map();for(const p of profiles)for(const f of p)counts.set(f,(counts.get(f)||0)+1);
const features=[...counts].sort((a,b)=>a[0].localeCompare(b[0])).map(([f,n])=>[f,Math.log(61/(n+1))+1,n]);const featureIds=new Map(features.map((f,i)=>[f[0],i]));
const vectors=profiles.map(p=>{const ids=[...p].map(f=>featureIds.get(f)).sort((a,b)=>a-b);const norm=Math.sqrt(ids.reduce((s,i)=>s+features[i][1]**2,0));return ids.map(i=>[i,features[i][1]/norm]);});
const weights={schema:1,shapes:inventory.shapes,terms,graphNodes:graph.length,graphProfiles,features,profiles:vectors,thresholds:{anchorScore:.85,anchorMargin:.10,sparseCosine:.32,sparseMargin:.10,sparseMatched:3,sparseRare:2},fit:'Binary profile document frequency only; IDF=ln(61/(df+1))+1; 60 fixed shape profiles. No classifier/embedding/gradient fitting.'};
const bytes=Buffer.from(JSON.stringify(weights)+'\n');if(bytes.length>8*1024*1024)throw Error('8MiB budget');fs.writeFileSync(path.join(here,process.argv[2]||'weights.json'),bytes,{flag:'wx'});
console.log(JSON.stringify({bytes:bytes.length,terms:terms.length,features:features.length,profiles:profiles.length,graphNodes:graph.length,thresholds:weights.thresholds}));
