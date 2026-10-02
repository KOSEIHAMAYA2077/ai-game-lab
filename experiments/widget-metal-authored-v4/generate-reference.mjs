import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';
const root=path.resolve(import.meta.dirname,'../..'), web=path.join(root,'prototypes/glyph-creature'), src=path.join(web,'src');
const {transformSync}=await import(pathToFileURL(path.join(web,'node_modules/rolldown/dist/utils-index.mjs')).href);
// Existing Rolldown/Oxc transpiles syntax only; original sources stay intact.
registerHooks({resolve(specifier,context,next){
  if(specifier==='three')return next(pathToFileURL(path.join(web,'node_modules/three/build/three.module.js')).href,context);
  if((specifier.startsWith('./')||specifier.startsWith('../'))&&context.parentURL?.startsWith(pathToFileURL(src+path.sep).href)&&!path.extname(specifier))return next(new URL(specifier+'.ts',context.parentURL).href,context);
  return next(specifier,context);
},load(url,context,next){
  if(url.startsWith(pathToFileURL(src+path.sep).href)&&url.endsWith('.ts'))return {format:'module',source:transformSync(new URL(url).pathname,fs.readFileSync(new URL(url),'utf8'),{lang:'ts',target:'es2022'}).code,shortCircuit:true};
  return next(url,context);
}});
const {expandedSurface,expandedSurfacePoint}=await import(pathToFileURL(path.join(src,'expanded-surfaces.ts')).href);
const {creatureRig,creatureInfluences,skinCreaturePoint}=await import(pathToFileURL(path.join(src,'creature-rig.ts')).href);
const configurations=[['fish',13,4.8,[0,44,45,46,57,58,63]],['bird',14,6,[0,15,16,23,24,27,28,29,57,58,59,63]],['snake',15,7.6,[0,57,58,63]]];
const frames=[],points=[],palettes=[],influences=[],restChecks=[],updates={};
const ids=[...Array(64).keys(),385,1535,31999],seeds=[1,42,123456,4294967295],h=.00001;
for(const [name,shape,period,parts] of configurations){
 const base=[0,period/4,period/2,period*.75,period,24,100,3600,28800];
 const times=[...new Set([...base,...[period/4,period/2,24].flatMap(t=>[t-h,t+h])])].sort((a,b)=>a-b);
 const rig=creatureRig(name);
 for(const time of [null,...times]){const pose=rig.pose(time);palettes.push({name,shape,time,matrices:Array.from(pose.matrices),joints:Array.from(pose.joints),definitions:rig.definitions});}
 for(const time of times)for(const seed of seeds)for(const id of ids){const u=[0,0,0],v=[0,0,0],p=expandedSurface(name,id,time,seed,undefined,u,v);frames.push({name,shape,time,seed,id,p,u,v});}
 for(const time of base)for(const part of parts)for(const uCoord of [0,1/3,2/3,1,11.125])for(const vCoord of [.00001,.1,.5,.9,.99999]){
  const p=expandedSurfacePoint(name,uCoord,vCoord,time,part),xp=expandedSurfacePoint(name,uCoord+h,vCoord,time,part),xm=expandedSurfacePoint(name,uCoord-h,vCoord,time,part),yp=expandedSurfacePoint(name,uCoord,vCoord+h,time,part),ym=expandedSurfacePoint(name,uCoord,vCoord-h,time,part);
  points.push({name,shape,time,part,uCoord,vCoord,p,u:xp.map((x,i)=>(x-xm[i])/(2*h)),v:yp.map((x,i)=>(x-ym[i])/(2*h))});
 }
 for(const time of [0,24])for(let part=0;part<64;part++){const uCoord=.37,vCoord=.61,p=expandedSurfacePoint(name,uCoord,vCoord,time,part),xp=expandedSurfacePoint(name,uCoord+h,vCoord,time,part),xm=expandedSurfacePoint(name,uCoord-h,vCoord,time,part),yp=expandedSurfacePoint(name,uCoord,vCoord+h,time,part),ym=expandedSurfacePoint(name,uCoord,vCoord-h,time,part);points.push({name,shape,time,part,uCoord,vCoord,p,u:xp.map((x,i)=>(x-xm[i])/(2*h)),v:yp.map((x,i)=>(x-ym[i])/(2*h))});}
 for(const part of parts)for(const v of [0,.124999,.125,.125001,.5,.874999,.875,.875001,1])for(const x of [.35,-.20,-.68,-1.18,.13,.43,.64,1.09]){const point=[x,-.6,.19],i=creatureInfluences(name,part,v,point);influences.push({name,shape,part,v,point,indices:[...i.indices],weights:[...i.weights]});}
 for(const point of [[.31,-.29,.19],[0,0,0],[-1.36,.64,.055]]){const p=skinCreaturePoint(name,32,.61,null,[...point]);restChecks.push({name,shape,point,p});}
 updates[name]=rig.updates;
}
const files=['expanded-surfaces.ts','creature-rig.ts','shape-catalog.ts','surface-frame.ts'].map(x=>({path:'prototypes/glyph-creature/src/'+x,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(src,x))).digest('hex')}));
const destination=path.join(root,'desktop/glyph-metal-lab-v4/Tests/creature-reference.json');
const fixture={schema:1,node:process.version,three:'0.186.1',rolldown:'1.2.11',source:files,configurations,frames,points,palettes,influences,restChecks,teacherPoseUpdates:updates,loader:'Existing Rolldown/Oxc transformSync + resolution/load hooks; original TS/Three untouched; no manual source/body rewriting'};
fs.writeFileSync(destination,JSON.stringify(fixture),{flag:'wx'});
const bytes=fs.readFileSync(destination);fs.writeFileSync(path.join(root,'experiments/widget-metal-authored-v4/REFERENCE.json'),JSON.stringify({source:files,node:process.version,three:'0.186.1',fixture:path.relative(root,destination),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),counts:{frames:frames.length,points:points.length,palettes:palettes.length,influences:influences.length,restChecks:restChecks.length},teacherPoseUpdates:updates},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({bytes:bytes.length,frames:frames.length,points:points.length,palettes:palettes.length,influences:influences.length,updates}));
