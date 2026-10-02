import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { isDeepStrictEqual } from 'node:util';
import { createAdapter } from './adapter.mjs';
import { validateStorage } from '../ambient-integration-contract-v1/storage-gate.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, file))).digest('hex');
for (const [file, expected] of Object.entries({
  'R2-METHOD.json': '8290ad3a0763189fd4634054a0a44040dcf03c7aa91c23241f896c55ce83967b',
  'R2-LIFECYCLE-CASES.json': '2b7312085b4daf948c9e38044f65f2ae1b3924e889ff3c2d871ada64df53a0d3',
  'adapter.mjs': '32485a02209b85158e536afecc03edf0b7be79f03908e28453ff386c1994066a',
  '../ambient-integration-contract-v1/receiver-r3.mjs': 'd72e7931fb601104f70929d7ce0ceb60756b968fc540a59698f2c08dc1e9cb6d',
})) if (hash(file) !== expected) throw new Error(`frozen source/method changed: ${file}`);
const cases = JSON.parse(fs.readFileSync(path.join(HERE, 'R2-LIFECYCLE-CASES.json'))).cases;
const basename = process.argv[2] ?? 'results-r1-lifecycle-negative-control';
if (!/^[A-Za-z0-9_-]+$/.test(basename)) throw new Error('new output directory required');
const OUT = path.join(HERE, basename); fs.mkdirSync(OUT);
class FakeTextarea {
  constructor() { this.tagName = 'TEXTAREA'; this.value = ''; this.selectionStart = this.selectionEnd = 0; this.readOnly = false; this.listeners = new Map(); }
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener); }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); if (!this.listeners.get(type)?.size) this.listeners.delete(type); }
  count() { return [...this.listeners.values()].reduce((n, set) => n + set.size, 0); }
}
const started = performance.now(), results = [];
let assertions = 0;
for (const fixture of cases) {
  let clock = 0, failClock = false;
  const element = new FakeTextarea();
  const adapter = createAdapter({ element, clock: () => { if (failClock) throw new Error('retired clock invoked'); return clock; } });
  const event = (type, data = null) => adapter.handle({ type, data, inputType: 'insertText', isTrusted: true, isComposing: false, target: element });
  const insert = (text, at) => { clock = at; event('beforeinput', text); element.value = text; element.selectionStart = element.selectionEnd = text.length; event('input', text); };
  const duplicate = () => { try { createAdapter({ element, clock: () => clock }); return 'did-not-throw'; } catch (error) { return error.message; } };
  const staleCallbacks = () => {
    const before = { inspect: adapter.inspectVolatile(), export: adapter.exportState() };
    failClock = true;
    const stale = { get target() { throw new Error('retired payload invoked'); } };
    adapter.handle(stale); adapter.setAdmissionReady(true); adapter.retry(); adapter.advance(400);
    adapter.setVisible(true); adapter.setPaused(false); adapter.setInk('purple'); adapter.answerShape(null); adapter.destroy();
    const after = { inspect: adapter.inspectVolatile(), export: adapter.exportState() };
    return isDeepStrictEqual(before, after) && adapter.shapeRequest() === null;
  };
  const actual = {}, failures = [];
  try {
    if (fixture.id === 'L01') {
      adapter.setAdmissionReady(false, 0); insert('X', 1); clock = 2; event('blur');
      actual.lastReasonAfterBlur = adapter.snapshot().lastReason;
      actual.listenersBeforeDestroy = element.count();
      adapter.setAdmissionReady(true, 3); adapter.retry(4);
    } else if (fixture.id === 'L02') {
      insert('A', 1); actual.duplicateError = duplicate(); actual.listenersBeforeDestroy = element.count();
      adapter.destroy(); actual.duplicateAfterDestroyError = duplicate(); actual.listenersAfterDestroy = element.count();
      actual.unchangedAfterRetiredCalls = staleCallbacks();
    } else if (fixture.id === 'L03') {
      adapter.setAdmissionReady(false, 0); insert('X', 1); adapter.destroy();
      actual.lastReasonAfterDestroy = adapter.snapshot().lastReason; actual.listenersAfterDestroy = element.count();
      actual.unchangedAfterRetiredCalls = staleCallbacks();
    } else if (fixture.id === 'L04') {
      clock = 1; event('compositionstart', ''); element.value = 'か'; clock = 2; event('compositionupdate', 'か');
      adapter.destroy(); actual.listenersAfterDestroy = element.count(); actual.unchangedAfterRetiredCalls = staleCallbacks();
    } else throw new Error('unknown frozen case');
    Object.assign(actual, adapter.inspectVolatile());
    for (const [key, value] of Object.entries(fixture.expected)) { assertions++; if (!isDeepStrictEqual(actual[key], value)) failures.push({ key, actual: actual[key], expected: value }); }
    assertions++; if (!validateStorage(adapter.exportState()).valid) failures.push({ key: 'recursiveOffExport', actual: false, expected: true });
  } catch (error) { failures.push({ exception: error.message }); }
  results.push({ id: fixture.id, expected: fixture.expected, actual, passed: !failures.length, failures, syntheticOnly: true });
}
const summary = { version: 'adapter-r1-negative-control-of-r2-lifecycle-policy', total: results.length, passed: results.filter(r => r.passed).length,
  assertions, elapsedMs: performance.now() - started, sourceSha256: hash('adapter.mjs'), fixtureSha256: hash('R2-LIFECYCLE-CASES.json'),
  methodSha256: hash('R2-METHOD.json'), runnerSha256: hash('run-lifecycle-r1-negative-control.mjs'), syntheticOnly: true,
  scope: 'R2 expectations applied to preserved R1 after known failures as a sensitivity negative control, not prospective R1 evaluation; fake textarea/event objects only. No actual DOM/IME/OS claim.',
  environment: { node: process.version, icu: process.versions.icu, platform: process.platform, architecture: process.arch } };
fs.writeFileSync(path.join(OUT, 'runs.json'), JSON.stringify(results, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2)); process.exitCode = summary.passed === summary.total ? 0 : 1;
