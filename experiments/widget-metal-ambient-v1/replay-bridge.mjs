import { readFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../..');
const file=resolve(repo,process.argv[2] ?? '');
if (!process.argv[2] || !file.startsWith(resolve(here,'work')+'/')) throw new Error('new owned work output required');
try {await access(file);throw new Error('preserve old bundle');} catch(e) {if(e.code!=='ENOENT')throw e;}
const hash=data=>createHash('sha256').update(data).digest('hex');
const method=JSON.parse(await readFile(resolve(here,'METHOD.json'),'utf8'));
// The build's source/compiler graph does not depend on archived Geometry or old IIFE bytes.
for(const row of method.readOnlyInputs.filter(x=>(x.path.startsWith('experiments/ambient-') && !x.path.includes('/.runtime/')) || x.path.startsWith('prototypes/'))) {
  if(hash(await readFile(resolve(repo,row.path)))!==row.sha256)throw new Error('source/compiler drift: '+row.path);
}
await mkdir(dirname(file),{recursive:true});
const local=createRequire(resolve(repo,'prototypes/glyph-creature/package.json'));
const {rolldown}=await import(pathToFileURL(local.resolve('rolldown')).href);
const bundle=await rolldown({input:resolve(repo,'desktop/glyph-metal-ambient-v1/Sources/receiver-bridge.mjs'),platform:'neutral'});
await bundle.write({file,format:'iife',name:'AmbientNativeReceiver',minify:false});await bundle.close();
const sha=hash(await readFile(file)),expected=JSON.parse(await readFile(resolve(here,'BUNDLE-R1.json'),'utf8')).sha256;
console.log(JSON.stringify({sha256:sha,sameFrozenBundle:sha===expected}));
if(sha!==expected)process.exitCode=1;
