import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { isDeepStrictEqual } from 'node:util';
import * as r1Base from './receiver.mjs';
import { latestAnswer } from './shape-only.mjs';
import { validateStorage } from './storage-gate.mjs';
import { readBody } from './body-view.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const receiverFile = process.argv[3] === 'r2' ? 'receiver-r2.mjs' : 'receiver.mjs';
const source = fs.readFileSync(path.join(HERE, receiverFile), 'utf8');
if (receiverFile === 'receiver-r2.mjs' && hash(source) !== '96550b3131ad8275d61d5463d11f5e9f0684a8959897f6a45d8452c472df2e57') throw new Error('R2 receiver changed');
const base = receiverFile === 'receiver.mjs' ? r1Base : await import('./receiver-r2.mjs');
const shapeSource = fs.readFileSync(path.join(HERE, 'shape-only.mjs'), 'utf8');
const plan = JSON.parse(fs.readFileSync(path.join(HERE, 'PROBES-METHOD.json')));
if (hash(fs.readFileSync(path.join(HERE, 'PROBES-METHOD.json'))) !== '4229c8e1f7fbfcb6e3c7087194b315b704d27793c986d99114a7ee9f1c186954') throw new Error('probe plan changed');
for (const [f, sha] of Object.entries(plan.sourceFreeze)) if (hash(fs.readFileSync(path.join(HERE, f))) !== sha) throw new Error(`probe baseline changed: ${f}`);
const destination = process.argv[2] ?? 'results-probes-r2-first';
if (!/^[A-Za-z0-9_-]+$/.test(destination)) throw new Error('output basename required');
const OUT = path.join(HERE, destination); fs.mkdirSync(OUT);
const rows = []; let checks = 0, calls = 0;
function assert(value, expected, label, failures) { checks++; if (!isDeepStrictEqual(value, expected)) failures.push({ label, value, expected }); }
function event(s, src, kind, data, seq, op, at = s.now, evidence) {
  const e = { grammar: base.GRAMMAR, source: src, session: 'lab', seq, kind, data,
    focusEpoch: kind === 'focus' ? s.focusEpoch + 1 : s.focusEpoch, policyEpoch: s.policyEpoch, observedAt: at, evidence: evidence ?? 'none' };
  if (op !== undefined) { e.serial = op; e.operationId = `e${e.focusEpoch}-p${e.policyEpoch}-c${op}`; }
  return e;
}
const send = (api, s, e, at = e.observedAt) => { calls++; return api.receive(s, e, at); };
function focused(api = base, config) { const s = api.createReceiver(config); send(api, s, event(s, 'system', 'focus', { field: 'normal', documentId: 'docA' }, 1)); return s; }
function selection(api, s, text, seq, serial, at = s.now, ink = 'blue') {
  return send(api, s, event(s, 'sender', 'explicit-send', { text, ink, selectionDeclared: true, documentId: null, documentVersion: null }, seq, serial, at, 'synthetic-explicit-send'));
}
function baseline(api, s, text, version = 0) { return send(api, s, event(s, 'editor', 'baseline', { documentId: 'docA', text, version }, 1)); }
function edit(api, s, src, seq, serial, baseVersion, changes, at = s.now, evidence = 'synthetic-commit') {
  return send(api, s, event(s, src, 'document-edit', { documentId: 'docA', baseVersion, version: baseVersion + 1, reason: 'type', ink: 'green', changes }, seq, serial, at, evidence));
}
async function run(id, function_) {
  const failures = [], before = calls;
  try { const details = await function_(failures); rows.push({ id, passed: !failures.length, failures, receiveCalls: calls - before, details }); }
  catch (error) { rows.push({ id, passed: false, failures: [...failures, { exception: error.message }], receiveCalls: calls - before }); }
}
const started = performance.now();
await run('P01', f => {
  const s = focused(); selection(base, s, 'VOLATILE_A箱🙂', 1, 1); const value = base.exportReceiver(s);
  assert(validateStorage(value).valid, true, 'legitimate-off', f);
  const mutations = {
    text: 'VOLATILE_A', ids: [1, 2], colorOrder: ['blue', 'green'], query: '箱', window: ['箱'],
    dictionary: { 1: '箱' }, fingerprint: 'aabb', origin: [1, 0], glyphIdSequence: [10], body: [...readBody(s)],
  };
  const detections = [];
  for (const [key, leak] of Object.entries(mutations)) {
    const altered = { ...value, [key]: leak }, detected = !validateStorage(altered).valid;
    assert(detected, true, `off-leak-${key}`, f); detections.push({ key, detected });
  }
  assert(validateStorage({ ...value, counters: { ...value.counters, ids: [1] } }).valid, false, 'nested-id-leak', f);
  assert(validateStorage({ ...value, counters: { ...value.counters, queries: '箱' } }).valid, false, 'counter-string-leak', f);
  const restart = base.restartFromExport(value); assert([...readBody(restart)], [], 'off-restart', f);
  return { detections, exported: value };
});
await run('P02', f => {
  let rejected = false; try { base.createReceiver({ savingOff: false }); } catch { rejected = true; }
  assert(rejected, true, 'opt-in-required', f);
  const s = focused(base, { savingOff: false, consent: 'synthetic-opt-in' }); selection(base, s, '青🙂', 1, 1);
  assert(validateStorage(base.exportReceiver(s)).valid, true, 'explicit-on', f);
  const view = [...readBody(s)]; assert(view.map(r => r.id), [1, 2], 'sole-id-render-view', f);
  let blocked = false; try { view[0].text = '変更'; } catch { blocked = true; }
  assert(blocked, true, 'read-view-immutable', f); assert(base.inspect(s).body, '青🙂', 'view-cannot-change-authority', f);
  return { exported: base.exportReceiver(s) };
});
await run('P03', f => {
  const s = focused(); selection(base, s, 'x'.repeat(256), 1, 1); assert(s.material.body.length, 256, 'immediate-burst', f);
  base.advanceTo(s, 100); assert(s.material.presented, 4, 'small-reveal', f);
  const hold = selection(base, s, '箱', 2, 2, 200); assert(hold.reason, 'body-capacity', 'whole-capacity-hold', f); assert(hold.added, 0, 'no-partial', f);
  assert(base.inspect(s).ids, Array.from({ length: 256 }, (_, i) => i + 1), 'identity-retained', f);
  return { hold, queuePeak: s.metrics.queuePeak };
});
await run('P04', f => {
  const s = focused(); baseline(base, s, 'a'.repeat(65));
  const result = edit(base, s, 'editor', 2, 1, 0, Array.from({ length: 65 }, (_, i) => ({ offset: i, deleteCount: 1, text: 'b' })));
  assert(result.reason, 'invalid-changes', '65-edits', f); assert(base.inspect(s).document.version, 0, 'atomic-revision', f); assert(s.material.body.length, 0, 'no-added', f);
  return { result };
});
await run('P05', f => {
  const s = focused(); baseline(base, s, ''); send(base, s, event(s, 'system', 'admission-ready', { ready: false }, 2));
  const pending = edit(base, s, 'editor', 2, 1, 0, [{ offset: 0, deleteCount: 0, text: '待' }]);
  const other = selection(base, s, '次', 1, 1);
  assert(pending.ack, false, 'first-pending', f); assert(other.status, 'unsupported', 'parallel-unsupported', f);
  assert(base.inspect(s).pendingSlots, 0, 'no-second-slot', f); assert(base.inspect(s).appendUnsupported.sort(), ['editor', 'sender'], 'both-provenance-domains-invalid', f);
  assert(s.material.body.length, 0, 'no-invented-material', f); return { pending, other, state: base.inspect(s) };
});
await run('P06', f => {
  const s = focused(base, { bodyLimit: 2 }); baseline(base, s, ''); edit(base, s, 'editor', 2, 1, 0, [{ offset: 0, deleteCount: 0, text: 'AB' }]);
  const hold = edit(base, s, 'editor', 3, 2, 1, [{ offset: 2, deleteCount: 0, text: 'CD' }]);
  assert(hold, { at: 0, status: 'held', reason: 'body-capacity', ack: true, added: 0 }, 'permanent-ack', f);
  assert(base.inspect(s).body, 'AB', 'whole-body-retained', f); assert(base.inspect(s).document, { text: 'ABCD', version: 2 }, 'mirror-observation-only', f);
  assert(base.inspect(s).ids, [1, 2], 'identity-retained', f); return { state: base.inspect(s) };
});
await run('P07', f => {
  const s = focused(); for (let seq = 1; seq <= 1000; seq++) send(base, s, event(s, 'keys', 'activity', { class: 'key', count: 10000 }, seq, undefined, seq));
  assert(s.metrics.activityKeys, 1000000, 'saturation', f); assert(s.sources.keys.seq, 1000, 'watermark', f);
  assert(s.material.body.length, 0, 'no-body', f); assert(base.inspect(s).windowUtf16, 0, 'no-window', f);
  assert(Object.values(s.history).every(r => r.length <= 64), true, 'bounded-metadata', f);
  return { boundedStateUtf8Bytes: Buffer.byteLength(JSON.stringify(s)), metrics: s.metrics };
});
await run('P08', f => {
  const s = focused(base, { shapeMode: 'deferred' }); selection(base, s, 'box ', 1, 1); base.advanceTo(s, 2000);
  const old = latestAnswer(s); selection(base, s, '輪', 2, 2, 2500); assert(s.material.body.length, 5, 'new-material-not-waiting-answer', f);
  const ack = send(base, s, event(s, 'worker', 'shape-answer', old, 1, undefined, 3000));
  assert(ack.reason, 'stale-answer', 'window-token-invalidated', f); base.advanceTo(s, 3500); assert(s.shape.current, 'sphere', 'old-shape-not-applied', f);
  return { ack, state: base.inspect(s) };
});
function replaceOnce(bytes, old, replacement) {
  if (!bytes.includes(old)) throw new Error(`mutation anchor absent: ${old}`); return bytes.replace(old, replacement);
}
async function moduleFrom(bytes) { return import(`data:text/javascript;base64,${Buffer.from(bytes).toString('base64')}`); }
const shapeUrl = pathToFileURL(path.join(HERE, 'shape-only.mjs')).href;
const patchedBase = source.replace("'./shape-only.mjs'", JSON.stringify(shapeUrl));
const mutants = [
  ['M01', () => replaceOnce(replaceOnce(patchedBase, 'if (e.serial <= s.canonical.lastSerial)', 'if (false)'), 'if (e.serial !== s.canonical.lastSerial + 1)', 'if (false)'), async api => {
    const s = focused(api); selection(api, s, '輪', 1, 1); selection(api, s, '輪', 2, 1); return api.inspect(s).units !== 1;
  }],
  ['M02', () => replaceOnce(patchedBase, "s.metrics.pendingSlotPeak = Math.max", "consume(source, e); s.canonical.lastSerial = serial;\n    s.metrics.pendingSlotPeak = Math.max"), async api => {
    const s = focused(api); baseline(api, s, ''); send(api, s, event(s, 'system', 'admission-ready', { ready: false }, 2)); edit(api, s, 'editor', 2, 1, 0, [{ offset: 0, deleteCount: 0, text: '待' }]);
    return s.sources.editor.seq !== 1 || s.canonical.lastSerial !== 0;
  }],
  ['M03', () => replaceOnce(replaceOnce(patchedBase, "edit && source.commit && e.evidence === 'synthetic-commit'", 'edit && source.document'), 'if (edit && !source.primaryCommit)', 'if (false)'), async api => {
    const s = focused(api); send(api, s, event(s, 'documentApi', 'baseline', { documentId: 'docA', version: 0, text: '' }, 1)); edit(api, s, 'documentApi', 2, 1, 0, [{ offset: 0, deleteCount: 0, text: '箱' }], 0, 'document-only'); return s.material.body.length !== 0;
  }],
  ['M04', () => replaceOnce(patchedBase, 'id: s.material.nextId++', 'id: 1'), async api => {
    const s = focused(api); selection(api, s, 'AB', 1, 1); return !isDeepStrictEqual(api.inspect(s).ids, [1, 2]);
  }],
  ['M05', async () => {
    let altered = shapeSource.replace("'../ambient-material-scheduler-v1/scheduler.mjs'", JSON.stringify(pathToFileURL(path.join(HERE, '../ambient-material-scheduler-v1/scheduler.mjs')).href));
    altered = replaceOnce(altered, 'const sh = s.shape, p = sh.pending;', 'const sh = s.shape, p = sh.pending ?? { ...data, expiresAt: s.now + 6000, result: { shape: data.shape, evidenceAt: s.now, evidenceSeq: 0 } };');
    const shapeDataUrl = `data:text/javascript;base64,${Buffer.from(altered).toString('base64')}`;
    return source.replace("'./shape-only.mjs'", JSON.stringify(shapeDataUrl));
  }, async api => {
    const s = focused(api, { shapeMode: 'deferred' }); selection(api, s, 'box ', 1, 1); api.advanceTo(s, 2000);
    const old = latestAnswer(s); send(api, s, event(s, 'system', 'focus', { field: 'normal', documentId: 'docB' }, 2, undefined, 2100));
    send(api, s, event(s, 'worker', 'shape-answer', old, 1, undefined, 2500)); api.advanceTo(s, 7000); return s.shape.current !== 'sphere';
  }],
  ['M06', () => replaceOnce(patchedBase, 'if (!s.savingOff) result.body', 'if (true) result.body'), async api => {
    const s = focused(api); selection(api, s, '秘密🙂', 1, 1); return !validateStorage(api.exportReceiver(s)).valid;
  }],
];
for (const [id, bytes, detector] of mutants) await run(id, async f => {
  const mutatedSource = await bytes(), api = await moduleFrom(mutatedSource), detected = await detector(api);
  assert(detected, true, 'actual-runtime-mutant-detected', f);
  return { detected, mutatedSourceSha256: hash(mutatedSource), mutatedSource };
});
const summary = { version: 'ambient-integration-probes-r2', normal: 8, runtimeMutants: 6, passed: rows.filter(r => r.passed).length,
  failed: rows.filter(r => !r.passed).length, assertions: checks, receiveCalls: calls, elapsedMs: performance.now() - started,
  planSha256: hash(fs.readFileSync(path.join(HERE, 'PROBES-METHOD.json'))), sourceFreezeR1: plan.sourceFreeze,
  effectiveReceiver: receiverFile, effectiveReceiverSha256: hash(source),
  gateSha256: hash(fs.readFileSync(path.join(HERE, 'storage-gate.mjs'))), viewSha256: hash(fs.readFileSync(path.join(HERE, 'body-view.mjs'))),
  runnerSha256: hash(fs.readFileSync(path.join(HERE, 'run-probes.mjs'))), syntheticOnly: true,
  environment: { node: process.version, platform: process.platform, architecture: process.arch },
  limitation: 'Supplementary post-fixture regression; mutant code executes in memory, base frozen source unchanged. Artificial time/count only, no OS/IME/CPU/RSS/comfort claim.' };
fs.writeFileSync(path.join(OUT, 'probes.json'), JSON.stringify(rows, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2)); process.exitCode = summary.failed ? 1 : 0;
