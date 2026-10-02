import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createReceiver, receive, advanceTo, inspect, exportReceiver, restartFromExport, GRAMMAR } from './receiver.mjs';
import { latestAnswer } from './shape-only.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const FROZEN = { 'METHOD.json': 'ef0aa7f0347132e73da949d7227f551b7b880ac7ad51cec9759e9466248e7f57',
  'CASES.json': 'c7ffe342746c2c83d76d2721ae39a5440af3502db9d0cdf29082daaa826be208',
  'GRAMMAR.md': '1d19c22fd2ac759237ed407c61e524ccc1da1c112b9103ff6b15109fff5e9511' };
for (const [file, sha] of Object.entries(FROZEN)) if (digest(path.join(HERE, file)) !== sha) throw new Error(`frozen input changed: ${file}`);
const method = JSON.parse(fs.readFileSync(path.join(HERE, 'METHOD.json')));
for (const [fileKey, shaKey] of [['canonicalComparison', 'canonicalComparisonSha256'], ['schedulerSource', 'schedulerSourceSha256'], ['schedulerStorage', 'schedulerStorageSha256']]) {
  if (digest(path.join(REPO, method.referencesReadOnly[fileKey])) !== method.referencesReadOnly[shaKey]) throw new Error(`reference changed: ${fileKey}`);
}
const fixtures = JSON.parse(fs.readFileSync(path.join(HERE, 'CASES.json')));
const destination = process.argv[2] ?? 'results-r1-first';
if (!/^[a-zA-Z0-9_-]+$/.test(destination)) throw new Error('new output folder basename required');
const OUT = path.join(HERE, destination); fs.mkdirSync(OUT); // Never replace earlier raw results.
let assertions = 0;
function equal(actual, expected, label, failures) {
  assertions++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ label, expected, actual });
}
const repeat = r => r.text.repeat(r.count);
function expectedExpanded(value) {
  const result = structuredClone(value);
  if (result.bodyRepeat) { result.body = repeat(result.bodyRepeat); delete result.bodyRepeat; }
  if (result.document?.textRepeat) { result.document.text = repeat(result.document.textRepeat); delete result.document.textRepeat; }
  return result;
}
function checkExpected(actual, expected, label, failures) {
  for (const [key, value] of Object.entries(expectedExpanded(expected))) {
    if (key === 'sourceSeq' || key === 'inkCounts') {
      for (const [sub, v] of Object.entries(value)) equal(actual[key]?.[sub], v, `${label}.${key}.${sub}`, failures);
    } else equal(actual[key], value, `${label}.${key}`, failures);
  }
}
function freeze(event) {
  if (event.data) {
    if (Array.isArray(event.data.changes)) { event.data.changes.forEach(Object.freeze); Object.freeze(event.data.changes); }
    Object.freeze(event.data);
  }
  return Object.freeze(event);
}
function buildEvent(blueprint, state, payloadProbe) {
  const event = { grammar: blueprint.grammar ?? GRAMMAR, source: blueprint.source, session: 'lab',
    seq: blueprint.seq, kind: blueprint.kind, observedAt: blueprint.observedAt ?? blueprint.at,
    focusEpoch: blueprint.focusEpoch ?? (blueprint.kind === 'focus' ? state.focusEpoch + 1 : state.focusEpoch),
    policyEpoch: blueprint.policyEpoch ?? (blueprint.kind === 'policy' ? state.policyEpoch + 1 : state.policyEpoch),
    evidence: blueprint.evidence ?? 'none' };
  if (blueprint.op !== undefined) { event.serial = blueprint.op; event.operationId = `e${event.focusEpoch}-p${event.policyEpoch}-c${blueprint.op}`; }
  if (blueprint.unreadableData) {
    Object.defineProperty(event, 'data', { enumerable: true, get() { payloadProbe.count++; throw new Error('protected artificial payload was read'); } });
    return Object.freeze(event);
  }
  const data = blueprint.answerLatest ? latestAnswer(state) : structuredClone(blueprint.data ?? {});
  if (data.textRepeat) { data.text = repeat(data.textRepeat); delete data.textRepeat; }
  if (data.changesRepeat) { data.changes = Array.from({ length: data.changesRepeat.count }, (_, i) => ({ offset: i, deleteCount: 1, text: data.changesRepeat.text })); delete data.changesRepeat; }
  event.data = data; return freeze(event);
}
function invariants(state, label, failures) {
  const actual = inspect(state), body = state.material.body;
  equal(body.length <= state.bodyLimit, true, `${label}.bodyBound`, failures);
  equal(actual.ids, Array.from({ length: body.length }, (_, i) => i + 1), `${label}.soleMonotonicAllocator`, failures);
  equal(state.material.nextId, body.length + 1, `${label}.nextId`, failures);
  equal(state.material.presented >= 0 && state.material.presented <= body.length, true, `${label}.presentationBound`, failures);
  equal(actual.windowUtf16 <= 128, true, `${label}.windowBound`, failures);
  equal(state.shape.recent.length <= 64, true, `${label}.chunkBound`, failures);
  equal(state.canonical.preview.length <= 64, true, `${label}.previewBound`, failures);
  equal((state.canonical.document?.text.length ?? 0) <= 512, true, `${label}.documentBound`, failures);
  equal(actual.pendingSlots <= 1, true, `${label}.pendingSlotBound`, failures);
  equal('body' in state.canonical || 'nextId' in state.canonical || 'body' in state.shape || 'nextId' in state.shape, false, `${label}.noSecondBodyAuthority`, failures);
  equal(Object.values(state.history).every(rows => rows.length <= 64), true, `${label}.metadataBounds`, failures);
  equal(Object.values(state.metrics).every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000), true, `${label}.counterBounds`, failures);
  const forwarded = state.history.forwarded;
  equal(forwarded.every((r, i) => i === 0 || r.seq === forwarded[i - 1].seq + 1), true, `${label}.normalizedContiguous`, failures);
  equal(state.history.reveals.every(r => r.count <= 4), true, `${label}.incrementalReveal`, failures);
  for (const r of state.shape.recent) equal(integerRef(r, body.length), true, `${label}.windowReferences`, failures);
}
const integerRef = (r, length) => [r.start, r.end, r.trim, r.at, r.seq].every(Number.isSafeInteger) && r.start >= 0 && r.end > r.start && r.end <= length && r.trim >= 0 && !('text' in r);
const offKeys = ['grammar', 'version', 'savingOff', 'seed', 'shape', 'now', 'count', 'presentedCount', 'inkCounts', 'counters'].sort();
function storageChecks(state, failures) {
  const exported = exportReceiver(state);
  equal(Object.keys(exported).sort(), state.savingOff ? offKeys : [...offKeys, 'body'].sort(), 'storage.allowlist', failures);
  if (state.savingOff) {
    const restored = restartFromExport(exported);
    equal(inspect(restored).units, 0, 'storage.offRestartEmpty', failures);
    equal(inspect(restored).windowUtf16, 0, 'storage.offRestartNoWindow', failures);
    equal(restored.canonical.document, null, 'storage.offRestartNoMirror', failures);
    equal(restored.shape.pending, null, 'storage.offRestartNoQuery', failures);
  } else {
    equal(exported.body, state.material.body.map(({ id, text, ink }) => ({ id, text, ink })), 'storage.onAdmittedOnly', failures);
    let rejected = false; try { createReceiver({ savingOff: false }); } catch { rejected = true; }
    equal(rejected, true, 'storage.optInRequired', failures);
  }
  return exported;
}
const started = performance.now(), runs = [];
for (const fixture of fixtures.cases) {
  const state = createReceiver(fixture.config), failures = [], traces = [], built = [], probe = { count: 0 };
  let retry = null, retryPeak = 0, receiveCalls = 0;
  try {
    for (let i = 0; i < fixture.events.length; i++) {
      const step = fixture.events[i];
      if (step.check) {
        advanceTo(state, step.at); checkExpected(inspect(state), step.check, `${fixture.id}.checkpoint${i}`, failures);
        traces.push({ index: i, at: step.at, checkpoint: inspect(state) }); built.push(null); continue;
      }
      // Ingest all events at a timestamp before the scheduler deadline of that same timestamp.
      const event = step.alias === undefined ? buildEvent(step, state, probe) : built[step.alias];
      built.push(event); receiveCalls++;
      const before = inspect(state), ack = receive(state, event, step.at), after = inspect(state);
      if (!ack.ack) {
        if (retry && retry !== event) failures.push({ label: 'producer.moreThanOneRetrySlot' });
        retry = event; retryPeak = Math.max(retryPeak, 1);
        for (const key of ['body', 'ids', 'inks', 'document', 'serial', 'normalizedSeq', 'nextId']) equal(after[key], before[key], `${fixture.id}.noAckPreserves.${key}`, failures);
        equal(after.sourceSeq[event.source], before.sourceSeq[event.source], `${fixture.id}.noAckSourceSeq`, failures);
      } else if (retry === event || ack.status === 'unsupported') retry = null;
      if (ack.added) {
        equal(after.units - before.units, ack.added, `${fixture.id}.ackAfterWholeAdd`, failures);
        equal(state.material.body.slice(0, before.units), before.ids.map((id, j) => ({ id, text: before.unitTexts[j], ink: before.inks[j] })), `${fixture.id}.oldIdentityRetained`, failures);
      }
      invariants(state, `${fixture.id}.step${i}`, failures);
      traces.push({ index: i, at: step.at, observedAt: event.observedAt, source: event.source, seq: event.seq, kind: event.kind, ack, after });
      if (fixture.events[i + 1]?.at !== step.at) advanceTo(state, step.at);
    }
    advanceTo(state, fixture.horizon ?? fixtures.defaults.horizon);
    const exported = storageChecks(state, failures), actual = inspect(state);
    actual.payloadReads = probe.count; actual.producerRetryPeak = retryPeak;
    actual.exportMode = state.savingOff ? 'off' : 'on'; actual.optInRequired = !state.savingOff;
    if (state.savingOff) { const restarted = inspect(restartFromExport(exported)); actual.restartUnits = restarted.units; actual.restartWindowUtf16 = restarted.windowUtf16; }
    checkExpected(actual, fixture.expected, fixture.id, failures);
    invariants(state, `${fixture.id}.final`, failures);
    runs.push({ id: fixture.id, maps: fixture.maps, synthetic: true, expected: fixture.expected, actual,
      receiveCalls, passed: failures.length === 0, failures, exported, histories: state.history, traces });
  } catch (error) {
    runs.push({ id: fixture.id, maps: fixture.maps, synthetic: true, expected: fixture.expected, actual: inspect(state), receiveCalls,
      passed: false, failures: [...failures, { label: 'exception', message: error.message, stack: error.stack }], traces, payloadReads: probe.count });
  }
}
const elapsedMs = performance.now() - started;
const summary = { version: 'ambient-integration-evaluation-v1-r1', fixtures: runs.length, passed: runs.filter(r => r.passed).length,
  failed: runs.filter(r => !r.passed).length, assertions, receiveCalls: runs.reduce((n, r) => n + r.receiveCalls, 0),
  actualLexicalQueryCalls: runs.reduce((n, r) => n + r.actual.queries, 0), elapsedMs,
  scope: 'Artificial clock/pure receiver only; no OS, IME, widget, real CPU/RSS/comfort, upstream losslessness or general semantic inference.',
  proposalConditionsCovered: [...new Set(runs.flatMap(r => r.maps))].sort(), frozen: FROZEN,
  sourceHashes: Object.fromEntries(['receiver.mjs', 'shape-only.mjs', 'run.mjs'].map(f => [f, digest(path.join(HERE, f))])),
  environment: { node: process.version, icu: process.versions.icu, platform: process.platform, architecture: process.arch },
  references: method.referencesReadOnly };
fs.writeFileSync(path.join(OUT, 'runs.json'), JSON.stringify(runs, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ destination, ...summary }, null, 2));
process.exitCode = summary.failed ? 1 : 0;
