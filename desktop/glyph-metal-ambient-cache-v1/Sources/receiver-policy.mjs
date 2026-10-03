// Derived from pinned R5: only transport/return plumbing changed. Native commit/cancel policy retained.
import { createReceiver, receive, advanceTo, inspect, exportReceiver } from '../../../experiments/ambient-integration-contract-v1/receiver-r3.mjs';
import { createCacheTransport } from './cache-transport.mjs';
import { validateStorage } from '../../../experiments/ambient-integration-contract-v1/storage-gate.mjs';
import { singleDiff } from '../../../experiments/ambient-editor-adapter-v1/adapter-r2.mjs';
export const TEST_SESSIONS = new WeakMap();
const INKS = new Set(['white', 'blue', 'green', 'purple']);
const integer = n => Number.isSafeInteger(n) && n >= 0;
const safeBoundary = (text, n) => integer(n) && n <= text.length && (n === 0 || n === text.length || !(text.charCodeAt(n - 1) >= 0xd800 && text.charCodeAt(n - 1) <= 0xdbff && text.charCodeAt(n) >= 0xdc00 && text.charCodeAt(n) <= 0xdfff));
const validText = text => typeof text === 'string' && text.length <= 512 && singleDiff('', text) !== null;
const literal = (a, b) => a === b;
function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([k, v]) => [k, freeze(v)])));
  return value;
}
export function createSession(receiverSession) {
  const state = createReceiver({ savingOff: true, bodyLimit: 256, shapeMode: 'inline' });
  const transport = createCacheTransport(state, receiverSession, aggregate);
  let initialized = false, composition = null, selectedInk = 'blue', compositionSerial = 0, last = { status: 'ready', reason: 'ready' }, retired = false;
  const header = (source, kind, data, options = {}) => freeze({ grammar: state.grammar, source, session: 'lab', seq: state.sources[source].seq + 1,
    focusEpoch: options.focusEpoch ?? state.focusEpoch, policyEpoch: state.policyEpoch, observedAt: state.now, evidence: options.evidence ?? 'none', kind, data,
    ...(options.serial ? { serial: options.serial, operationId: `e${state.focusEpoch}-p${state.policyEpoch}-c${options.serial}` } : {}) });
  const deliver = event => { last = receive(state, event, state.now); return last; };
  function cancel() {
    if (composition) deliver(header('editor', 'composition-cancel', { compositionId: composition.id }));
    composition = null;
  }
  function observe(value, reason = 'unknown-native-input') {
    if (!validText(value)) { last = { status: 'held', reason: 'document-limit' }; return; }
    const doc = state.canonical.document;
    if (!doc || state.canonical.needsResync) deliver(header('editor', 'baseline', { documentId: 'nativeEditor', version: (doc?.version ?? -1) + 1, text: value }));
    else {
      const changes = singleDiff(doc.text, value);
      if (changes.length) deliver(header('editor', 'document-edit', { documentId: 'nativeEditor', baseVersion: doc.version, version: doc.version + 1, reason: 'replace', ink: selectedInk, changes }, { evidence: 'document-only' }));
    }
    last = { status: 'unknown', reason };
  }
  function commit(command) {
    const doc = state.canonical.document, c = composition;
    const base = c?.base ?? command.base, range = c?.range ?? command.range;
    const text = command.text, value = command.value;
    const validRange = Array.isArray(range) && range.length === 2 && integer(range[0]) && integer(range[1]) && validText(base) && safeBoundary(base, range[0]) && safeBoundary(base, range[0] + range[1]);
    if (!doc || !validRange || !validText(value) || typeof text !== 'string' || singleDiff('', text) === null || command.postMarked === true ||
      (command.fromComposition === true && !c) || !literal(command.base, base) || !literal(doc.text, base) ||
      (c && (command.range?.[0] !== range[0] || command.range?.[1] !== range[1])) ||
      !literal(base.slice(0, range[0]) + text + base.slice(range[0] + range[1]), value)) {
      cancel(); observe(value, 'unknown-native-commit-trace'); return;
    }
    // R3 performs sole segmentation, complete material add, capacity decision and ID allocation.
    const data = { documentId: 'nativeEditor', baseVersion: doc.version, version: doc.version + 1, reason: 'type', ink: c?.ink ?? selectedInk,
      changes: [{ offset: range[0], deleteCount: range[1], text }], ...(c ? { compositionId: c.id } : {}) };
    const ack = deliver(header('editor', c ? 'composition-final' : 'document-edit', data, { evidence: 'synthetic-commit', serial: state.canonical.lastSerial + 1 }));
    if (!ack.ack) last = { status: 'unsupported', reason: 'native-producer-no-retry-route' }; // UI never requests temporary admission blocking.
    composition = null;
  }
  function aggregate() {
    return { version: 'metal-ambient-v1-r1', savingOff: true, bodyCount: state.material.body.length, presentedCount: state.material.presented,
      shape: state.shape.current, status: last.status, reason: last.reason, pending: Boolean(state.pending), composing: Boolean(composition),
      paused: state.paused, visible: state.visible, now: state.now };
  }
  function execute(command) {
    if (retired) return;
    if (!command || !integer(command.at) || command.at < state.now) throw new Error('monotonic native command required');
    advanceTo(state, command.at);
    if (composition && command.at >= composition.at + 5000) { cancel(); last = { status: 'unknown', reason: 'native-preedit-expired' }; }
    if (command.op === 'init') {
      if (initialized) throw new Error('single session initialization');
      initialized = true;
      deliver(header('system', 'focus', { field: 'normal', documentId: 'nativeEditor' }, { focusEpoch: 1 }));
      observe(command.value ?? '', 'initial-baseline-not-material'); last = { status: 'ready', reason: 'ready' };
    } else if (!initialized) throw new Error('initialize dedicated editor before receiving');
    else if (command.op === 'commit') commit(command);
    else if (command.op === 'observe') { cancel(); observe(command.value); }
    else if (command.op === 'ink') { if (!INKS.has(command.ink)) throw new Error('fixed ink'); selectedInk = command.ink; }
    else if (command.op === 'mark-start') {
      cancel();
      const doc = state.canonical.document, r = command.range;
      if (!doc || command.base !== doc.text || !Array.isArray(r) || r.length !== 2 || !integer(r[1]) || !safeBoundary(doc.text, r[0]) || !safeBoundary(doc.text, r[0] + r[1])) { last = { status: 'unknown', reason: 'unknown-native-mark-range' }; }
      else {
        compositionSerial = Math.min(1000000, compositionSerial + 1);
        composition = { id: `nativeIME${compositionSerial}`, base: doc.text, range: r.slice(), ink: selectedInk, at: state.now };
        deliver(header('editor', 'composition-start', { compositionId: composition.id })); last = { status: 'composition', reason: 'preedit-only' };
      }
    } else if (command.op === 'mark-update') {
      if (composition && validText(command.text)) {
        let end = Math.min(64, command.text.length); if (!safeBoundary(command.text, end)) end--;
        deliver(header('editor', 'composition-update', { compositionId: composition.id, text: command.text.slice(0, end) }));
        last = { status: 'composition', reason: 'preedit-only' };
      }
    } else if (command.op === 'mark-cancel') { cancel(); observe(command.value ?? '', 'unmark-is-not-confirmation'); }
    else if (command.op === 'pause') deliver(header('system', 'pause', { paused: command.value }));
    else if (command.op === 'visible') deliver(header('system', 'visibility', { visible: command.value }));
    else if (command.op === 'advance' || command.op === 'checkpoint') { /* no inference from idle */ }
    else throw new Error('unsupported native command');
    return;
  }
  const api = Object.freeze({ executeMetaJSON: json => { execute(JSON.parse(json)); return JSON.stringify(transport.metadata()); },
    snapshotMetaJSON: () => JSON.stringify(transport.metadata()), readBodyDeltaJSON: json => JSON.stringify(transport.delta(JSON.parse(json))), aggregateJSON: () => JSON.stringify(aggregate()),
    offExportJSON() { const value = exportReceiver(state); if (!validateStorage(value).valid || value.savingOff !== true) throw new Error('off export failed'); return JSON.stringify(value); },
    destroy() { if (retired) return; cancel(); deliver(header('system', 'pause', { paused: true })); retired = true; },
  });
  TEST_SESSIONS.set(api, { state, execute, transport });
  return api;
}
