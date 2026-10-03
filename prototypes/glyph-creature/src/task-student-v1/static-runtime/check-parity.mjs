import { readFile, writeFile } from 'node:fs/promises';
import { createStaticEncoder } from './encoder.mjs';

const assets = new URL('../../../../../experiments/bonsai-task-student-v1/static-candidate/assets/', import.meta.url);
const json = JSON.parse(await readFile(new URL('tokenizer.json', assets), 'utf8'));
const bytes = await readFile(new URL('table-128-float16.bin', assets));
const table = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const encoder = createStaticEncoder(json, table);
const oracle = JSON.parse(await readFile(new URL('./parity-oracle.json', import.meta.url), 'utf8'));
let maximumMeanError = 0, maximumVectorError = 0;
const failures = [], timings = [];
const difference = (a, b) => a && b ? Math.max(0, ...a.map((v, i) => Math.abs(v - b[i]))) : a === b ? 0 : Infinity;
for (const row of oracle.fixtures) {
  const result = encoder.encode(row.text), mean = result.mean && Array.from(result.mean), vector = result.vector && Array.from(result.vector);
  const ids = result.tokens.ids, pieces = result.tokens.pieces, normalization = result.tokens.normalization ?? null;
  const meanError = difference(mean, row.mean), vectorError = difference(vector, row.vector);
  maximumMeanError = Math.max(maximumMeanError, meanError); maximumVectorError = Math.max(maximumVectorError, vectorError);
  const fields = [];
  if (JSON.stringify(ids) !== JSON.stringify(row.ids)) fields.push('ids');
  if (JSON.stringify(pieces) !== JSON.stringify(row.pieces)) fields.push('pieces');
  if (normalization !== row.normalization) fields.push('normalization');
  if (result.hold !== row.hold) fields.push('hold');
  if (result.unknownFraction !== row.unknownFraction) fields.push('unknownFraction');
  if (meanError > 2e-6) fields.push('mean');
  if (vectorError > 2e-6) fields.push('vector');
  if (fields.length) failures.push({ id: row.id, fields, ids, expectedIds: row.ids, pieces, expectedPieces: row.pieces, normalization, expectedNormalization: row.normalization, meanError, vectorError });
  timings.push({ id: row.id, tokenizeMs: result.tokenizeMs, encodeMs: result.encodeMs });
}
const report = { fixtures: oracle.fixtures.length, passed: oracle.fixtures.length - failures.length, failures, maximumMeanError, maximumVectorError, tolerance: 2e-6, encoder: encoder.inspect(), timings,
  semanticQualityEvaluation: false, note: 'Public artificial implementation fixtures only; no evaluation holdout read. Typed buffer bytes are not process or widget RAM.' };
await writeFile(new URL('./parity-js-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, timings: undefined, failures: failures.slice(0, 8) }, null, 2));
if (failures.length) process.exitCode = 1;
