import { createRequire } from 'node:module';
import { readFile,writeFile,mkdir,access } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../..');
const sha=data=>createHash('sha256').update(data).digest('hex');
const method=JSON.parse(await readFile(resolve(here,'METHOD-R1.json'),'utf8'));
for(const item of method.readOnlyInputs)if(sha(await readFile(resolve(repo,item.path)))!==item.sha256)throw new Error('read-only drift: '+item.path);
const out=resolve(here,'work/bundle-r1');
try{await access(out);throw new Error('preserve bundle');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(out,{recursive:true});
const local=createRequire(resolve(repo,'prototypes/glyph-creature/package.json'));
const {rolldown}=await import(pathToFileURL(local.resolve('rolldown')).href);
const bundle=await rolldown({input:resolve(repo,'desktop/glyph-metal-ambient-cache-v1/Sources/cache-runtime.mjs'),platform:'neutral'});
await bundle.write({file:resolve(out,'Receiver.js'),format:'iife',name:'AmbientCacheReceiver',minify:false});await bundle.close();
const data=await readFile(resolve(out,'Receiver.js'));
await writeFile(resolve(here,'BUNDLE-R1.json'),JSON.stringify({version:'cache-runtime-r1',sha256:sha(data),bytes:data.length,compiler:'Rolldown1.2.11',onlyCreateSessionExported:true,oldBundleBytesDiffer:true,coldGraphConfounding:true},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({sha256:sha(data),bytes:data.length}));
