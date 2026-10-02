import { createReceiver, receive, advanceTo, exportReceiver, inspect } from '../ambient-integration-contract-v1/receiver-r3.mjs';
import { readBody as receiverBody } from '../ambient-integration-contract-v1/body-view.mjs';
import { validateStorage } from '../ambient-integration-contract-v1/storage-gate.mjs';
import { latestAnswer } from '../ambient-integration-contract-v1/shape-only.mjs';
const INSERT = new Map([['insertText', 'type'], ['insertLineBreak', 'type'], ['insertFromPaste', 'paste'], ['insertReplacementText', 'completion']]);
const HISTORY = new Map([['historyUndo', 'undo'], ['historyRedo', 'redo']]);
const DELETE = new Set(['deleteContentBackward', 'deleteContentForward', 'deleteWordBackward', 'deleteWordForward', 'deleteByCut', 'deleteContent']);
const FINAL_INPUT = new Set(['insertText', 'insertFromComposition', 'insertCompositionText']);
const INKS = new Set(['white', 'blue', 'green', 'purple']);
// A detached textarea keeps its owner reservation; never recreate its body/IDs.
const OWNERS = new WeakMap();
const TYPES = ['beforeinput', 'input', 'compositionstart', 'compositionupdate', 'compositionend', 'keydown', 'blur'];
const integer = (n, min = 0) => Number.isSafeInteger(n) && n >= min;
const boundary = (t, i) => integer(i) && i <= t.length && (i === 0 || i === t.length || !(t.charCodeAt(i - 1) >= 0xD800 && t.charCodeAt(i - 1) <= 0xDBFF && t.charCodeAt(i) >= 0xDC00 && t.charCodeAt(i) <= 0xDFFF));
function wellFormed(t) {
  if (typeof t !== 'string') return false;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF) { const next = t.charCodeAt(++i); if (!(next >= 0xDC00 && next <= 0xDFFF)) return false; }
    else if (c >= 0xDC00 && c <= 0xDFFF) return false;
  }
  return true;
}
const validText = t => typeof t === 'string' && t.length <= 512 && wellFormed(t);
const preview = t => { let end = Math.min(64, t.length); if (!boundary(t, end)) end--; return t.slice(0, end); };
function freezeCopy(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freezeCopy));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([k, v]) => [k, freezeCopy(v)])));
  return value;
}
export function singleDiff(before, after) {
  if (!validText(before) || !validText(after)) return null;
  if (before === after) return [];
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  while (!boundary(before, prefix) || !boundary(after, prefix)) prefix--;
  let suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix++;
  while (!boundary(before, before.length - suffix) || !boundary(after, after.length - suffix)) suffix--;
  return [{ offset: prefix, deleteCount: before.length - prefix - suffix, text: after.slice(prefix, after.length - suffix) }];
}

