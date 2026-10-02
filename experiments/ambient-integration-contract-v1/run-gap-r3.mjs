import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createReceiver, receive, advanceTo, inspect } from './receiver-r3.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(here, file))).digest('hex');
for (const [file, hash] of Object.entries({
  'R3-METHOD.json': '480da1bfa6052bc403e5b72d3546333926dec739d5ac93ad778f3633435510ff',
  'R3-GAP-CASES.json': '8f97d5d951cd43b2a08f38b4d16b055b6ab6d83d01eb7c7307966553f70cede9',
  'receiver-r3.mjs': 'd72e7931fb601104f70929d7ce0ceb60756b968fc540a59698f2c08dc1e9cb6d',
})) if (digest(file) !== hash) throw new Error(`frozen file changed ${file}`);
const fixtures = JSON.parse(fs.readFileSync(path.join(here, 'R3-GAP-CASES.json'))).cases;
const output = process.argv[2] ?? 'results-gap-r3.json';
if (!/^[A-Za-z0-9_-]+\.json$/.test(output)) throw new Error('new result filename required');
let assertions = 0, calls = 0;
const runs = [];
for (const fixture of fixtures) {
  const s = createReceiver(), decisions = [], failures = [];
  function send(source, seq, kind, data, serial, at = s.now, evidence = 'none') {
    const e = { grammar: 'ambient.integration.v1', source, session: 'lab', seq, kind, data, evidence, focusEpoch: 1, policyEpoch: 0, observedAt: at };
    if (serial !== undefined) { e.serial = serial; e.operationId = `e1-p0-c${serial}`; }
    calls++; const ack = receive(s, e, at); decisions.push({ e, ack }); return e;
  }
  function check(expected, phase, extra = {}) {
    const value = { ...inspect(s), ...extra };
    for (const [key, desired] of Object.entries(expected)) {
      const actual = key === 'sourceSeq' ? Object.fromEntries(Object.keys(desired).map(k => [k, value.sourceSeq[k]])) : value[key];
      assertions++; if (!isDeepStrictEqual(actual, desired)) failures.push({ phase, key, actual, expected: desired });
    }
  }
  send('system', 1, 'focus', { field: 'normal', documentId: 'docA' });
  if (fixture.id === 'G03') {
    send('sender', 1, 'explicit-send', { text: 'box', ink: 'blue', selectionDeclared: true, documentId: null, documentVersion: null }, 1, 0, 'synthetic-explicit-send');
    send('keys', 3, 'activity', { class: 'key', count: 2 }, undefined, 2500); advanceTo(s, 7000); check(fixture.expectedFinal, 'final');
  } else {
    send('editor', 1, 'baseline', { documentId: 'docA', version: 0, text: '' });
    send('system', 2, 'admission-ready', { ready: false });
    const pending = send('editor', 2, 'document-edit', { documentId: 'docA', baseVersion: 0, version: 1, reason: 'type', ink: 'green', changes: [{ offset: 0, deleteCount: 0, text: '待' }] }, 1, 0, 'synthetic-commit');
    Object.freeze(pending.data.changes[0]); Object.freeze(pending.data.changes); Object.freeze(pending.data); Object.freeze(pending);
    if (fixture.activitySeq) send('keys', fixture.activitySeq, 'activity', { class: 'key', count: 1 }, undefined, 100);
    else send('echo', 3, 'document-edit', { documentId: 'docA', baseVersion: 0, version: 1, reason: 'type', ink: 'blue', changes: [{ offset: 0, deleteCount: 0, text: '観測' }] }, undefined, 100, 'document-only');
    check(fixture.expectedDuring, 'during');
    send('system', 3, 'admission-ready', { ready: true }, undefined, 200);
    calls++; const ack = receive(s, pending, 200); decisions.push({ sameFrozenEventRetry: true, ack });
    check(fixture.expectedFinal, 'final', { retryAdded: ack.added });
  }
  runs.push({ id: fixture.id, expected: fixture, actual: inspect(s), decisions, failures, passed: !failures.length });
}
const result = { version: 'ambient-integration-r3-gap-regression', syntheticOnly: true, fixtures: 4,
  passed: runs.filter(r => r.passed).length, failed: runs.filter(r => !r.passed).length, assertions, receiveCalls: calls,
  sourceSha256: digest('receiver-r3.mjs'), fixtureSha256: digest('R3-GAP-CASES.json'), runnerSha256: digest('run-gap-r3.mjs'), runs };
fs.writeFileSync(path.join(here, output), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ ...result, runs: undefined }, null, 2)); process.exitCode = result.failed ? 1 : 0;
