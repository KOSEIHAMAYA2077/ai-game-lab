import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import * as scheduler from './scheduler.mjs';
import { streams } from './streams.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const outputName = process.argv[2] ?? 'results-r1';
if (!/^results-[A-Za-z0-9_-]+$/.test(outputName)) throw new Error('Output must remain in this experiment');
const outputDir = path.join(HERE, outputName);
if (fs.existsSync(outputDir)) throw new Error('Use a fresh output directory to preserve raw results');
fs.mkdirSync(outputDir, { recursive: true });
const sha = name => createHash('sha256').update(fs.readFileSync(path.join(HERE, name))).digest('hex');
const method = JSON.parse(fs.readFileSync(path.join(HERE, 'METHOD.json')));
assert.deepEqual(scheduler.PARAMETERS, method.proposalValues);
assert.deepEqual(scheduler.LEXICAL_GROUPS, method.lexicalGroups);
const choose = (value, policy) => value && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, 'per-word') ? value[policy] : value;
const fullText = state => state.body.map(row => row.text).join('');
const statuses = state => ({ at: state.now, shape: state.shape, bodyCount: state.body.length,
  presentedCount: state.presented, pendingPresentation: state.body.length - state.presented,
  candidate: state.candidate ? { ...state.candidate } : null, metrics: { ...state.metrics } });
let assertionAttempts = 0;

