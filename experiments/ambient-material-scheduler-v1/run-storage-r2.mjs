import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import * as scheduler from './scheduler.mjs';
import { streams } from './streams.mjs';
import { serializeStorageR2 } from './storage-export-r2.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const outputName = process.argv[2] ?? 'results-r2-storage-regression';
if (!/^results-[A-Za-z0-9_-]+$/.test(outputName)) throw new Error('Output must remain in this experiment');
const outputDir = path.join(HERE, outputName);
if (fs.existsSync(outputDir)) throw new Error('Use a new output directory');
fs.mkdirSync(outputDir, { recursive: true });
const sha = name => createHash('sha256').update(fs.readFileSync(path.join(HERE, name))).digest('hex');
const method = JSON.parse(fs.readFileSync(path.join(HERE, 'R2-STORAGE-METHOD.json')));
assert.equal(sha('scheduler.mjs'), method.r1SchedulerSha256);
assert.equal(sha('streams.mjs'), method.r1StreamsSha256);
assert.equal(sha('METHOD.json'), method.r1MethodSha256);
const original = JSON.parse(fs.readFileSync(path.join(HERE, 'results-r1-first/raw.json')));
const forbidden = new Set(['body', 'text', 'id', 'ids', 'material', 'originSeq', 'originEpoch', 'seq', 'evidenceSeq',
  'unitIds', 'colorSequence', 'query', 'window', 'recent', 'dictionary', 'fingerprint', 'textHash']);
let assertions = 0;
function inspectOff(node) {
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    assertions++; assert.ok(!forbidden.has(key), `No raw/ordinal/order/source field in R2 off export: ${key}`);
    inspectOff(value);
  }
}
function replay(stream, policy) {
  let state = scheduler.createScheduler({ ...stream.config, policy });
  let generatedSeq = 0; let epoch = 0;
  for (const at of [...new Set(stream.events.map(row => row.at))].sort((a, b) => a - b)) {
    for (const spec of stream.events.filter(row => row.at === at)) {
      const seq = spec.seq ?? generatedSeq + 1; generatedSeq = Math.max(generatedSeq, seq);
      if (spec.kind === 'focus') epoch++;
      state = scheduler.accept(state, { ...spec, seq, epoch: spec.epoch ?? epoch }).state;
    }
    state = scheduler.advanceTo(state, at);
  }
  return scheduler.advanceTo(state, stream.horizon);
}
const start = performance.now(); const started = new Date().toISOString();
const raw = []; const failures = [];
for (const stream of streams) for (const policy of ['per-word', 'batch', 'batch-hysteresis']) {
  const state = replay(stream, policy);
  const previous = original.find(row => row.stream === stream.id && row.policy === policy);
  const output = serializeStorageR2(state);
  try {
    assertions++; assert.deepEqual(state.metrics, previous.finalExport.metrics, 'R2 cannot change scheduler metrics');
    assertions++; assert.equal(state.shape, previous.finalExport.shape, 'R2 cannot change scheduler shape');
    assertions++; assert.equal(state.body.map(row => row.text).join(''), stream.expected.text, 'R2 cannot change original material');
    assertions++; assert.deepEqual(output.counts.inkCounts, state.body.reduce((counts, row) => ({ ...counts, [row.ink]: counts[row.ink] + 1 }),
      { white: 0, blue: 0, green: 0, purple: 0 }), 'R2 color aggregates are accurate');
    if (state.rawSavingOff) {
      inspectOff(output);
      assertions++; assert.ok(!JSON.stringify(output).includes('PRIVATE_LITERAL_'), 'no synthetic private marker');
    } else {
      assertions++; assert.equal(output.body.map(row => row.text).join(''), stream.expected.text, 'explicit saving-on body');
    }
    raw.push({ stream: stream.id, policy, passed: true, exposedR1Regression: true, export: output });
  } catch (error) {
    failures.push({ stream: stream.id, policy, message: error.message, stack: error.stack });
    raw.push({ stream: stream.id, policy, passed: false, exposedR1Regression: true, export: output });
  }
}
const mutationResults = [];
const source = fs.readFileSync(path.join(HERE, 'storage-export-r2.mjs'), 'utf8');
fs.mkdirSync(path.join(outputDir, 'mutants'));
for (const [id, insertion] of [
  ['ordinal-id-leak', 'result.ids = state.body.map(unit => unit.id);'],
  ['body-text-leak', 'result.text = state.body.map(unit => unit.text).join("");'],
  ['color-order-leak', 'result.colorSequence = state.body.map(unit => unit.ink);'],
]) {
  const filename = path.join(outputDir, 'mutants', `${id}.mjs`);
  fs.writeFileSync(filename, source.replace('return result;', insertion + ' return result;'));
  const mutant = await import(pathToFileURL(filename).href);
  let caught = null;
  try { inspectOff(mutant.serializeStorageR2(replay(streams.find(row => row.id === 'raw-saving-off'), 'batch'))); }
  catch (error) { caught = error.message; }
  assertions++; assert.ok(caught, `Tests detect ${id}`);
  mutationResults.push({ id, detected: !!caught, failure: caught });
}
const summary = {
  version: method.version, authoredAfterR1Results: true, exposedR1Regression: true,
  started, finished: new Date().toISOString(), elapsedMs: performance.now() - start,
  policyRuns: raw.length, passed: raw.filter(row => row.passed).length, assertions,
  mutations: mutationResults.length, detectedMutations: mutationResults.filter(row => row.detected).length,
  schedulerMetricsUnchanged: failures.length === 0, failures,
  hashes: Object.fromEntries(['R2-STORAGE-METHOD.json', 'storage-export-r2.mjs', 'run-storage-r2.mjs',
    'METHOD.json', 'streams.mjs', 'scheduler.mjs', 'results-r1-first/summary.json'].map(name => [name, sha(name)])),
};
fs.writeFileSync(path.join(outputDir, 'raw.json'), JSON.stringify(raw, null, 2) + '\n');
fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
fs.writeFileSync(path.join(outputDir, 'mutations.json'), JSON.stringify(mutationResults, null, 2) + '\n');
fs.writeFileSync(path.join(outputDir, 'failures.json'), JSON.stringify(failures, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exitCode = 1;
