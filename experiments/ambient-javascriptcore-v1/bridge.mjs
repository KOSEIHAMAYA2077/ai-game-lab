// Pure fixture evaluator. Adapted from frozen R3 Node runner, without Node/FS/clock APIs.
import { createReceiver, receive, advanceTo, inspect, exportReceiver, restartFromExport, GRAMMAR } from '../ambient-integration-contract-v1/receiver-r3.mjs';
import { latestAnswer, advance } from '../ambient-integration-contract-v1/shape-only.mjs';
import { readBody } from '../ambient-integration-contract-v1/body-view.mjs';
import { validateStorage } from '../ambient-integration-contract-v1/storage-gate.mjs';
const copy = value => JSON.parse(JSON.stringify(value)); // Input fixture is JSON, not arbitrary JS graphs.
function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, normalized(value[k])]));
  return value;
}
const equalValue = (a, b) => JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));
const repeat = r => r.text.repeat(r.count);
function expectedExpanded(value) {
  const result = copy(value);
  if (result.bodyRepeat) { result.body = repeat(result.bodyRepeat); delete result.bodyRepeat; }
  if (result.document?.textRepeat) { result.document.text = repeat(result.document.textRepeat); delete result.document.textRepeat; }
  return result;
}
function freeze(event) {
  if (event.data) {
    if (Array.isArray(event.data.changes)) { event.data.changes.forEach(Object.freeze); Object.freeze(event.data.changes); }
    Object.freeze(event.data);
  }
  return Object.freeze(event);
}
function buildEvent(blueprint, state, probe) {
  const event = { grammar: blueprint.grammar ?? GRAMMAR, source: blueprint.source, session: 'lab',
    seq: blueprint.seq, kind: blueprint.kind, observedAt: blueprint.observedAt ?? blueprint.at,
    focusEpoch: blueprint.focusEpoch ?? (blueprint.kind === 'focus' ? state.focusEpoch + 1 : state.focusEpoch),
    policyEpoch: blueprint.policyEpoch ?? (blueprint.kind === 'policy' ? state.policyEpoch + 1 : state.policyEpoch), evidence: blueprint.evidence ?? 'none' };
  if (blueprint.op !== undefined) { event.serial = blueprint.op; event.operationId = `e${event.focusEpoch}-p${event.policyEpoch}-c${blueprint.op}`; }
  if (blueprint.unreadableData) {
    Object.defineProperty(event, 'data', { enumerable: true, get() { probe.count++; throw new Error('protected artificial payload was read'); } });
    return Object.freeze(event);
  }
  const data = blueprint.answerLatest ? latestAnswer(state) : copy(blueprint.data ?? {});
  if (data.textRepeat) { data.text = repeat(data.textRepeat); delete data.textRepeat; }
  if (data.changesRepeat) { data.changes = Array.from({ length: data.changesRepeat.count }, (_, i) => ({ offset: i, deleteCount: 1, text: data.changesRepeat.text })); delete data.changesRepeat; }
  event.data = data; return freeze(event);
}
export function evaluate(fixtures) {
  if (!fixtures || !Array.isArray(fixtures.cases) || fixtures.cases.length !== 20) throw new Error('fixed synthetic20 required');
  const runs = []; let assertions = 0;
  function equal(actual, expected, label, failures) { assertions++; if (!equalValue(actual, expected)) failures.push({ label, expected, actual }); }
  function checkExpected(actual, expected, label, failures) {
    for (const [key, value] of Object.entries(expectedExpanded(expected))) {
      if (key === 'sourceSeq' || key === 'inkCounts') for (const [sub, v] of Object.entries(value)) equal(actual[key]?.[sub], v, `${label}.${key}.${sub}`, failures);
      else equal(actual[key], value, `${label}.${key}`, failures);
    }
  }
  function invariants(state, label, failures) {
    const actual = inspect(state), body = state.material.body;
    equal(body.length <= state.bodyLimit && state.bodyLimit <= 256, true, `${label}.bodyBound`, failures);
    equal(actual.ids, Array.from({ length: body.length }, (_, i) => i + 1), `${label}.soleMonotonicAllocator`, failures);
    equal(state.material.nextId, body.length + 1, `${label}.nextId`, failures);
    equal(state.material.presented >= 0 && state.material.presented <= body.length, true, `${label}.presentationBound`, failures);
    equal(actual.windowUtf16 <= 128, true, `${label}.windowBound`, failures);
    equal(state.shape.recent.length <= 64, true, `${label}.chunkBound`, failures);
    equal(state.canonical.preview.length <= 64, true, `${label}.previewBound`, failures);
    equal((state.canonical.document?.text.length ?? 0) <= 512, true, `${label}.documentBound`, failures);
    equal(actual.pendingSlots <= 1, true, `${label}.pendingSlotBound`, failures);
    equal('body' in state.canonical || 'nextId' in state.canonical || 'body' in state.shape || 'nextId' in state.shape, false, `${label}.noSecondBody`, failures);
    equal(Object.values(state.history).every(rows => rows.length <= 64), true, `${label}.historyBound`, failures);
    equal(Object.values(state.metrics).every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000), true, `${label}.counterBound`, failures);
    equal(state.history.forwarded.every((r, i) => i === 0 || r.seq === state.history.forwarded[i - 1].seq + 1), true, `${label}.normalizedContiguous`, failures);
    equal(state.history.reveals.every(r => r.count <= 4), true, `${label}.revealBound`, failures);
    equal([...readBody(state)], body.map(({ id, text, ink }) => ({ id, text, ink })), `${label}.readonlyProjection`, failures);
    for (const r of state.shape.recent) equal([r.start, r.end, r.trim, r.at, r.seq].every(Number.isSafeInteger) && r.start >= 0 && r.end > r.start && r.end <= body.length && r.trim >= 0 && !('text' in r), true, `${label}.windowRef`, failures);
  }
  function storageChecks(state, failures) {
    const exported = exportReceiver(state);
    equal(validateStorage(exported).valid, true, 'storage.strictAllowlist', failures);
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
  for (const fixture of fixtures.cases) {
    const state = createReceiver(fixture.config), failures = [], traces = [], built = [], probe = { count: 0 };
    let retry = null, retryPeak = 0, receiveCalls = 0;
    try {
      for (let i = 0; i < fixture.events.length; i++) {
        const step = fixture.events[i];
        if (step.check) { advanceTo(state, step.at); checkExpected(inspect(state), step.check, `${fixture.id}.checkpoint${i}`, failures); traces.push({ index: i, at: step.at, checkpoint: inspect(state) }); built.push(null); continue; }
        advance(state, step.at, false);
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
        traces.push({ index: i, at: step.at, observedAt: event.observedAt, source: event.source, seq: event.seq, kind: event.kind, ack, after,
          bodyView: [...readBody(state)], shapeToken: state.shape.pending ? latestAnswer(state) : null });
        if (fixture.events[i + 1]?.at !== step.at) advanceTo(state, step.at);
      }
      advanceTo(state, fixture.horizon ?? fixtures.defaults.horizon);
      const exported = storageChecks(state, failures), actual = inspect(state);
      actual.payloadReads = probe.count; actual.producerRetryPeak = retryPeak;
      actual.exportMode = state.savingOff ? 'off' : 'on'; actual.optInRequired = !state.savingOff;
      if (state.savingOff) { const restarted = inspect(restartFromExport(exported)); actual.restartUnits = restarted.units; actual.restartWindowUtf16 = restarted.windowUtf16; }
      checkExpected(actual, fixture.expected, fixture.id, failures); invariants(state, `${fixture.id}.final`, failures);
      runs.push({ id: fixture.id, passed: failures.length === 0, failures, actual, receiveCalls, exported, histories: state.history, traces,
        finalBodyView: [...readBody(state)], finalShapeToken: state.shape.pending ? latestAnswer(state) : null });
    } catch (error) { runs.push({ id: fixture.id, passed: false, failures: [...failures, { label: 'exception', message: error.message }], actual: inspect(state), receiveCalls, traces, payloadReads: probe.count }); }
  }
  return { grammar: GRAMMAR, scope: 'Synthetic20 CPU engine portability, no OS/UI/IME/realbodyinput', cases: runs.length, passed: runs.filter(r => r.passed).length, assertions,
    receiveCalls: runs.reduce((n, r) => n + r.receiveCalls, 0), actualLexicalQueryCalls: runs.reduce((n, r) => n + r.actual.queries, 0), runs };
}
export function evaluateJSON(input) { return JSON.stringify(evaluate(JSON.parse(input))); }
