// Build only this isolated interpreter into an ignored harness directory.
// Existing app entrypoints, package files and model weights are untouched.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
const dir = dirname(fileURLToPath(import.meta.url));
const repo = resolve(dir, '../..');
const out = resolve(repo, '.local/widget-student-runtime');
await mkdir(out, { recursive: true });
const model = await readFile(resolve(dir, 'student-model.json'), 'utf8');
const sources = [
  ['scaffold-program', await readFile(resolve(repo, 'prototypes/glyph-creature/src/scaffold-program.ts'), 'utf8')],
  ['widget-student', (await readFile(resolve(repo, 'prototypes/glyph-creature/src/widget-student.ts'), 'utf8')).replace(/import frozen from [^;]+;/u, `const frozen = ${model};`).replace("from './scaffold-program';", "from './scaffold-program.mjs';")],
];
for (const [name, source] of sources) {
  const result = stripTypeScriptTypes(source, { mode: 'strip' });
  await writeFile(resolve(out, name + '.mjs'), result);
}
console.log(out);