export function createAdapter({ element, clock = () => Math.floor(performance.now()), ink = 'blue', bodyLimit = 256, shapeMode = 'inline' } = {}) {
  if (!element || element.tagName !== 'TEXTAREA' || !INKS.has(ink) || typeof clock !== 'function') throw new TypeError('dedicated textarea/settings required');
  if (OWNERS.has(element)) throw new Error('textarea-already-owned');
  const state = createReceiver({ bodyLimit, shapeMode, savingOff: true });
  let before = null, composition = null, pending = null, unsupported = false, destroyed = false;
  let selectedInk = ink, compositionCounter = 0, status = 'ready', lastReason = 'ready', everFrozenPending = false;
  const counters = { known: 0, unknown: 0, ignored: 0, cancelled: 0, retries: 0, overruns: 0 };
  const bump = k => { counters[k] = Math.min(1000000, counters[k] + 1); };
  const chooseStatus = (s, reason) => { status = s; lastReason = reason; };
  const now = () => Math.max(state.now, Math.floor(clock()));
  function normalized(source, kind, data, { serial, evidence = 'none', seq, observedAt = state.now } = {}) {
    const e = { grammar: 'ambient.integration.v1', session: 'lab', source,
      seq: seq ?? state.sources[source].seq + 1, kind, focusEpoch: state.focusEpoch, policyEpoch: state.policyEpoch,
      observedAt, evidence, data };
    if (serial !== undefined) { e.serial = serial; e.operationId = `e${e.focusEpoch}-p${e.policyEpoch}-c${serial}`; }
    return freezeCopy(e);
  }
  const deliver = e => receive(state, e, state.now);
  function readValue() { const value = element.value; return validText(value) ? value : null; }
  function selection(text) {
    const start = element.selectionStart, end = element.selectionEnd;
    return boundary(text, start) && boundary(text, end) && end >= start ? { start, end } : null;
  }
  function observe(value, reason) {
    if (value === null) { chooseStatus('document-limit', 'document-limit'); bump('unknown'); return; }
    const doc = state.canonical.document;
    if (!doc || state.canonical.needsResync) {
      deliver(normalized('editor', 'baseline', { documentId: 'ownedEditor', version: (doc?.version ?? -1) + 1, text: value }));
    } else {
      const changes = singleDiff(doc.text, value);
      if (changes?.length) deliver(normalized('editor', 'document-edit', {
        documentId: 'ownedEditor', baseVersion: doc.version, version: doc.version + 1,
        reason: 'replace', ink: selectedInk, changes,
      }, { evidence: 'document-only' }));
    }
    bump('unknown'); chooseStatus(unsupported ? 'unsupported' : 'unknown', reason);
  }
  function cancelComposition(reason, observeCurrent = true) {
    if (composition && state.canonical.composition?.id === composition.id) deliver(normalized('editor', 'composition-cancel', { compositionId: composition.id }));
    composition = null; before = null; bump('cancelled');
    if (observeCurrent) observe(readValue(), reason);
    chooseStatus(unsupported ? 'unsupported' : 'cancelled', reason);
  }
  function expire() {
    if (before && state.now >= before.at + 5000) before = null;
    if (composition && state.now >= composition.at + 5000) cancelComposition('unknown-ime-expired');
  }
  function move(at, equal = true) {
    if (!integer(at) || at < state.now) throw new TypeError('monotonic integer local clock required');
    // Expiry never upgrades confirmation. Advance then discard stale preview tokens.
    advanceTo(state, at); expire(); return equal;
  }
  function finishKnown(changes, reason, operationInk, proposedValue, compositionId) {
    const doc = state.canonical.document;
    if (!doc || state.canonical.needsResync || unsupported || !state.sources.editor.appendSupported) { observe(proposedValue, 'unsupported-or-unbased'); return null; }
    const data = { documentId: 'ownedEditor', baseVersion: doc.version, version: doc.version + 1,
      reason, ink: operationInk, changes };
    if (compositionId) data.compositionId = compositionId;
    const e = normalized('editor', compositionId ? 'composition-final' : 'document-edit', data,
      { serial: state.canonical.lastSerial + 1, evidence: 'synthetic-commit' });
    const ack = deliver(e);
    before = null; composition = null;
    if (!ack.ack) {
      pending = { event: e, proposedValue, previousReadOnly: Boolean(element.readOnly) };
      element.readOnly = true; everFrozenPending = true;
      chooseStatus('deferred', ack.reason);
    } else {
      if (ack.status === 'accepted') bump('known');
      chooseStatus(ack.status === 'held' ? 'held' : ack.status === 'accepted' ? 'known' : 'unknown', ack.reason);
    }
    return ack;
  }
  function overrun(value, reason = 'unsupported-overrun') {
    const prior = pending;
    // New seq explicitly discloses noncooperation; receiver rejects before data.
    deliver(normalized('editor', 'document-edit', {}, { seq: prior.event.seq + 1 }));
    pending = null; element.readOnly = prior.previousReadOnly; unsupported = true;
    before = null; composition = null; bump('overruns'); observe(value, reason);
    chooseStatus('unsupported', reason);
  }
  function previewComposition(event, value) {
    const text = typeof event.data === 'string' ? event.data : value ?? '';
    if (state.canonical.composition?.id === composition?.id) deliver(normalized('editor', 'composition-update', { compositionId: composition.id, text: preview(text) }));
    chooseStatus('composition', 'preedit-only');
  }
  function startComposition(event, value) {
    if (composition) cancelComposition('overlapping-composition');
    before = null;
    if (value === null) { observe(null, 'document-limit'); return; }
    if (state.canonical.document?.text !== value) observe(value, 'preexisting-value-observed');
    const range = selection(value);
    compositionCounter = Math.min(1000000, compositionCounter + 1);
    composition = { id: `ime${compositionCounter}`, phase: 'active', at: state.now, base: value,
      range, ink: selectedInk, trusted: event.isTrusted === true && Boolean(range) && !unsupported };
    deliver(normalized('editor', 'composition-start', { compositionId: composition.id }));
    chooseStatus('composition', 'preedit-only');
  }
  function endComposition(event, value) {
    const c = composition;
    if (!c) { observe(value, 'unknown-ime-no-start'); return; }
    const data = event.data;
    if (event.isTrusted !== true || !c.trusted || typeof data !== 'string' || data.length > 256 || !wellFormed(data)) {
      cancelComposition('unknown-ime-final'); return;
    }
    if (!data.length) { cancelComposition('composition-cancelled'); return; }
    const expected = c.base.slice(0, c.range.start) + data + c.base.slice(c.range.end);
    if (!validText(expected)) { cancelComposition('document-limit'); return; }
    c.phase = 'ended'; c.finalData = data; c.expected = expected;
    if (value === expected) finishKnown([{ offset: c.range.start, deleteCount: c.range.end - c.range.start, text: data }], 'type', c.ink, expected, c.id);
    else chooseStatus('waiting-final-input', 'unknown-ime-awaiting-final-input');
  }
  function ordinaryBefore(event, value) {
    before = null;
    if (composition || event.isComposing !== false) { if (composition) previewComposition(event, value); return; }
    const type = event.inputType;
    if (event.isTrusted !== true || event.defaultPrevented === true || (!INSERT.has(type) && !HISTORY.has(type) && !DELETE.has(type)) || value === null) return;
    if (state.canonical.document?.text !== value) observe(value, 'preexisting-value-observed');
    const range = selection(value);
    if (INSERT.has(type) && !range) return;
    const data = INSERT.has(type) ? event.data : null;
    if (typeof data === 'string' && (!wellFormed(data) || data.length > 512)) return;
    before = { type, data, base: value, version: state.canonical.document?.version, range, at: state.now, ink: selectedInk };
  }
  function input(event, value) {
    if (composition) {
      const c = composition;
      if (c.phase === 'ended' && c.trusted && event.isTrusted === true && event.isComposing === false && FINAL_INPUT.has(event.inputType) && value === c.expected) {
        finishKnown([{ offset: c.range.start, deleteCount: c.range.end - c.range.start, text: c.finalData }], 'type', c.ink, c.expected, c.id);
      } else previewComposition(event, value);
      return;
    }
    const token = before; before = null;
    if (!token && value === state.canonical.document?.text) { bump('ignored'); chooseStatus('ignored', 'unchanged-echo'); return; }
    if (!token || event.isTrusted !== true || event.isComposing !== false || event.inputType !== token.type ||
      state.now >= token.at + 5000 || value === null || token.base !== state.canonical.document?.text || token.version !== state.canonical.document?.version) {
      observe(value, 'unknown-input-trace'); return;
    }
    if (INSERT.has(token.type)) {
      const prefix = token.base.slice(0, token.range.start), suffix = token.base.slice(token.range.end);
      if (!value.startsWith(prefix) || !value.endsWith(suffix) || value.length < prefix.length + suffix.length) { observe(value, 'unknown-range-mismatch'); return; }
      const text = value.slice(prefix.length, value.length - suffix.length);
      const inputData = event.data;
      const declared = token.type === 'insertLineBreak' ? '\n' : typeof token.data === 'string' ? token.data : typeof inputData === 'string' ? inputData : null;
      if ((token.type === 'insertText' && declared === null) || (declared !== null && declared !== text) || !wellFormed(text)) { observe(value, 'unknown-data-mismatch'); return; }
      finishKnown([{ offset: token.range.start, deleteCount: token.range.end - token.range.start, text }], INSERT.get(token.type), token.ink, value);
    } else {
      const changes = singleDiff(token.base, value);
      if (!changes?.length) { bump('ignored'); chooseStatus('ignored', 'unchanged-history'); return; }
      if (DELETE.has(token.type) && changes.some(c => c.text.length)) { observe(value, 'unknown-delete-mismatch'); return; }
      finishKnown(changes, HISTORY.get(token.type) ?? 'delete', token.ink, value);
    }
  }
  function handle(event) {
    if (destroyed) return snapshot();
    if (!event || event.target !== element || !TYPES.includes(event.type)) { bump('ignored'); return snapshot(); }
    move(now());
    if (event.type === 'keydown') {
      deliver(normalized('keys', 'activity', { class: event.ctrlKey || event.metaKey ? 'shortcut' : 'key', count: 1 })); return snapshot();
    }
    if (event.type === 'blur') {
      before = null;
      if (pending) overrun(readValue(), 'unsupported-blur');
      else if (composition) cancelComposition('composition-blurred');
      return snapshot();
    }
    const value = readValue();
    if (pending) {
      if (value !== pending.proposedValue) overrun(value);
      else { bump('ignored'); chooseStatus('deferred', 'pending-echo'); }
      return snapshot();
    }
    if (event.type === 'compositionstart') startComposition(event, value);
    else if (event.type === 'compositionupdate') { if (composition) previewComposition(event, value); else observe(value, 'unknown-ime-update'); }
    else if (event.type === 'compositionend') endComposition(event, value);
    else if (event.type === 'beforeinput') ordinaryBefore(event, value);
    else if (event.type === 'input') input(event, value);
    return snapshot();
  }
  function snapshot() {
    return { version: 'ambient-editor-adapter-v1-r2', savingOff: true, status, lastReason,
      bodyCount: state.material.body.length, presentedCount: state.material.presented, documentVersion: state.canonical.document?.version ?? 0,
      compositionPhase: composition?.phase ?? null, pendingRetry: Boolean(pending), readOnly: Boolean(element.readOnly), unsupported,
      shape: state.shape.current, shapePending: Boolean(state.shape.pending), rawKeys: state.metrics.activityKeys,
      rawShortcuts: state.metrics.activityShortcuts, counters: { ...counters } };
  }
  // Own dedicated field initial baseline; never import it as material.
  const initialAt = now(); advanceTo(state, initialAt);
  const focus = freezeCopy({ grammar: 'ambient.integration.v1', source: 'system', session: 'lab', seq: 1, kind: 'focus',
    focusEpoch: 1, policyEpoch: 0, observedAt: initialAt, evidence: 'none', data: { field: 'normal', documentId: 'ownedEditor' } });
  deliver(focus);
  const initial = readValue();
  deliver(normalized('editor', 'baseline', { documentId: 'ownedEditor', version: 0, text: initial ?? '' }));
  if (initial === null) chooseStatus('document-limit', 'document-limit');
  // Reserve before binding; a reentrant second create cannot establish another receiver.
  OWNERS.set(element, true);
  const listener = event => handle(event);
  if (typeof element.addEventListener === 'function') TYPES.forEach(type => element.addEventListener(type, listener));
  return {
    handle,
    advance(at) { if (destroyed) return snapshot(); move(at); return snapshot(); },
    setInk(value) { if (destroyed) return; if (!INKS.has(value)) throw new TypeError('ink enum required'); selectedInk = value; },
    setAdmissionReady(ready, at = undefined) {
      if (destroyed) return snapshot();
      if (typeof ready !== 'boolean') throw new TypeError('boolean required'); move(at ?? now());
      deliver(normalized('system', 'admission-ready', { ready })); return snapshot();
    },
    retry(at = undefined) {
      if (destroyed) return snapshot();
      move(at ?? now()); if (!pending) return snapshot();
      const held = pending, ack = deliver(held.event); bump('retries');
      if (ack.ack) {
        pending = null; element.readOnly = held.previousReadOnly;
        if (ack.status === 'accepted') bump('known');
        chooseStatus(ack.status === 'accepted' ? 'known' : ack.status === 'held' ? 'held' : 'unknown', ack.reason);
      } else chooseStatus('deferred', ack.reason);
      return snapshot();
    },
    readBody() { return receiverBody(state); }, snapshot,
    exportState() { const value = exportReceiver(state); if (!validateStorage(value).valid) throw new Error('off storage contract rejected'); return value; },
    inspectVolatile() {
      const observed = inspect(state), nontext = snapshot();
      return { ...nontext, body: observed.body, units: observed.units, ids: observed.ids, inks: observed.inks, unitTexts: observed.unitTexts,
        document: observed.document?.text ?? '', version: observed.document?.version ?? 0, composition: composition ? { phase: composition.phase } : null,
        frozenPending: everFrozenPending && (!pending || Object.isFrozen(pending.event) && Object.isFrozen(pending.event.data) && Object.isFrozen(pending.event.data.changes) && pending.event.data.changes.every(Object.isFrozen)) };
    },
    destroy() {
      if (destroyed) return;
      if (pending) overrun(readValue(), 'unsupported-detached');
      else if (composition) cancelComposition('composition-detached');
      before = null;
      deliver(normalized('system', 'pause', { paused: true }));
      destroyed = true; chooseStatus('detached', 'adapter-detached');
      if (typeof element.removeEventListener === 'function') TYPES.forEach(type => element.removeEventListener(type, listener));
    },
    setVisible(visible, at = undefined) { if (destroyed) return snapshot(); move(at ?? now()); deliver(normalized('system', 'visibility', { visible })); return snapshot(); },
    setPaused(paused, at = undefined) { if (destroyed) return snapshot(); move(at ?? now()); deliver(normalized('system', 'pause', { paused })); return snapshot(); },
    shapeRequest() { return !destroyed && state.shape.pending ? latestAnswer(state) : null; },
    answerShape(token, at = undefined) {
      if (destroyed) return snapshot();
      move(at ?? now());
      const keys = ['requestId', 'focusEpoch', 'policyEpoch', 'generation', 'windowRevision', 'shape'];
      if (!token || keys.some(k => k !== 'shape' && !integer(token[k])) || !['sphere', 'box', 'ring'].includes(token.shape)) return snapshot();
      deliver(normalized('worker', 'shape-answer', Object.fromEntries(keys.map(k => [k, token[k]])))); return snapshot();
    },
  };
}
