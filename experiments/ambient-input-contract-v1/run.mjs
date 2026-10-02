import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import * as implementation from './reducer.mjs';
import { fixtures } from './fixtures.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const outputName = process.argv[2] ?? 'results';
if (!/^results(?:-[A-Za-z0-9_-]+)?$/.test(outputName)) throw new Error('Output must stay in the assigned experiment folder');
const outputDir = path.join(HERE, outputName);
fs.mkdirSync(outputDir, { recursive: true });
const bodyText = state => state.body.map(x => x.text).join('');
const sha = filename => createHash('sha256').update(fs.readFileSync(path.join(HERE, filename))).digest('hex');
const byMode = (value, mode) => value?.byMode ? value.byMode[mode] : value;
let assertions = 0;
const eq = (actual, expected, label) => { assertions++; assert.deepEqual(actual, expected, label); };
const ok = (value, label) => { assertions++; assert.ok(value, label); };

function checkBounds(api, state) {
  const status = api.inspect(state);
  ok(status.bodyCount <= state.settings.maxBody, 'finite body');
  ok(status.pendingCount <= state.settings.maxPending, 'finite pending letters');
  ok(status.pendingJobs <= state.settings.maxJobs, 'finite pending jobs');
  ok(status.documentUnits <= state.settings.maxDocument, 'finite document mirror');
  ok(status.previewUnits <= state.settings.maxPreview, 'finite preview');
  ok(status.compositionUnits <= state.settings.maxEventText, 'finite composition draft');
  ok(Object.keys(state.sources).length <= state.settings.maxSources, 'fixed finite source registry');
  ok(Object.values(state.metrics).every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000), 'saturating counters');
  eq(new Set(state.body.map(x => x.id)).size, state.body.length, 'body identities are unique');
  if (state.settings.retention === 'activity-only') {
    eq(state.document, null, 'no document in activity-only');
    eq(state.composition, null, 'no draft in activity-only');
    eq(state.body, [], 'no body in activity-only');
    eq(state.pending, [], 'no text queue in activity-only');
    eq(state.preview, '', 'no preview in activity-only');
  }
}

function runFixture(api, fixture, mode, trace = true) {
  let state = api.createState({ ...fixture.config, mode });
  let lastEvent = null;
  let lastDecision = null;
  const generated = Object.fromEntries(Object.keys(state.sources).map(id => [id, 0]));
  const marks = {};
  const deferred = {};
  const events = [];
  let eventCount = 0;
  const apply = event => {
    lastEvent = event;
    const output = api.reduce(state, event);
    state = output.state; lastDecision = output.decision; eventCount++;
    checkBounds(api, state);
    if (trace && events.length < 256) events.push({
      step: eventCount, kind: event.kind, source: event.source, seq: event.seq, epoch: event.epoch,
      decision: lastDecision, status: api.inspect(state),
    });
  };
  const build = spec => {
    const source = spec.source ?? 'ownedEditor';
    const seq = spec.seq ?? ((generated[source] ?? 0) + 1);
    generated[source] = Math.max(generated[source] ?? 0, seq);
    return { ...spec, source, seq, epoch: spec.epoch ?? (spec.kind === 'focus' ? state.epoch + 1 : state.epoch) };
  };
  for (const step of fixture.steps) {
    if (!step.action) { apply(build(step)); continue; }
    if (step.action === 'repeat-last') { apply(lastEvent); continue; }
    if (step.action === 'mark') { marks[step.name] = structuredClone(state.body); continue; }
    if (step.action === 'mark-deferred') {
      eq(lastDecision.ack, false, 'deferred producer slot requires no ACK');
      ok(Object.keys(deferred).length === 0, 'producer holds at most one unacknowledged event');
      deferred[step.name] = lastEvent; continue;
    }
    if (step.action === 'retry-deferred') {
      ok(Object.keys(deferred).length <= 1 && deferred[step.name], 'same finite producer slot');
      apply(deferred[step.name]);
      if (lastDecision.ack) delete deferred[step.name];
      continue;
    }
    if (step.action === 'drain') {
      let ticks = 0;
      do {
        apply(build({ kind: 'tick', source: 'system' }));
        ticks++;
        ok(ticks <= state.settings.maxPending + 2, 'bounded drain termination');
      } while (state.pending.length);
      continue;
    }
    if (step.action !== 'check') throw new Error(`Unknown harness step: ${step.action}`);
    const status = api.inspect(state);
    for (const [key, rawExpected] of Object.entries(step.expected)) {
      const expected = byMode(rawExpected, mode);
      const label = `${fixture.id}/${mode}/${key}`;
      if (key === 'body') eq(bodyText(state), expected, label);
      else if (key === 'document') eq(state.document?.text ?? null, expected, label);
      else if (key === 'composition') eq(state.composition, expected, label);
      else if (key === 'preview') eq(state.preview, expected, label);
      else if (key === 'lastDecision') eq(lastDecision.reason, expected, label);
      else if (key === 'ack') eq(lastDecision.ack, expected, label);
      else if (key === 'inks') eq(state.body.map(x => x.ink), expected, label);
      else if (key === 'origins') eq(state.body.map(x => x.origin.document), expected, label);
      else if (key === 'idsEqual' || key === 'idsDifferent') {
        for (const [name, oldIndex, newIndex] of expected) {
          const a = marks[name]?.[oldIndex]?.id; const b = state.body[newIndex]?.id;
          ok(a !== undefined && b !== undefined, `${label}/identity exists`);
          if (key === 'idsEqual') eq(b, a, label); else ok(b !== a, label);
        }
      } else if (key === 'absent') {
        for (const marker of expected) ok(!JSON.stringify(state).includes(marker), label);
      } else if (key === 'persistedAbsent') {
        for (const marker of expected) ok(!JSON.stringify(api.serializeForPersistence(state)).includes(marker), label);
      } else if (key === 'persistedBody') {
        eq(api.serializeForPersistence(state).body?.map(x => x.text).join('') ?? '', expected, label);
      } else if (key === 'persistedHasBody') eq(Object.hasOwn(api.serializeForPersistence(state), 'body'), expected, label);
      else if (Object.hasOwn(status, key)) eq(status[key], expected, label);
      else if (Object.hasOwn(status.metrics, key)) eq(status.metrics[key], expected, label);
      else throw new Error(`Unknown oracle key: ${key}`);
    }
  }
  return { id: fixture.id, mode, purpose: fixture.purpose, passed: true, eventCount, recordedEvents: events.length,
    finalBody: bodyText(state), finalDocument: state.document?.text ?? null, status: api.inspect(state), events };
}

