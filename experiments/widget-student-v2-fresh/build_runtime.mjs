// Read frozen repository artifacts; write only this owned experiment/runtime.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
const dir=dirname(fileURLToPath(import.meta.url)),repo=resolve(dir,'../..'),out=resolve(dir,'runtime');
await mkdir(out,{recursive:true});
const model=await readFile(resolve(repo,'experiments/widget-student-v1/student-model.json'),'utf8');
const manifest={createdAtUtc:new Date().toISOString(),sourceHashes:{},modelHash:createHash('sha256').update(model).digest('hex'),transform:'Node stripTypeScriptTypes(mode=strip); JSON inlined and only local import extensions rewritten'};
for(const name of ['scaffold-program','widget-student','widget-student-guard-v2','program-rules']) {
  let source=await readFile(resolve(repo,`prototypes/glyph-creature/src/${name}.ts`),'utf8');
  manifest.sourceHashes[`prototypes/glyph-creature/src/${name}.ts`]=createHash('sha256').update(source).digest('hex');
  if(name==='widget-student')source=source.replace(/import frozen from [^;]+;/u,`const frozen = ${model};`);
  source=source.replace(/from '\.\/(scaffold-program|widget-student)';/gu,"from './$1.mjs';");
  await writeFile(resolve(out,`${name}.mjs`),stripTypeScriptTypes(source,{mode:'strip'}));
}
await writeFile(resolve(dir,'runtime-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Built read-only-source runtime in experiment/runtime.');
