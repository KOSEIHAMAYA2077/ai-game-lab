// One Node process, one shared encoder, two frozen dense heads. Artificial
// implementation inputs only: no task evaluation examples or accuracy scores.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { createStaticEncoder, TOKENIZER_SHA256, TABLE_SHA256 } from './encoder.mjs';
import { loadDenseModel, predictDense } from '../dense-inference.mjs';

const root = new URL('../../../../../', import.meta.url);
const at = relative => new URL(relative, root);
const assets = 'experiments/bonsai-task-student-v1/static-candidate/assets/';
const modelPaths = {
  'static-seed': 'experiments/bonsai-task-student-v1/artifacts/static-seed-model.json',
  'static-bonsai8': 'experiments/bonsai-task-student-v1/artifacts/static-bonsai8-model.json',
};
const shortInputs = [
  ['sphere', '球'],
  ['train-cube-geometry', '六つの正方形の面を持つ立体'],
  ['train-vase-use', '花を生ける容器'],
  ['japanese-attrs', '長く細く曲がる'],
  ['japanese-combination', '球を赤く長くする'],
  ['ascii', 'red cube'],
  ['fullwidth', 'ＡＢＣ１２３'],
  ['combining', 'か\u3099'],
  ['greek-scalar-lower', 'ΟΣ'],
  ['emoji-unknown', '🦑🫠'],
];
const boundaries = [['512-ascii', 'A'.repeat(512)], ['512-japanese', '球'.repeat(512)],
  ['512-astral', '🦑'.repeat(512)], ['513-ascii', 'A'.repeat(513)], ['513-astral', '🦑'.repeat(513)]];
const percentile = (sorted, p) => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { samples: sorted.length, p50Ms: percentile(sorted, .5), p95Ms: percentile(sorted, .95),
    minimumMs: sorted[0], maximumMs: sorted.at(-1) };
}
function finite(result) {
  if (![result.score, result.margin, result.coverage, result.modelMs].every(Number.isFinite)) throw new Error('Nonfinite prediction');
}
global.gc?.();
const memoryBefore = process.memoryUsage();
const loadStart = performance.now();
let tokenizerBytes = await readFile(at(assets + 'tokenizer.json'));
let tableBytes = await readFile(at(assets + 'table-128-float16.bin'));
const assetDiskReadMs = performance.now() - loadStart;
const verifyStart = performance.now();
for (const [bytes, expected] of [[tokenizerBytes, TOKENIZER_SHA256], [tableBytes, TABLE_SHA256]]) {
  if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Cached asset SHA256 mismatch');
}
const assetHashMs = performance.now() - verifyStart;
const parseStart = performance.now();
let tokenizerJSON = JSON.parse(tokenizerBytes.toString('utf8'));
const tokenizerParseMs = performance.now() - parseStart;
// Large readFile buffers normally own the complete ArrayBuffer. Reuse that
// allocation, matching fetch.arrayBuffer(), rather than duplicating the table.
const tableBuffer = tableBytes.byteOffset === 0 && tableBytes.buffer.byteLength === tableBytes.byteLength
  ? tableBytes.buffer : tableBytes.buffer.slice(tableBytes.byteOffset, tableBytes.byteOffset + tableBytes.byteLength);
const encoder = createStaticEncoder(tokenizerJSON, tableBuffer);
const encoderLoadTotalMs = performance.now() - loadStart;
// Release disk buffers/JSON from the harness; peak RSS still includes their
// transient allocations and the temporary trie construction lookup.
tokenizerBytes = tableBytes = tokenizerJSON = null;
const heads = {}, headLoad = {};
for (const [name, path] of Object.entries(modelPaths)) {
  const start = performance.now(), bytes = await readFile(at(path));
  const diskReadMs = performance.now() - start;
  const decodeStart = performance.now(), model = loadDenseModel(JSON.parse(bytes.toString('utf8')));
  heads[name] = model;
  headLoad[name] = { diskBytes: bytes.byteLength, diskReadMs, parseAndDecodeMs: performance.now() - decodeStart,
    totalMs: performance.now() - start,
    float32WeightBytes: Object.values(model.heads).reduce((sum, head) => sum + head.weights.byteLength, 0),
    numericBiasCount: Object.values(model.heads).reduce((sum, head) => sum + head.bias.length, 0),
    sha256: createHash('sha256').update(bytes).digest('hex') };
}
const encoderAndBothHeadsLoadMs = performance.now() - loadStart;
global.gc?.();
const memoryAfterLoad = process.memoryUsage();

