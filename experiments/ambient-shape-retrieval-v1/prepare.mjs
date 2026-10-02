import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {registerHooks} from 'node:module';
const root=path.resolve(import.meta.dirname,'../..'), here=import.meta.dirname, web=path.join(root,'prototypes/glyph-creature'), src=path.join(web,'src'), srcURL=pathToFileURL(src+path.sep).href;
const {transformSync}=await import(pathToFileURL(path.join(web,'node_modules/rolldown/dist/utils-index.mjs')).href);
const source=[];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
registerHooks({resolve(specifier,context,next){
 if((specifier.startsWith('./')||specifier.startsWith('../'))&&context.parentURL?.startsWith(srcURL)&&!path.extname(specifier))return next(new URL(specifier+'.ts',context.parentURL).href,context);
 return next(specifier,context);
},load(url,context,next){
 if(url.startsWith(srcURL)&&url.endsWith('.ts')){
  const file=new URL(url), original=fs.readFileSync(file,'utf8');let code=original;
  source.push({path:path.relative(root,file.pathname),bytes:Buffer.byteLength(original),sha256:hash(original)});
  if(url.endsWith('/lexical.ts')){
   const pattern="import.meta.glob<{ entries: DictionaryEntry[] }>('./data/konjo-wordnet.json', { eager: true, import: 'default' })";
   if(code.split(pattern).length!==2)throw Error('Expected exact Vite glob expression once');
   code=code.replace(pattern,JSON.stringify({'./data/konjo-wordnet.json':JSON.parse(fs.readFileSync(path.join(src,'data/konjo-wordnet.json'),'utf8'))}));
  }
  return {format:'module',source:transformSync(file.pathname,code,{lang:'ts',target:'es2022'}).code,shortCircuit:true};
 }
 return next(url,context);
}});
export const language=await import(pathToFileURL(path.join(src,'language.ts')).href);
const {EXPANDED_ALIASES}=await import(pathToFileURL(path.join(src,'shape-catalog.ts')).href);
const {VISUAL_GRAPH}=await import(pathToFileURL(path.join(src,'association-graph.ts')).href);
export const baseline=text=>{
 const choices=language.shapeChoices(text,true), evidence=language.shapeEvidence(text,true), interpretation=language.interpret(text,language.DEFAULT_SPEC,undefined,undefined,true);
 return {accepted:choices.length>0,shape:choices[0]??null,choices,evidence,interpretShape:interpretation.spec.shape,recognized:interpretation.recognized};
};
if(process.argv[1]===import.meta.filename){
 const extra={condense:['凝縮','塊','かたまり','球体','球','ボール','地球','sphere','ball','globe'],vortex:['渦','うず','vortex'],orbit:['原子','軌道','orbit'],mobius:['メビウス','メビュウス','メビウスの輪','möbius','mobius'],ring:['ドーナツ','どーなつ','円環','円','リング','輪','ring','circle','donut','doughnut','torus'],cube:['立方体','キューブ','サイコロ','さいころ','cube','dice'],cuboid:['直方体','cuboid','rectangular prism','rectangular box'],cross:['十字','cross'],triangle:['三角','三角形','triangle'],square:['四角','四角形','正方形','square'],fireworks:['花火','はなび','firework','fireworks'],dango:['団子','だんご','dango'],flower:['花びら','花','はな','フラワー','flower','blossom','petal'],butterfly:['蝶','ちょうちょ','チョウチョ','バタフライ','butterfly','butterflies'],jellyfish:['くらげ','クラゲ','海月','水母','jellyfish'],tree:['樹木','大樹','樹','木','ツリー','tree','fir'],star:['星型','星形','星','スター','star','stars'],helix:['螺旋','らせん','スプリング','コイル','helix','spring','coil'],hourglass:['砂時計','すなどけい','hourglass'],saturn:['土星','どせい','saturn'],sword:['剣','つるぎ','ソード','sword','blade'],vase:['花瓶','かびん','壺','つぼ','vase','urn','pottery']};
 const aliases=language.SHAPES.map(shape=>({shape,name:language.SHAPE_NAMES[shape],terms:[...new Set([language.SHAPE_NAMES[shape],...(extra[shape]??EXPANDED_ALIASES[shape]??[])])]}));
 const dictionary=JSON.parse(fs.readFileSync(path.join(src,'data/konjo-wordnet.json'),'utf8'));
 const seeds=JSON.parse(fs.readFileSync(path.join(root,'experiments/konjo-v1/lexicon/seeds.json'),'utf8'));
 const write=(name,value)=>fs.writeFileSync(path.join(here,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 write('inventory.json',{schema:1,shapes:[...language.SHAPES],aliases});
 write('dictionary.json',dictionary);write('graph.json',VISUAL_GRAPH);write('profiles-source.json',seeds);
 for(const name of ['wordnet-NOTICE.md','wordnet-japanese-LICENSE.txt','wordnet-princeton-LICENSE.txt'])fs.copyFileSync(path.join(web,'public/licenses',name),path.join(here,'licenses',name),fs.constants.COPYFILE_EXCL);
 for(const relative of ['prototypes/glyph-creature/src/data/konjo-wordnet.json','experiments/konjo-v1/lexicon/seeds.json','prototypes/glyph-creature/public/licenses/wordnet-NOTICE.md','prototypes/glyph-creature/public/licenses/wordnet-japanese-LICENSE.txt','prototypes/glyph-creature/public/licenses/wordnet-princeton-LICENSE.txt']){const b=fs.readFileSync(path.join(root,relative));source.push({path:relative,bytes:b.length,sha256:hash(b)});}
 write('SOURCE.json',{schema:1,node:process.version,rolldown:'1.2.11',files:source.sort((a,b)=>a.path.localeCompare(b.path)),baselineLoader:'Existing Oxc transforms syntax; exact Vite import.meta.glob expression replaced once with identical parsed local JSON. Function bodies unchanged. No shared file modification.'});
 console.log(JSON.stringify({shapes:aliases.length,dictionaryEntries:dictionary.entries.length,graphNodes:VISUAL_GRAPH.length,seeds:seeds.seeds.length,sourceFiles:source.length}));
}
