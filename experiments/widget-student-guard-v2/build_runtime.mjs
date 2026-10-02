// New harness output; preserved student freeze-1 source/artifact are read only.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
const dir = dirname(fileURLToPath(import.meta.url));
const repo = resolve(dir,'../..'), out = resolve(repo,'.local/widget-student-guard-v2-runtime');
await mkdir(out,{recursive:true});
const model = await readFile(resolve(repo,'experiments/widget-student-v1/student-model.json'),'utf8');
const files = ['scaffold-program','widget-student','widget-student-guard-v2'];
for (const name of files) {
  let source = await readFile(resolve(repo,'prototypes/glyph-creature/src/'+name+'.ts'),'utf8');
  if (name==='widget-student') source=source.replace(/import frozen from [^;]+;/u,`const frozen = ${model};`);
  source=source.replace(/from '\.\/(scaffold-program|widget-student)';/gu,"from './$1.mjs';");
  await writeFile(resolve(out,name+'.mjs'),stripTypeScriptTypes(source,{mode:'strip'}));
}
await writeFile(resolve(out,'student-adapter.mjs'),`export { widgetStudentGuardV2Resolution as widgetStudentResolution } from './widget-student-guard-v2.mjs';\nexport { inspectWidgetStudent } from './widget-student.mjs';\n`);
console.log(out);
