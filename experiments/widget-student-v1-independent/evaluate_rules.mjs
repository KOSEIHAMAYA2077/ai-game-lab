// Compare the preserved explicit-rule Program interpreter on the frozen fixture.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import os from 'node:os';

const dir = dirname(fileURLToPath(import.meta.url)), repo = resolve(dir, '../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fixtureBytes = await readFile(resolve(dir, 'fixture-90-v1.json'));
if (sha(fixtureBytes) !== '77c46e0a966af39b7501c5d1d00530056fa53413c39a9e5dccf23956d9fb893b') throw new Error('Fixture changed.');
const fixture = JSON.parse(fixtureBytes);
const sourcePath = resolve(repo, 'prototypes/glyph-creature/src/program-rules.ts');
const sourceBytes = await readFile(sourcePath);
const compilerSourcePath = resolve(repo, 'prototypes/glyph-creature/src/scaffold-program.ts');
const compilerSource = await readFile(compilerSourcePath);
if (sha(compilerSource) !== '699e0ec1d3f5ec16b8ab19a8b5fe498d09a625395b3a739052aa9d542a5e6aa8') throw new Error('Compiler changed from student freeze-1.');
const ruleRuntime = stripTypeScriptTypes(sourceBytes.toString(), { mode: 'strip' });
const importStart = performance.now();
const runtime = await import('data:text/javascript;base64,' + Buffer.from(ruleRuntime).toString('base64'));
const importMs = performance.now() - importStart;
const geometryRuntime = await import(pathToFileURL(resolve(repo, '.local/widget-student-runtime/scaffold-program.mjs')));
const predictions = [];
for (const test of fixture.cases) {
  const start = performance.now();
  try {
    const result = runtime.ruleProgramResolution(test.text);
    predictions.push({ id: test.id, text: test.text, ...result, elapsed_ms: performance.now() - start, error: null });
  } catch (error) {
    predictions.push({ id: test.id, text: test.text, program: null, elapsed_ms: performance.now() - start, error: String(error) });
  }
}
const geometryStart = performance.now();
for (const prediction of predictions) {
  if (!prediction.program || prediction.error) continue;
  try {
    const compiled = geometryRuntime.compileScaffoldProgram(prediction.program);
    if (!compiled) { prediction.geometry = { compiled: false, finite: false, sample_count: 0 }; continue; }
    let finite = Number.isFinite(compiled.area) && Number.isFinite(compiled.scale), samples = 0;
    for (const time of [0, 7, 19]) for (let index = 0; index < compiled.parts.length; index++) {
      for (let id = 0; id < 128; id++) {
        const point = [0, 0, 0], du = [0, 0, 0], dv = [0, 0, 0];
        geometryRuntime.programPartSurface(compiled, index, id, time, 41, point, du, dv);
        finite &&= [...point, ...du, ...dv].every(Number.isFinite); samples++;
      }
      for (const chart of compiled.parts[index].charts) for (const around of [0, .125, .5, .875]) for (const along of [0, .001, .5, .999, 1]) {
        finite &&= geometryRuntime.compiledPartSurfacePoint(compiled, index, around, along, time, chart.chart).every(Number.isFinite); samples++;
      }
    }
    const through = compiled.source.relation?.kind === 'through';
    const throughMaterial = through ? !!compiled.throughCheck?.atTimes?.length && compiled.throughCheck.atTimes.every(value => value.insideCount > 0 && value.outsideCount > 0) : undefined;
    prediction.geometry = { compiled: true, finite, sample_count: samples,
      ...(through ? { through_material: throughMaterial, through_check: compiled.throughCheck } : {}), adjustments: compiled.adjustments };
  } catch (error) { prediction.geometry = { compiled: false, finite: false, sample_count: 0, error: String(error) }; }
}
if (sha(await readFile(sourcePath)) !== sha(sourceBytes) || sha(await readFile(compilerSourcePath)) !== sha(compilerSource)) throw new Error('Baseline changed during evaluation.');
const output = { version: 1, model_name: 'preserved-program-rules-0.13-independent-90', created_utc: new Date().toISOString(),
  frozen_manifest: { rules_source_sha256: sha(sourceBytes), rules_source_last_commit: '50b12b6de0e9a27b4f93a9910aad1582071a43de',
    compiler_source_sha256: sha(compilerSource), fixture_sha256: sha(fixtureBytes), scorer_sha256: sha(await readFile(resolve(dir, 'score.py'))),
    compiler_runtime_sha256: sha(await readFile(resolve(repo, '.local/widget-student-runtime/scaffold-program.mjs'))), verified_before: true, verified_after: true },
  environment: { runtime: process.version, platform: process.platform, architecture: process.arch, cpu_model: os.cpus()[0]?.model },
  resource_measurements: { module_import_ms: importMs, geometry_validation_ms: performance.now() - geometryStart,
    whole_app_physical_footprint_bytes: null, note: 'Direct synchronous Node calls; no production browser path or app RAM measurement.' }, predictions };
const resultDir = resolve(dir, 'results'); await mkdir(resultDir, { recursive: true });
const outputPath = resolve(resultDir, 'rules-preserved-first-pass.json');
await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output: outputPath, cases: predictions.length, programs: predictions.filter(prediction => prediction.program).length }));