function probes(api) {
  const results = [];
  const activate = config => {
    let state = api.createState(config);
    state = api.reduce(state, { kind: 'focus', source: 'system', seq: 1, epoch: 1,
      context: { app: 'appA', field: 'fieldA', document: 'docA', exposure: config?.exposure ?? 'normal' } }).state;
    return state;
  };
  for (const [name, config] of [
    ['activity-only', { retention: 'activity-only' }], ['secure-field', { exposure: 'secure' }], ['unknown-field', { exposure: 'unknown' }],
  ]) {
    let reads = 0;
    const state = activate(config);
    const event = { kind: 'edit', source: 'ownedEditor', seq: 1, epoch: 1 };
    Object.defineProperty(event, 'change', { get() { reads++; throw new Error('Synthetic text payload was inspected'); } });
    const output = api.reduce(state, event);
    eq(reads, 0, `${name}/do not inspect payload`); eq(output.state.body.length, 0, `${name}/no material`);
    results.push({ id: `${name}-unreadable-payload`, payloadReads: reads, passed: true, decision: output.decision });
  }
  {
    let state = activate(); let reads = 0;
    const event = { kind: 'snapshot', source: 'unregistered', seq: 1, epoch: 1 };
    Object.defineProperty(event, 'text', { get() { reads++; throw new Error('Unknown source text was inspected'); } });
    const output = api.reduce(state, event); eq(reads, 0, 'unknown-source/do not inspect payload');
    results.push({ id: 'unknown-source-unreadable-payload', payloadReads: reads, passed: true, decision: output.decision });
  }
  {
    let state = activate({ maxEventText: 8, maxDocument: 16 });
    state = api.reduce(state, { kind: 'snapshot', source: 'ownedEditor', seq: 1, epoch: 1, version: 0, text: '' }).state;
    const output = api.reduce(state, { kind: 'edit', source: 'ownedEditor', seq: 2, epoch: 1, quality: 'known', commitSerial: 1,
      change: { baseVersion: 0, version: 1, start: 0, deleteCount: 0, text: 'OVERSIZED_MARKER' } });
    state = output.state; checkBounds(api, state);
    eq(output.decision.reason, 'invalid-change', 'oversize reject');
    ok(!JSON.stringify(state).includes('OVERSIZED_MARKER'), 'oversized payload not retained');
    results.push({ id: 'oversize-rejected-not-truncated', passed: true, decision: output.decision });
  }
  {
    let state = activate();
    const start = performance.now();
    for (let i = 1; i <= 20_000; i++) {
      state = api.reduce(state, { kind: 'activity', source: 'keys', seq: i, epoch: 1, activityClass: i % 3 ? 'key' : 'shortcut', count: 101 }).state;
      if (i % 1000 === 0) checkBounds(api, state);
    }
    eq(state.metrics.activity, 1_000_000, 'saturating activity counter'); eq(state.body.length, 0, 'key burst never material');
    results.push({ id: '20000-activity-events', passed: true, eventCount: 20_000, elapsedMs: performance.now() - start,
      stateBytes: Buffer.byteLength(JSON.stringify(state)), status: api.inspect(state) });
  }
  {
    let state = activate({ maxPreview: 1 });
    state = api.reduce(state, { kind: 'snapshot', source: 'ownedEditor', seq: 1, epoch: 1, version: 0, text: '👩' }).state;
    eq(state.preview, '', 'preview clipping cannot split a surrogate pair');
    results.push({ id: 'preview-surrogate-boundary', passed: true, status: api.inspect(state) });
  }
  {
    for (const mode of ['append-only', 'document-sync']) {
      let state = activate({ mode, maxBody: 8, maxPending: 8, maxJobs: 2, drainPerTick: 1 });
      state = api.reduce(state, { kind: 'snapshot', source: 'ownedEditor', seq: 1, epoch: 1, version: 0, text: '' }).state;
      state = api.reduce(state, { kind: 'edit', source: 'ownedEditor', seq: 2, epoch: 1, quality: 'known', commitSerial: 1, stableRevision: true,
        change: { baseVersion: 0, version: 1, start: 0, deleteCount: 0, text: 'ABCDE' } }).state;
      const output = api.reduce(state, { kind: 'edit', source: 'ownedEditor', seq: 3, epoch: 1, quality: 'known', commitSerial: 2, stableRevision: true,
        change: { baseVersion: 1, version: 2, start: 5, deleteCount: 0, text: 'FGHIJ' } });
      state = output.state; eq(output.decision.disposition, 'held', `${mode}/permanent capacity hold`);
      if (mode === 'document-sync') eq(state.pending.length, 0, 'capacity cancels older undrawn snapshot');
      checkBounds(api, state); results.push({ id: 'capacity-before-first-drain', mode, passed: true, decision: output.decision, status: api.inspect(state) });
    }
  }
  {
    // Deliberately non-cooperative producer: shows why ACK/replay is an adapter requirement.
    let state = activate({ mode: 'append-only', maxPending: 2, maxJobs: 1, drainPerTick: 1 });
    const calls = [];
    const send = event => { const output = api.reduce(state, event); state = output.state; calls.push({ kind: event.kind, seq: event.seq, decision: output.decision }); return output; };
    send({ kind: 'snapshot', source: 'ownedEditor', seq: 1, epoch: 1, version: 0, text: '' });
    send({ kind: 'edit', source: 'ownedEditor', seq: 2, epoch: 1, quality: 'known', commitSerial: 1,
      change: { baseVersion: 0, version: 1, start: 0, deleteCount: 0, text: 'A' } });
    const deferred = { kind: 'edit', source: 'ownedEditor', seq: 3, epoch: 1, quality: 'known', commitSerial: 2,
      change: { baseVersion: 1, version: 2, start: 1, deleteCount: 0, text: 'B' } };
    eq(send(deferred).decision.ack, false, 'adverse producer first event deferred');
    send({ kind: 'edit', source: 'ownedEditor', seq: 4, epoch: 1, quality: 'unknown',
      change: { baseVersion: 1, version: 2, start: 1, deleteCount: 0, text: 'C' } });
    send({ kind: 'tick', source: 'system', seq: 2, epoch: 1 });
    eq(send(deferred).decision.reason, 'duplicate-sequence', 'future same-source event prevents older retry');
    eq(bodyText(state), 'A', 'no invented recovery of lost unACKed letter');
    checkBounds(api, state);
    results.push({ id: 'noncooperative-producer-limit', passed: true, adoption: 'unsupported-adapter', lostUnACKedSyntheticText: 'B', calls, status: api.inspect(state) });
  }
  return results;
}

