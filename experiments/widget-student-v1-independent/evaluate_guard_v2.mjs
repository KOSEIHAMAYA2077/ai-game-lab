// Regression adapter: fixed classifier plus guard-v2 rules after the 90-case results were seen.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import os from 'node:os';

const dir = dirname(fileURLToPath(import.meta.url));
const repo = resolve(dir, '../..');
const fixturePath = resolve(dir, 'fixture-90-v1.json');
const freezePath = resolve(repo, 'experiments/widget-student-guard-v2/FREEZE.json');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = await readFile(fixturePath), fixture = JSON.parse(bytes);
if (sha(bytes) !== '77c46e0a966af39b7501c5d1d00530056fa53413c39a9e5dccf23956d9fb893b') throw new Error('Evaluation fixture changed.');
const freezeBytes = await readFile(freezePath), frozen = JSON.parse(freezeBytes);
const verify = async () => {
  for (const [name, expected] of Object.entries(frozen.files)) {
    if (sha(await readFile(resolve(repo, name))) !== expected) throw new Error(`Freeze mismatch: ${name}`);
  }
};
await verify();
if (frozen.evaluationStatus !== '90-case fixture already seen; future evaluation on it is regression') throw new Error('Regression status missing.');

global.gc?.();
const beforeImport = process.memoryUsage(), importStart = performance.now();
const runtime = await import(pathToFileURL(resolve(repo, '.local/widget-student-guard-v2-runtime/student-adapter.mjs')));
const importMs = performance.now() - importStart;
const afterImport = process.memoryUsage();
const geometryRuntime = await import(pathToFileURL(resolve(repo, '.local/widget-student-guard-v2-runtime/scaffold-program.mjs')));
const firstBefore = runtime.inspectWidgetStudent();
const predictions = [];
let peak = afterImport;
for (const test of fixture.cases) {
  const start = performance.now();
  let result;
  try {
    result = runtime.widgetStudentResolution(test.text);
  } catch (error) {
    predictions.push({ id: test.id, text: test.text, program: null, elapsed_ms: performance.now() - start, error: String(error) });
    continue;
  }
  const elapsed = performance.now() - start;
  predictions.push({ id: test.id, text: test.text, ...result, elapsed_ms: elapsed, error: null });
  const current = process.memoryUsage();
  peak = Object.fromEntries(Object.keys(current).map(key => [key, Math.max(peak[key] ?? 0, current[key])]));
}
// Geometry is deliberately evaluated after all inference timings and memory
// observations. It must not inflate the model-only latency distribution.
const inferenceFinished = process.memoryUsage();
const geometryStart = performance.now();
for (const prediction of predictions) {
  if (!prediction.program || prediction.error) continue;
  try {
    const compiled = geometryRuntime.compileScaffoldProgram(prediction.program);
    if (!compiled) {
      prediction.geometry = { compiled: false, finite: false, sample_count: 0 };
      continue;
    }
    let finite = Number.isFinite(compiled.area) && Number.isFinite(compiled.scale), samples = 0;
    for (const time of [0, 7, 19]) for (let index = 0; index < compiled.parts.length; index++) {
      for (let id = 0; id < 128; id++) {
        const point = [0, 0, 0], du = [0, 0, 0], dv = [0, 0, 0];
        geometryRuntime.programPartSurface(compiled, index, id, time, 41, point, du, dv);
        finite &&= [...point, ...du, ...dv].every(Number.isFinite);
        samples++;
      }
      for (const chart of compiled.parts[index].charts) {
        for (const around of [0, .125, .5, .875]) for (const along of [0, .001, .5, .999, 1]) {
          const point = geometryRuntime.compiledPartSurfacePoint(compiled, index, around, along, time, chart.chart);
          finite &&= point.every(Number.isFinite);
          samples++;
        }
      }
    }
    const through = compiled.source.relation?.kind === 'through';
    const throughMaterial = through ? !!compiled.throughCheck?.atTimes?.length && compiled.throughCheck.atTimes.every(value => value.insideCount > 0 && value.outsideCount > 0) : undefined;
    prediction.geometry = { compiled: true, finite, sample_count: samples,
      ...(through ? { through_material: throughMaterial, through_check: compiled.throughCheck } : {}),
      adjustments: compiled.adjustments };
  } catch (error) {
    prediction.geometry = { compiled: false, finite: false, sample_count: 0, error: String(error) };
  }
}
const geometryMs = performance.now() - geometryStart;
global.gc?.();
const afterGc = process.memoryUsage();
await verify();
const frozenManifest = { ...frozen, manifest_sha256: sha(freezeBytes),
  fixture_sha256: sha(bytes),
  inference_runtime_sha256: sha(await readFile(resolve(repo, '.local/widget-student-guard-v2-runtime/student-adapter.mjs'))),
  guard_runtime_sha256: sha(await readFile(resolve(repo, '.local/widget-student-guard-v2-runtime/widget-student-guard-v2.mjs'))),
  fixed_classifier_runtime_sha256: sha(await readFile(resolve(repo, '.local/widget-student-guard-v2-runtime/widget-student.mjs'))),
  compiler_runtime_sha256: sha(await readFile(resolve(repo, '.local/widget-student-guard-v2-runtime/scaffold-program.mjs'))),
  build_runtime_sha256: sha(await readFile(resolve(repo, 'experiments/widget-student-guard-v2/build_runtime.mjs'))),
  scorer_sha256: sha(await readFile(resolve(dir, 'score.py'))), verified_before: true, verified_after: true };
const output = { version: 1, model_name: 'widget-student-guard-v2-regression-90', evaluation_status: 'regression-after-fixture-seen', fixed_classifier: 'widget-student-v1-freeze-1',
  created_utc: new Date().toISOString(), frozen_manifest: frozenManifest,
  environment: { runtime: process.version, platform: process.platform, architecture: process.arch, cpu_model: os.cpus()[0]?.model, logical_cpus: os.cpus().length, total_system_memory_bytes: os.totalmem(), note: 'Node-only regression on already seen artificial inputs; not whole-app RAM or target-laptop validation.' },
  resource_measurements: { module_import_ms: importMs, initial_model_inspect: firstBefore,
    explicit_js_buffers_bytes: runtime.inspectWidgetStudent().decodedWeightBytes,
    final_model_inspect: runtime.inspectWidgetStudent(),
    node_process_before_import: beforeImport, node_process_after_import: afterImport,
    node_process_peak_during_inference: peak, node_process_inference_finished: inferenceFinished,
    node_process_after_geometry_and_gc: afterGc,
    whole_app_physical_footprint_bytes: null, geometry_validation_ms: geometryMs,
    note: 'All timings are direct synchronous calls, no new Worker per input; elapsed_ms/modelMs include guard compile. classifierMs and guardMs are separately recorded per case. Process memory includes Node harness and imports. After-GC includes geometry, so it is not an isolated interpreter delta.' }, predictions };
const resultDir = resolve(dir, 'results');
await mkdir(resultDir, { recursive: true });
const outputPath = resolve(resultDir, 'student-guard-v2-regression.json');
await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ result: outputPath, cases: predictions.length,
  programs: predictions.filter(prediction => prediction.program).length,
  holds: predictions.filter(prediction => !prediction.program).length,
  import_ms: importMs, explicit_js_buffers_bytes: runtime.inspectWidgetStudent().decodedWeightBytes,
  geometry_validation_ms: geometryMs, frozen_before_after: true }));
