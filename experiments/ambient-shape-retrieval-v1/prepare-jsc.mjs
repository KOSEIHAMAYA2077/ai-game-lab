import fs from 'node:fs';import path from 'node:path';import {predict} from './api.mjs';
const here=import.meta.dirname,dev=JSON.parse(fs.readFileSync(path.join(here,'DEV.json'),'utf8')),pilot=JSON.parse(fs.readFileSync(path.join(here,'PILOT-INPUTS.json'),'utf8'));
const cases=[];
for(const row of dev.rows)for(const mode of ['alias','alias_wordnet','alias_wordnet_graph','sparse_only','unguarded','full'])cases.push({id:row.id+'-'+mode,text:row.text,options:{mode,current:'mobius'}});
for(const row of pilot.rows)cases.push({id:row.id,text:row.text,options:{current:'mobius'}});
for(const [i,text] of [null,'','x'.repeat(512),'x'.repeat(513),'🙂'.repeat(256),'🙂'.repeat(256)+'x','㍿'.repeat(128),'㍿'.repeat(129),'「鳥」を引用し、花瓶を眺めた。','「鳥を描く','const tree = 4;','鳥と魚を見た。'].entries())cases.push({id:'boundary-'+i,text,options:{current:'mobius'}});
const compact=p=>({accepted:p.accepted,shape:p.shape,nextShape:p.nextShape,reason:p.reason,rawTop1:p.rawTop1,query:p.query,queryUTF16:p.queryUTF16,score:p.score,margin:p.margin,ranking:p.ranking.map(r=>({shape:r.shape,score:r.score,cosine:r.cosine,channel:r.channel})),evidence:p.evidence});
fs.writeFileSync(path.join(here,'JSC-CASES-R1.json'),JSON.stringify({schema:1,cases:cases.map(c=>({...c,expected:compact(predict(c.text,c.options))}))})+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:cases.length}));