const predictions = {};
for (const [name, model] of Object.entries(heads)) {
  for (let cycle = 0; cycle < 50; cycle++) for (const [, text] of shortInputs) finite(predictDense(model, encoder, text));
  const total = [], encode = [], tokenization = [], perInput = Object.fromEntries(shortInputs.map(([id]) => [id, []]));
  let captured;
  const observedEncoder = { encode(text) { captured = encoder.encode(text); return captured; } };
  for (let cycle = 0; cycle < 500; cycle++) for (const [id, text] of shortInputs) {
    const start = performance.now(), prediction = predictDense(model, observedEncoder, text);
    const elapsed = performance.now() - start;
    finite(prediction); total.push(elapsed); encode.push(captured.encodeMs); tokenization.push(captured.tokenizeMs);
    perInput[id].push(elapsed);
  }
  predictions[name] = { warmupCalls: 50 * shortInputs.length, measuredCalls: total.length,
    encodeAndHead: stats(total), encoder: stats(encode), tokenizer: stats(tokenization),
    perInputEncodeAndHead: Object.fromEntries(Object.entries(perInput).map(([id, times]) => [id, stats(times)])) };
}
const boundaryResults = [];
for (const [id, text] of boundaries) {
  const feature = encoder.encode(text);
  const models = {};
  for (const [name, model] of Object.entries(heads)) {
    const elapsed = [];
    let result;
    for (let call = 0; call < 200; call++) {
      const start = performance.now(); result = predictDense(model, encoder, text); elapsed.push(performance.now() - start); finite(result);
    }
    if ([...text].length > 512 && result.reason !== 'input_limit') throw new Error('Dense input bound failed');
    models[name] = { reason: result.reason, encodeAndHead: stats(elapsed) };
  }
  if ([...text].length <= 512 && feature.hold === 'input_limit') throw new Error('512 scalar boundary rejected');
  if ([...text].length > 512 && feature.hold !== 'input_limit') throw new Error('513 scalar boundary accepted');
  boundaryResults.push({ id, scalars: [...text].length, utf16CodeUnits: text.length,
    encoderHold: feature.hold, tokens: feature.tokens.ids?.length ?? null, encodeMs: feature.encodeMs, models });
}
global.gc?.();
const resource = process.resourceUsage(), memoryAfterBench = process.memoryUsage(), inspection = encoder.inspect();
const report = {
  purpose: 'Implementation performance on public artificial inputs; no semantic quality measurement',
  runtime: { node: process.version, platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model,
    unicode: process.versions.unicode, icu: process.versions.icu, exposedGC: typeof global.gc === 'function' },
  configuration: { processCount: 1, encoderInstances: 1, headModels: Object.keys(heads), shortFixtureCount: shortInputs.length,
    shortFixtureScalarRange: [Math.min(...shortInputs.map(([, text]) => [...text].length)), Math.max(...shortInputs.map(([, text]) => [...text].length))],
    fixtureNames: shortInputs.map(([id]) => id), timingUnit: 'milliseconds', percentile: 'nearest rank' },
  loading: { assetDiskReadMs, assetHashMs, tokenizerParseMs, encoderInitializationMs: inspection.initializationMs,
    encoderLoadTotalMs, heads: headLoad, encoderAndBothHeadsLoadMs,
    scope: 'Local disk read, SHA256 verification, JSON parse, trie/half-lookup construction and dense head decode; excludes process startup, browser fetch and UI' },
  retainedNumericBuffers: { tableBytes: inspection.tableBytes, packedTrieAndScoresBytes: inspection.packedTrieBytes,
    halfLookupBytes: inspection.halfLookupBytes,
    encoderTotalBytes: inspection.tableBytes + inspection.packedTrieBytes + inspection.halfLookupBytes,
    denseHeadFloat32WeightBytes: Object.fromEntries(Object.entries(headLoad).map(([name, head]) => [name, head.float32WeightBytes])),
    scope: 'Exact retained typed buffers only; excludes JS strings, objects, arrays, allocator overhead, temporary allocations and UI' },
  processMemory: { beforeLoad: memoryBefore, afterLoadGC: memoryAfterLoad, afterBenchmarkGC: memoryAfterBench,
    maxRSSKiB: resource.maxRSS, maxRSSBytes: resource.maxRSS * 1024,
    scope: 'Whole single Node process peak/current RSS, including Node runtime and harness; not browser widget RAM' },
  shortInputs: predictions, boundary: boundaryResults, semanticQualityEvaluation: false,
  holdoutRead: false,
};
await writeFile(new URL('./benchmark-node-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ loading: report.loading, buffers: report.retainedNumericBuffers,
  shortInputs: Object.fromEntries(Object.entries(predictions).map(([name, result]) => [name, { total: result.encodeAndHead, encode: result.encoder }])),
  boundary: boundaryResults, processMemory: report.processMemory }, null, 2));