const started = new Date().toISOString();
const startTime = performance.now();
const raw = [];
const failures = [];
for (const fixture of fixtures) {
  for (const mode of fixture.modes ?? ['append-only', 'document-sync']) {
    try { raw.push(runFixture(implementation, fixture, mode)); }
    catch (error) { failures.push({ id: fixture.id, mode, message: String(error.message), stack: error.stack }); }
  }
}
let probeResults = [];
try { probeResults = probes(implementation); }
catch (error) { failures.push({ id: 'probe-suite', message: String(error.message), stack: error.stack }); }

const mutationResults = [];
if (failures.length === 0) {
  const original = fs.readFileSync(path.join(HERE, 'reducer.mjs'), 'utf8');
  const mutations = [
    ['capability-upgrade', "const known = event.quality === 'known' && source.committedText;", "const known = event.quality === 'known';", 'document-api-claims-known', 'append-only'],
    ['transport-replay', 'if (event.seq <= source.seq)', 'if (false && event.seq <= source.seq)', 'raw-activity-and-material', 'append-only'],
    ['unbounded-pending', 'state.pending.length >= state.settings.maxJobs || pendingCount(state) + text.length > state.settings.maxPending', 'false', 'append-backpressure-retry', 'append-only'],
    ['save-preview', 'return result;\n}', "result.preview = state.preview; return result;\n}", 'persist-off', 'append-only'],
    ['whole-revision-upgrade', "source.stableRevision && event.stableRevision === true", 'true', 'known-segment-not-whole-revision', 'document-sync'],
    ['version-gap-bypass', 'change.baseVersion !== state.document.version || state.document.needsResync', 'false', 'version-gap-and-baseline', 'append-only'],
    ['preedit-material', "ack(); state.composition.text = event.text; state.preview = preview(event.text, state.settings.maxPreview);",
      "ack(); state.composition.text = event.text; state.preview = preview(event.text, state.settings.maxPreview); state.body.push({ id: state.nextGlyphId++, text: event.text, ink: 'white', origin: { document: 'docA' } });", 'composition-once', 'append-only'],
  ];
  fs.mkdirSync(path.join(outputDir, 'mutants'), { recursive: true });
  for (const [id, needle, replacement, fixtureId, mode] of mutations) {
    ok(original.includes(needle), `mutation target exists/${id}`);
    const filename = path.join(outputDir, 'mutants', `${id}.mjs`);
    fs.writeFileSync(filename, original.replace(needle, replacement));
    const mutated = await import(pathToFileURL(filename).href);
    let caught = null;
    try { runFixture(mutated, fixtures.find(x => x.id === fixtureId), mode, false); }
    catch (error) { caught = String(error.message); }
    eq(caught !== null, true, `tests reject dangerous mutation/${id}`);
    mutationResults.push({ id, fixtureId, mode, detected: !!caught, failure: caught });
  }
}
const report = {
  contract: 'ambient-artificial-v1', started, finished: new Date().toISOString(), elapsedMs: performance.now() - startTime,
  runtime: { node: process.version, platform: process.platform, arch: process.arch, icu: process.versions.icu },
  artificialOnly: true, realOsMonitoring: false, realImeVerified: false, widgetApiImportedOrCalled: false,
  fixtureCount: fixtures.length, fixtureModeRuns: raw.length + failures.filter(x => x.mode).length,
  passedFixtureModeRuns: raw.length, probeCount: probeResults.length, assertionCount: assertions,
  actualFixtureEventCalls: raw.reduce((n, row) => n + row.eventCount, 0),
  mutationCount: mutationResults.length, detectedMutations: mutationResults.filter(x => x.detected).length,
  hashes: Object.fromEntries(['reducer.mjs', 'fixtures.mjs', 'contract.d.ts', 'CONTRACT.md', 'run.mjs'].map(name => [name, sha(name)])),
  failures,
};
fs.writeFileSync(path.join(outputDir, 'fixture-raw.json'), JSON.stringify(raw, null, 2) + '\n');
fs.writeFileSync(path.join(outputDir, 'probe-raw.json'), JSON.stringify(probeResults, null, 2) + '\n');
fs.writeFileSync(path.join(outputDir, 'mutation-raw.json'), JSON.stringify(mutationResults, null, 2) + '\n');
fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(outputDir, 'failures.json'), JSON.stringify(failures, null, 2) + '\n');
console.log(JSON.stringify({ passed: failures.length === 0, fixtureModeRuns: report.fixtureModeRuns,
  passedFixtureModeRuns: raw.length, probeCount: report.probeCount, mutationCount: report.mutationCount,
  detectedMutations: report.detectedMutations, assertionCount: assertions, failures: failures.map(x => ({ id: x.id, mode: x.mode, message: x.message })) }, null, 2));
if (failures.length) process.exitCode = 1;
