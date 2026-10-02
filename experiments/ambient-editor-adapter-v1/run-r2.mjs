import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { isDeepStrictEqual } from 'node:util';
import { createAdapter, singleDiff } from './adapter-r2.mjs';
import { validateStorage } from '../ambient-integration-contract-v1/storage-gate.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for (const [file, sha] of Object.entries({ 'METHOD.json': '44b3ca2cbf1b6c367d976a4db5b63898f3be6fa9f33e765e755b3d49a7485bde',
  'CASES.json': '8bea9ef42e785d0d7225947925f9702292fee9db5d300cabe0c8078bdd8b816b',
  'adapter.mjs': '32485a02209b85158e536afecc03edf0b7be79f03908e28453ff386c1994066a',
  'adapter-r2.mjs': '4687bf833752b138a5db4a39803dcdde58359fbb10a7540658f80282d4cb9540',
  'R2-METHOD.json': '8290ad3a0763189fd4634054a0a44040dcf03c7aa91c23241f896c55ce83967b',
  'R2-LIFECYCLE-CASES.json': '2b7312085b4daf948c9e38044f65f2ae1b3924e889ff3c2d871ada64df53a0d3' })) if (hash(path.join(HERE, file)) !== sha) throw new Error(`frozen file changed: ${file}`);