function run(stream, policy) {
  let state = scheduler.createScheduler({ ...stream.config, policy });
  let generatedSeq = 0; let epoch = 0;
  const failures = []; const trace = [];
  const admissions = [];
  const verify = (label, actual, expected) => {
    assertionAttempts++;
    try { assert.deepEqual(actual, expected, label); }
    catch (error) { failures.push({ label, expected, actual, message: error.message }); }
  };
  const truth = (label, value) => verify(label, !!value, true);
  const bounds = () => {
    truth('body bounded', state.body.length <= state.bodyLimit);
    truth('presentation cursor bounded', state.presented >= 0 && state.presented <= state.body.length);
    truth('window UTF-16 bounded', state.recent.reduce((n, row) => n + row.text.length, 0) <= scheduler.PARAMETERS.windowMaxUtf16);
    truth('recent chunks bounded', state.recent.length <= scheduler.PARAMETERS.maximumRecentChunks);
    truth('metadata histories bounded', Object.values(state.history).every(rows => rows.length <= scheduler.PARAMETERS.maximumMetadataHistory));
    truth('analysis pending one slot', state.metrics.analysisPendingSlotPeak <= 1);
    truth('presentation queue bounded', state.metrics.presentationQueuePeak <= state.bodyLimit);
    truth('saturating counters', Object.values(state.metrics).every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000));
    verify('unique ordinal body IDs', new Set(state.body.map(row => row.id)).size, state.body.length);
    verify('append IDs are never recycled', state.body.map(row => row.id), Array.from({ length: state.body.length }, (_, i) => i + 1));
  };
  const check = expected => {
    for (const [key, raw] of Object.entries(expected)) {
      const value = choose(raw, policy);
      if (key === 'text' || key === 'retainedText') verify(key, fullText(state), value);
      else if (key === 'units') verify(key, state.body.length, value);
      else if (key === 'inks') verify(key, state.body.map(row => row.ink), value);
      else if (key === 'changes') verify(key, state.metrics.actualShapeChanges, value);
      else if (key === 'analysisCalls') verify(key, state.metrics.actualLexicalAnalysisCalls, value);
      else if (key === 'cachedSamples') verify(key, state.metrics.cachedConsistencySamples, value);
      else if (key === 'reflectionMax') verify(key, state.metrics.maximumReflectionDelayMs, value);
      else if (key === 'finalShape' || key === 'shape') verify(key, state.shape, value);
      else if (key === 'presentedCount') verify(key, state.presented, value);
      else if (key === 'recentCodeUnits') verify(key, state.recent.reduce((n, row) => n + row.text.length, 0), value);
      else if (key === 'exportedBody') verify(key, Object.hasOwn(scheduler.exportMetadata(state), 'body'), value);
      else if (key === 'exportedText') verify(key, scheduler.exportMetadata(state).body.map(row => row.text).join(''), value);
      else if (key === 'absentExport') {
        for (const marker of value) truth(key, !JSON.stringify(scheduler.exportMetadata(state)).includes(marker));
      } else if (Object.hasOwn(state.metrics, key)) verify(key, state.metrics[key], value);
      else throw new Error(`Unknown oracle field: ${key}`);
    }
  };
  const timePoints = [...new Set([...stream.events.map(row => row.at), ...(stream.checks ?? []).map(row => row.at)])].sort((a, b) => a - b);
  try {
    for (const at of timePoints) {
      for (const spec of stream.events.filter(row => row.at === at)) {
        const seq = spec.seq ?? generatedSeq + 1; generatedSeq = Math.max(generatedSeq, seq);
        if (spec.kind === 'focus') epoch++;
        const event = { ...spec, seq, epoch: spec.epoch ?? epoch };
        const before = state.body.length;
        const output = scheduler.accept(state, event); state = output.state;
        if (output.decision.disposition === 'accepted') {
          verify('logical material admission has no shape delay', state.now, event.at);
          verify('logical body already added in accept', state.body.length - before, output.decision.added);
          admissions.push({ at: event.at, seq, added: output.decision.added, delayMs: state.now - event.at });
        }
        bounds(); trace.push({ kind: event.kind, seq, epoch: event.epoch, decision: output.decision, status: statuses(state) });
      }
      state = scheduler.advanceTo(state, at);
      bounds();
      for (const checkpoint of (stream.checks ?? []).filter(row => row.at === at)) {
        check(checkpoint.expected); trace.push({ kind: 'checkpoint', status: statuses(state) });
      }
    }
    state = scheduler.advanceTo(state, stream.horizon); bounds(); check(stream.expected);
    verify('visible stream eventually reveals retained body', state.presented, state.body.length);
    for (const row of state.history.changes) {
      truth('shape cannot apply expired lexical evidence', row.at < row.evidenceAt + scheduler.PARAMETERS.candidateTtlMs);
      if (policy === 'batch-hysteresis') truth('hysteresis has two timed consistent samples', row.samples >= 2);
    }
    if (policy === 'batch-hysteresis') {
      let lastAt = 0;
      for (const row of state.history.changes) {
        truth('minimum shape holding', row.at >= lastAt + scheduler.PARAMETERS.minimumShapeHoldMs); lastAt = row.at;
      }
    }
    for (const row of state.history.candidates.filter(row => Object.hasOwn(row, 'expiresAt'))) {
      verify('cache does not refresh evidence TTL', row.expiresAt, row.evidenceAt + scheduler.PARAMETERS.candidateTtlMs);
    }
    for (const row of state.history.reveals) {
      truth('bounded incremental reveal', row.count <= scheduler.PARAMETERS.revealUnitsPerTick);
    }
    const gateAt = at => {
      let visible = true; let paused = false;
      for (const row of stream.events) {
        if (row.at > at) break;
        if (row.kind === 'visibility') visible = row.value;
        if (row.kind === 'pause') paused = row.value;
      }
      return visible && !paused;
    };
    for (const row of [...state.history.analyses, ...state.history.changes, ...state.history.reveals]) {
      truth('no hidden/paused scheduled work', gateAt(row.at));
    }
    if (state.rawSavingOff) {
      const walk = node => {
        if (!node || typeof node !== 'object') return;
        for (const [key, value] of Object.entries(node)) {
          truth('R1 exports no raw body/query/window fields', !['text', 'body', 'query', 'window', 'recent', 'fingerprint', 'textHash'].includes(key));
          walk(value);
        }
      };
      walk(scheduler.exportMetadata(state));
    }
  } catch (error) { failures.push({ label: 'runtime-exception', message: error.message, stack: error.stack }); }
  return { stream: stream.id, policy, purpose: stream.purpose, passed: failures.length === 0, failures,
    admissionDelayMaximumMs: Math.max(0, ...admissions.map(row => row.delayMs)), admissions,
    originalTextEqualsFrozenExpected: fullText(state) === stream.expected.text,
    finalExport: scheduler.exportMetadata(state), trace,
    privateBodyForComparison: state.body,
  };
}

