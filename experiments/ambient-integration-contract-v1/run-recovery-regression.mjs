import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createReceiver, receive, inspect } from './receiver-r2.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(here, file))).digest('hex');
if (digest('RECOVERY-REGRESSION.json') !== '4008be420e0a054f0658a3a73d29c79fd330913bf7b75493a12d663ae28666e9') throw new Error('recovery plan changed');
const plan = JSON.parse(fs.readFileSync(path.join(here, 'RECOVERY-REGRESSION.json')));
if (digest('receiver-r2.mjs') !== plan.receiverSha256) throw new Error('receiver changed');
const s = createReceiver(), decisions = [], failures = [];
function send(source, seq, kind, data, serial, evidence = 'none') {
  const e = { grammar: 'ambient.integration.v1', source, session: 'lab', seq, kind, data, evidence,
    focusEpoch: 1, policyEpoch: 0, observedAt: decisions.length * 10 };
  if (serial !== undefined) { e.serial = serial; e.operationId = `e1-p0-c${serial}`; }
  const ack = receive(s, e, e.observedAt); decisions.push({ source, seq, kind, ack }); return ack;
}
const doc = (text, version) => ({ documentId: 'docA', version, text });
const change = (text, baseVersion, offset) => ({ documentId: 'docA', baseVersion, version: baseVersion + 1, reason: 'type', ink: 'green', changes: [{ offset, deleteCount: 0, text }] });
const selection = text => ({ text, ink: 'blue', selectionDeclared: true, documentId: null, documentVersion: null });
send('system', 1, 'focus', { field: 'normal', documentId: 'docA' });
send('editor', 1, 'baseline', doc('', 0));
send('system', 2, 'admission-ready', { ready: false });
send('editor', 2, 'document-edit', change('待', 0, 0), 1, 'synthetic-commit');
send('sender', 1, 'explicit-send', selection('侵'), 1, 'synthetic-explicit-send');
send('system', 3, 'admission-ready', { ready: true });
send('editor', 3, 'baseline', doc('観測', 5));
const newX = send('editor', 4, 'document-edit', change('X', 5, 2), 1, 'synthetic-commit');
const senderX = send('sender', 2, 'explicit-send', selection('X'), 1, 'synthetic-explicit-send');
const before = inspect(s), beforeProjection = { body: before.body, document: before.document, serial: before.serial,
  appendUnsupported: before.appendUnsupported.sort(), newEditorXAdded: newX.added, newSenderXAdded: senderX.added };
if (!isDeepStrictEqual(beforeProjection, plan.expectedBeforeRebase)) failures.push({ phase: 'ordinary-baseline', expected: plan.expectedBeforeRebase, actual: beforeProjection });
send('editor', 5, 'baseline', { ...doc('観測X', 6), operationSerialBaseline: 1 }, undefined, 'synthetic-rebase');
send('editor', 6, 'document-edit', change('Y', 6, 3), 2, 'synthetic-commit');
const after = inspect(s), afterProjection = Object.fromEntries(Object.keys(plan.expectedAfterExplicitRebase).map(k => [k, after[k]]));
if (!isDeepStrictEqual(afterProjection, plan.expectedAfterExplicitRebase)) failures.push({ phase: 'explicit-rebase', expected: plan.expectedAfterExplicitRebase, actual: afterProjection });
const result = { syntheticOnly: true, passed: !failures.length, receiveCalls: decisions.length, failures, decisions,
  beforeProjection, afterProjection, planSha256: digest('RECOVERY-REGRESSION.json'), sourceSha256: digest('receiver-r2.mjs'),
  runnerSha256: digest('run-recovery-regression.mjs'), scope: 'Post-review regression; ordinary baseline does not restore unsupported append provenance. Explicit rebase is only a synthetic declaration.' };
fs.writeFileSync(path.join(here, 'results-recovery-r2.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result, null, 2)); process.exitCode = result.passed ? 0 : 1;