if (hash(path.join(REPO, 'experiments/ambient-integration-contract-v1/receiver-r3.mjs')) !== 'd72e7931fb601104f70929d7ce0ceb60756b968fc540a59698f2c08dc1e9cb6d') throw new Error('receiver R3 changed');
const fixtures = JSON.parse(fs.readFileSync(path.join(HERE, 'CASES.json'))).cases;
const basename = process.argv[2] ?? 'results-r2-original30-regression';
if (!/^[A-Za-z0-9_-]+$/.test(basename)) throw new Error('new output folder basename required');
const OUT = path.join(HERE, basename); fs.mkdirSync(OUT);
let assertions = 0, handleCalls = 0;
const compare = (actual, desired, label, failures) => { assertions++; if (!isDeepStrictEqual(actual, desired)) failures.push({ label, actual, expected: desired }); };
function check(actual, expected, label, failures) { for (const [k, value] of Object.entries(expected)) compare(actual[k], value, `${label}.${k}`, failures); }
class FakeTextarea {
  constructor(value, start, end) { this.tagName = 'TEXTAREA'; this.value = value; this.selectionStart = start ?? value.length; this.selectionEnd = end ?? this.selectionStart; this.readOnly = false; this.listeners = new Map(); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type) { this.listeners.delete(type); }
}
const started = performance.now(), runs = [];
for (const fixture of fixtures) {
  let clock = 0, forbiddenReads = 0;
  const value = fixture.initialRepeat ? fixture.initialRepeat.text.repeat(fixture.initialRepeat.count) : fixture.initial ?? '';
  const element = new FakeTextarea(value, fixture.start, fixture.end);
  const adapter = createAdapter({ element, clock: () => clock, ...fixture.config }), failures = [], traces = [];
  try {
    for (let i = 0; i < fixture.events.length; i++) {
      const step = fixture.events[i]; clock = step.at ?? clock;
      if (step.check) check(adapter.inspectVolatile(), step.check, `${fixture.id}.check${i}`, failures);
      else if (step.action) {
        if (step.action === 'advance') adapter.advance(clock);
        else if (step.action === 'ready') adapter.setAdmissionReady(step.ready, clock);
        else if (step.action === 'retry') adapter.retry(clock);
        else if (step.action === 'setInk') adapter.setInk(step.ink);
        else throw new Error('unknown test action');
      } else {
        if (step.value !== undefined) { element.value = step.value; element.selectionStart = element.selectionEnd = step.value.length; }
        if (step.start !== undefined) element.selectionStart = step.start;
        if (step.end !== undefined) element.selectionEnd = step.end;
        const event = { type: step.kind, target: step.target === 'foreign' ? {} : element, inputType: step.inputType,
          data: step.data, isTrusted: step.isTrusted ?? true, isComposing: step.isComposing ?? false,
          ctrlKey: step.ctrlKey ?? false, metaKey: step.metaKey ?? false, defaultPrevented: false };
        const unreadable = () => { forbiddenReads++; throw new Error('forbidden payload/clipboard read'); };
        if (step.forbiddenClipboard) {
          Object.defineProperty(event, 'clipboardData', { get: unreadable }); Object.defineProperty(event, 'dataTransfer', { get: unreadable });
          event.getTargetRanges = unreadable;
        }
        if (step.unreadablePayload) { Object.defineProperty(event, 'data', { get: unreadable }); Object.defineProperty(event.target, 'value', { get: unreadable }); }
        const prior = [...adapter.readBody()]; handleCalls++; adapter.handle(event);
        const after = [...adapter.readBody()];
        compare(after.slice(0, prior.length), prior, `${fixture.id}.step${i}.historicalIDinkRetention`, failures);
      }
      const privateValue = adapter.inspectVolatile();
      compare(privateValue.units <= (fixture.config?.bodyLimit ?? 256), true, `${fixture.id}.bodyBound`, failures);
      compare(privateValue.ids, Array.from({ length: privateValue.units }, (_, j) => j + 1), `${fixture.id}.soleReceiverIDSequence`, failures);
      compare(privateValue.document.length <= 512, true, `${fixture.id}.documentBound`, failures);
      compare(validateStorage(adapter.exportState()).valid, true, `${fixture.id}.recursiveOffExport`, failures);
      compare(Object.values(adapter.snapshot()).some(value => Array.isArray(value)), false, `${fixture.id}.statusNoIdentityArrays`, failures);
      traces.push({ index: i, at: clock, kind: step.kind ?? step.action ?? 'check', artificialVolatileObservation: privateValue });
    }
    const actual = { ...adapter.inspectVolatile(), forbiddenReads };
    check(actual, fixture.expected, fixture.id, failures);
    const exported = adapter.exportState();
    compare('body' in exported || 'document' in exported || 'ids' in exported || 'query' in exported, false, `${fixture.id}.noRawExport`, failures);
    adapter.destroy(); compare(element.listeners.size, 0, `${fixture.id}.ownListenersRemoved`, failures);
    runs.push({ id: fixture.id, passed: !failures.length, failures, expected: fixture.expected, actual, exported, traces, syntheticOnly: true });
  } catch (error) { runs.push({ id: fixture.id, passed: false, failures: [...failures, { exception: error.message }], actual: adapter.inspectVolatile(), traces, syntheticOnly: true }); }
}
// Independent properties of UTF16 atomic diff, not an implementation-shaped expected loop.
const diffProbes = [];
for (const [before, after, expected] of [['a🙂b', 'a🙂漢b', [{ offset: 3, deleteCount: 0, text: '漢' }]],
  ['🙂', '😇', [{ offset: 0, deleteCount: 2, text: '😇' }]], ['é', 'é🙂', [{ offset: 2, deleteCount: 0, text: '🙂' }]], ['aa', 'aa', []]]) {
  const actual = singleDiff(before, after), failures = [];
  compare(actual, expected, 'originalUTF16AtomicDiff', failures);
  let reconstructed = before;
  for (const c of actual ?? []) reconstructed = reconstructed.slice(0, c.offset) + c.text + reconstructed.slice(c.offset + c.deleteCount);
  compare(reconstructed, after, 'atomicDiffReconstructsFullOriginal', failures);
  diffProbes.push({ before, after, expected, actual, passed: !failures.length, failures });
}
const summary = { version: 'ambient-editor-adapter-evaluation-r2-original30-regression', fixtures: runs.length, passed: runs.filter(r => r.passed).length,
  failed: runs.filter(r => !r.passed).length, diffProbesPassed: diffProbes.filter(r => r.passed).length, diffProbesTotal: diffProbes.length,
  assertions, handleCalls, elapsedMs: performance.now() - started, syntheticOnly: true,
  scope: 'Fake textarea objects and synthetic event facts; no actual DOM/UI/IME/OS/browser/native, no clipboard/network or real body text logs.',
  sourceSha256: hash(path.join(HERE, 'adapter-r2.mjs')), fixtureSha256: hash(path.join(HERE, 'CASES.json')),
  methodSha256: hash(path.join(HERE, 'METHOD.json')), runnerSha256: hash(path.join(HERE, 'run-r2.mjs')),
  receiverSha256: hash(path.join(REPO, 'experiments/ambient-integration-contract-v1/receiver-r3.mjs')),
  environment: { node: process.version, icu: process.versions.icu, platform: process.platform, architecture: process.arch } };
fs.writeFileSync(path.join(OUT, 'runs.json'), JSON.stringify(runs, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'diff-probes.json'), JSON.stringify(diffProbes, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2)); process.exitCode = summary.failed || summary.diffProbesPassed !== summary.diffProbesTotal ? 1 : 0;