const started = new Date().toISOString(); const begin = performance.now();
const raw = [];
for (const stream of streams) {
  const sameStream = [];
  for (const policy of method.policies) { const result = run(stream, policy); sameStream.push(result); raw.push(result); }
  const reference = sameStream[0].privateBodyForComparison;
  for (const result of sameStream) {
    assertionAttempts++;
    try { assert.deepEqual(result.privateBodyForComparison, reference); result.materialUnitIdInkEqualAcrossPolicies = true; }
    catch (error) { result.materialUnitIdInkEqualAcrossPolicies = false; result.passed = false;
      result.failures.push({ label: 'material/ID/ink across policies', message: error.message }); }
  }
}
// Never persist the volatile body used only for in-process equality checks.
for (const row of raw) delete row.privateBodyForComparison;
const summary = {
  version: method.version, started, finished: new Date().toISOString(), elapsedMs: performance.now() - begin,
  runtime: { node: process.version, platform: process.platform, arch: process.arch, icu: process.versions.icu },
  artificialOnly: true, normalizedAcceptedMaterialAssumption: true, upstreamContractConnected: false,
  realOS: false, realIme: false, UI: false, widgetImports: false,
  streamCount: streams.length, policyRuns: raw.length, passedPolicyRuns: raw.filter(row => row.passed).length,
  assertionAttempts, failures: raw.filter(row => !row.passed).map(row => ({ stream: row.stream, policy: row.policy, failures: row.failures })),
  r1ExportBoundary: 'Body-unit ordinal IDs/colors allowed under frozen R1; stricter parent no-reconstructible-ID storage gate is not adopted by R1 serializer',
  hashes: Object.fromEntries(['METHOD.json', 'METHOD.md', 'LIFECYCLE.md', 'scheduler.mjs', 'streams.mjs', 'run.mjs'].map(name => [name, sha(name)])),
};
fs.writeFileSync(path.join(outputDir, 'raw.json'), JSON.stringify(raw, null, 2) + '\n');
fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
fs.writeFileSync(path.join(outputDir, 'failures.json'), JSON.stringify(summary.failures, null, 2) + '\n');
const table = raw.map(row => ({ stream: row.stream, policy: row.policy, passed: row.passed,
  changes: row.finalExport.metrics.actualShapeChanges, retained: row.finalExport.metrics.retainedMaterialUnits,
  rejected: row.finalExport.metrics.capacityRejectedUnits, searches: row.finalExport.metrics.actualLexicalAnalysisCalls,
  cachedSamples: row.finalExport.metrics.cachedConsistencySamples,
  maximumDelayMs: row.finalExport.metrics.maximumReflectionDelayMs,
  averageDelayMs: row.finalExport.metrics.actualShapeChanges ? row.finalExport.metrics.totalReflectionDelayMs / row.finalExport.metrics.actualShapeChanges : null,
  expiries: row.finalExport.metrics.candidateExpiries, invalidations: row.finalExport.metrics.candidateInvalidations,
  presentationQueuePeak: row.finalExport.metrics.presentationQueuePeak, analysisPendingSlotPeak: row.finalExport.metrics.analysisPendingSlotPeak,
  metadataDropped: row.finalExport.metrics.metadataDropped, gaps: row.finalExport.metrics.streamGapCount,
}));
fs.writeFileSync(path.join(outputDir, 'comparison.json'), JSON.stringify(table, null, 2) + '\n');
console.log(JSON.stringify({ version: summary.version, streams: streams.length, passed: summary.passedPolicyRuns,
  runs: raw.length, failures: summary.failures, hashes: summary.hashes }, null, 2));
if (summary.failures.length) process.exitCode = 1;
