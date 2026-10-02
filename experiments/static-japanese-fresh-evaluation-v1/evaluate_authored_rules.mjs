import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const fixture = JSON.parse(fs.readFileSync(path.join(here,'fixture.json'),'utf8'));
const freeze = JSON.parse(fs.readFileSync(path.join(here,'frozen-fixture.json'),'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if (sha(path.join(here,'fixture.json')) !== freeze.fixture_sha256) throw new Error('Fixture changed');
const require = createRequire(path.join(root,'prototypes/glyph-creature/package.json'));
const vite = await import(pathToFileURL(require.resolve('vite')).href);
const entry = path.join(root,'prototypes/glyph-creature/src/language.ts');
const catalog = path.join(root,'prototypes/glyph-creature/src/shape-catalog.ts');
await vite.build({configFile:false,logLevel:'warn',build:{outDir:path.join(here,'runtime'),emptyOutDir:false,minify:false,lib:{entry,formats:['es'],fileName:()=> 'authored-rules.mjs'}}});
const rules = await import(pathToFileURL(path.join(here,'runtime/authored-rules.mjs')).href);
const output = fs.openSync(path.join(here,'authored-rules-raw.jsonl'),'wx');
// The production pure interpret() defaults to first candidate when no choose callback is passed.
// Preserve that deterministic behavior and record all candidates; no app state or random source is modified.
for (const row of fixture.rows) {
  const started = performance.now();
  const choices = rules.shapeChoices(row.text);
  const explicitChoices = rules.shapeChoices(row.text,false);
  const interpreted = rules.interpret(row.text,rules.DEFAULT_SPEC);
  const result = {...row,actual_query:row.text,choices,explicit_choices:explicitChoices,choice_ambiguity:choices.length>1,interpreted,shape_only_prediction:choices.length?interpreted.spec.shape:null,recognized_scene_prediction:interpreted.recognized?interpreted.spec.shape:null,elapsed_ms:performance.now()-started};
  fs.writeSync(output,JSON.stringify(result)+'\n');
}
fs.closeSync(output);
fs.writeFileSync(path.join(here,'authored-rules-provenance.json'),JSON.stringify({language_sha256:sha(entry),shape_catalog_sha256:sha(catalog),bundle_sha256:sha(path.join(here,'runtime/authored-rules.mjs')),evaluator_sha256:sha(fileURLToPath(import.meta.url)),fixture_sha256:freeze.fixture_sha256,interface:'shapeChoices(full_text) and interpret(full_text, DEFAULT_SPEC), default first-candidate selection; no callback/random sampling',score_scope:'Shape-only baseline accepts when shapeChoices is nonempty and uses interpreted.spec.shape. Full recognized-scene response is diagnostic because counts/colors/motion may retain default sphere without choosing a shape.',default_shape:rules.DEFAULT_SPEC.shape,choice_handling:'All candidates recorded; ambiguity is not silently converted to a hold. No model/rules/fixture mutation.',network:'No network; bundles existing local Vite dependency and source.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({rows:fixture.rows.length,positive_labels:new Set(fixture.rows.filter(r=>r.group==='positive').map(r=>r.expected_label)).size}));
