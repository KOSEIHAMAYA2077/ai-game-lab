import fs from 'node:fs';
import path from 'node:path';
import {predict} from './api.mjs';
const here=import.meta.dirname,dev=JSON.parse(fs.readFileSync(path.join(here,'DEV.json'),'utf8')),modes=['alias','alias_wordnet','alias_wordnet_graph','sparse_only','unguarded','full'];
const runs=[],summary={};
for(const mode of modes){
 const totals={positive:0,rawCorrect:0,acceptedPositive:0,correctAccepted:0,hold:0,falseActivation:0,ambiguous:0,ambiguousAccepted:0};
 for(const row of dev.rows){const p=predict(row.text,{mode,current:'mobius'});runs.push({id:row.id,mode,result:p});if(row.kind==='positive'){totals.positive++;totals.rawCorrect+=p.rawTop1===row.shape;totals.acceptedPositive+=p.accepted;totals.correctAccepted+=p.accepted&&p.shape===row.shape;}else if(row.kind==='hold'){totals.hold++;totals.falseActivation+=p.accepted;}else {totals.ambiguous++;totals.ambiguousAccepted+=p.accepted;}}
 summary[mode]=totals;
}
fs.writeFileSync(path.join(here,'DEV-R1-OUTPUTS.json'),JSON.stringify({schema:1,summary,runs})+'\n',{flag:'wx'});
const inputs=JSON.parse(fs.readFileSync(path.join(here,'PILOT-INPUTS.json'),'utf8')),oldWeights=JSON.parse(fs.readFileSync(path.join(here,'weights.json'),'utf8')),r0=globalThis.AmbientShapeRetrieval.createRetriever(oldWeights);
fs.writeFileSync(path.join(here,'PILOT-R0-OUTPUTS.json'),JSON.stringify({schema:1,runs:inputs.rows.map(row=>({...row,result:r0.predict(row.text)}))})+'\n',{flag:'wx'});
console.log(JSON.stringify(summary));
