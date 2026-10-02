import { P, createShape, invalidateShape, materialToShape, exposureChanged, shapeAnswer, advance, windowLength } from './shape-only.mjs';
export const GRAMMAR = 'ambient.integration.v1';
export const SOURCES = Object.freeze([
  { id: 'system', session: 'lab', control: true }, { id: 'keys', session: 'lab', activity: true },
  { id: 'editor', session: 'lab', document: true, composition: true, commit: true, primaryCommit: true },
  { id: 'echo', session: 'lab', document: true, commit: true, primaryCommit: false },
  { id: 'documentApi', session: 'lab', document: true }, { id: 'sender', session: 'lab', explicitSend: true },
  { id: 'worker', session: 'lab', shapeAnswer: true },
]);
const INKS = new Set(['white', 'blue', 'green', 'purple']);
const OPAQUE = /^[A-Za-z0-9_-]{1,32}$/;
const integer = (n, min = 0) => Number.isSafeInteger(n) && n >= min;
const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
const active = s => s.visible && !s.paused;
const boundary = (t, i) => i === 0 || i === t.length || !(t.charCodeAt(i - 1) >= 0xD800 && t.charCodeAt(i - 1) <= 0xDBFF && t.charCodeAt(i) >= 0xDC00 && t.charCodeAt(i) <= 0xDFFF);
const boundedPreview = t => { let end = Math.min(64, t.length); if (!boundary(t, end)) end--; return t.slice(0, end); };
const bump = (s, k, n = 1) => { s.metrics[k] = Math.min(P.counterSaturation, (s.metrics[k] ?? 0) + n); };
const record = (s, k, row) => { s.history[k].push(row); if (s.history[k].length > P.maximumMetadataHistory) s.history[k].shift(); };
export function createReceiver({ bodyLimit = 256, shapeMode = 'inline', savingOff = true, consent } = {}) {
  if (!integer(bodyLimit, 1) || bodyLimit > 256 || !['inline', 'deferred'].includes(shapeMode) ||
    typeof savingOff !== 'boolean' || (!savingOff && consent !== 'synthetic-opt-in')) throw new TypeError('invalid artificial settings or opt-in');
  return { grammar: GRAMMAR, version: 'ambient-integration-contract-v1-r1', seed: 1, savingOff, bodyLimit,
    now: 0, focusEpoch: 0, policyEpoch: 0, field: 'unknown', documentId: null,
    captureEnabled: true, retention: 'text', visible: true, paused: false, admissionReady: true,
    sources: Object.fromEntries(SOURCES.map(source => [source.id, { ...source, seq: 0, observedAt: -1, appendSupported: true }])),
    canonical: { document: null, preview: '', composition: null, lastSerial: 0, normalizedSeq: 0, needsResync: false },
    material: { body: [], nextId: 1, presented: 0, nextRevealAt: Infinity },
    pending: null, shape: createShape(shapeMode),
    metrics: Object.fromEntries(['received', 'addedUnits', 'admissions', 'permanentHolds', 'deferrals', 'gaps', 'documentGaps', 'serialGaps',
      'trustedRebases', 'invalidChanges', 'transportDuplicates', 'operationDuplicates', 'activityKeys', 'activityShortcuts',
      'queries', 'shapeChanges', 'cachedSamples', 'candidateExpiries', 'staleAnswers', 'acceptedAnswers', 'unsupportedModes',
      'queuePeak', 'pendingSlotPeak', 'hiddenWork', 'normalizedForwardGaps'].map(k => [k, 0])),
    history: { decisions: [], admissions: [], changes: [], queries: [], reveals: [], forwarded: [] },
  };
}
function forward(s, kind) {
  const seq = ++s.canonical.normalizedSeq;
  record(s, 'forwarded', { seq, kind, at: s.now }); return seq;
}
function invalidate(s, kind, clear = true) { invalidateShape(s, clear); forward(s, kind); }
function consume(source, e) { source.seq = e.seq; source.observedAt = e.observedAt; }
function decision(s, status, reason, ack = true, added = 0) {
  const row = { at: s.now, status, reason, ack, added };
  record(s, 'decisions', row); return row;
}
function markGap(s, source, reason) {
  // R2: cancelling the one pending metadata slot invalidates its owner as well.
  // The frozen producer payload cannot be called lossless after this interruption.
  if (s.pending) s.sources[s.pending.source].appendSupported = false;
  source.appendSupported = false; s.canonical.needsResync = true; s.pending = null;
  bump(s, 'gaps'); invalidate(s, reason);
}
function stageDocument(s, data) {
  const doc = s.canonical.document;
  if (!doc || s.canonical.needsResync || data.documentId !== s.documentId || data.baseVersion !== doc.version || data.version !== doc.version + 1) return { error: 'document-gap' };
  if (!Array.isArray(data.changes) || data.changes.length < 1 || data.changes.length > 64) return { error: 'invalid-changes' };
  const changes = [];
  for (const c of data.changes) {
    if (!c || !integer(c.offset) || !integer(c.deleteCount) || typeof c.text !== 'string' ||
      c.offset + c.deleteCount > doc.text.length || !boundary(doc.text, c.offset) || !boundary(doc.text, c.offset + c.deleteCount)) return { error: 'invalid-changes' };
    changes.push({ offset: c.offset, deleteCount: c.deleteCount, text: c.text });
  }
  changes.sort((a, b) => a.offset - b.offset);
  for (let i = 1; i < changes.length; i++) if (changes[i].offset === changes[i - 1].offset || changes[i].offset < changes[i - 1].offset + changes[i - 1].deleteCount) return { error: 'invalid-changes' };
  let text = doc.text;
  for (const c of changes.toReversed()) text = text.slice(0, c.offset) + c.text + text.slice(c.offset + c.deleteCount);
  if (text.length > 512) return { error: 'document-limit' };
  return { document: { documentId: s.documentId, version: data.version, text }, segments: changes.map(c => c.text).filter(Boolean) };
}
function applyDocument(s, doc) { s.canonical.document = doc; s.canonical.preview = boundedPreview(doc.text); s.canonical.needsResync = false; }
function admit(s, e, source, serial, segments, ink, doc, clearsContext) {
  const totalUtf16 = segments.reduce((n, t) => n + t.length, 0);
  const units = totalUtf16 <= 256 ? segments.map(text => [...segmenter.segment(text)].map(r => r.segment)) : [];
  const unitCount = units.reduce((n, row) => n + row.length, 0);
  const permanent = totalUtf16 > 256 ? 'event-text-limit' : s.material.body.length + unitCount > s.bodyLimit ? 'body-capacity' : null;
  if (!permanent && unitCount && !s.admissionReady) {
    s.pending = { source: e.source, session: e.session, seq: e.seq, focusEpoch: e.focusEpoch, policyEpoch: e.policyEpoch,
      observedAt: e.observedAt, serial, operationId: e.operationId, kind: e.kind };
    s.metrics.pendingSlotPeak = Math.max(s.metrics.pendingSlotPeak, 1); bump(s, 'deferrals');
    return decision(s, 'deferred', 'temporary-handoff', false);
  }
  // Material is the sole body and ID allocator; canonical watermarks follow all additions.
  const chunks = [];
  if (!permanent) for (const row of units) {
    const start = s.material.body.length;
    for (const text of row) s.material.body.push({ id: s.material.nextId++, text, ink });
    if (s.material.body.length > start) chunks.push({ start, end: s.material.body.length });
  }
  if (doc) applyDocument(s, doc);
  s.canonical.lastSerial = serial; consume(source, e); s.pending = null;
  if (e.kind === 'composition-final') s.canonical.composition = null;
  if (permanent) {
    bump(s, 'permanentHolds'); record(s, 'admissions', { at: s.now, added: 0, reason: permanent });
    return decision(s, 'held', permanent);
  }
  if (clearsContext) invalidate(s, 'document-history-change');
  else if (unitCount) {
    const seq = forward(s, 'material'); materialToShape(s, chunks, seq, e.observedAt);
    if (active(s) && s.material.nextRevealAt === Infinity) s.material.nextRevealAt = s.now + P.revealTickMs;
  }
  s.metrics.queuePeak = Math.max(s.metrics.queuePeak, s.material.body.length - s.material.presented);
  bump(s, 'addedUnits', unitCount); bump(s, 'admissions');
  record(s, 'admissions', { at: s.now, added: unitCount, reason: 'whole-add-before-ack' });
  return decision(s, 'accepted', 'whole-add-before-ack', true, unitCount);
}
export function receive(s, e, deliveryAt) {
  advance(s, deliveryAt, false); bump(s, 'received');
  if (!e || e.grammar !== GRAMMAR || !OPAQUE.test(e.source ?? '') || !integer(e.seq, 1) || !integer(e.focusEpoch) ||
    !integer(e.policyEpoch) || !integer(e.observedAt) || e.observedAt > deliveryAt || typeof e.kind !== 'string') return decision(s, 'rejected', 'invalid-versioned-header');
  const source = s.sources[e.source];
  if (!source || source.session !== e.session) return decision(s, 'rejected', 'unknown-source-session');
  if (e.seq <= source.seq) { bump(s, 'transportDuplicates'); return decision(s, 'ignored', 'transport-duplicate'); }
  if (e.observedAt < source.observedAt) return decision(s, 'rejected', 'source-clock-regression');
  const focus = source.control && e.kind === 'focus', policy = source.control && e.kind === 'policy';
  if (focus ? e.focusEpoch !== s.focusEpoch + 1 || e.policyEpoch !== s.policyEpoch :
    policy ? e.focusEpoch !== s.focusEpoch || e.policyEpoch !== s.policyEpoch + 1 :
    e.focusEpoch !== s.focusEpoch || e.policyEpoch !== s.policyEpoch) return decision(s, 'ignored', 'stale-epoch');
  if (s.pending && source.id === s.pending.source && e.seq !== s.pending.seq) {
    markGap(s, source, 'unacked-source-gap'); consume(source, e);
    return decision(s, 'unsupported', 'new-event-before-ack');
  }
  const samePendingEvent = s.pending && ['source', 'session', 'seq', 'focusEpoch', 'policyEpoch',
    'observedAt', 'kind', 'operationId', 'serial'].every(k => e[k] === s.pending[k]);
  if (e.seq > source.seq + 1 && !samePendingEvent) {
    const activityOnly = source.activity && !source.document && !source.composition && !source.commit &&
      !source.explicitSend && !source.control && !source.shapeAnswer;
    // R3: missing raw key activity is not missing confirmed document material.
    // Account for its own source gap without cancelling an unrelated handoff.
    if (activityOnly) bump(s, 'gaps');
    else markGap(s, source, 'source-sequence-gap');
  }
  if (source.control) {
    const data = e.data;
    if (!data || typeof data !== 'object') { consume(source, e); return decision(s, 'rejected', 'invalid-control'); }
    if (focus) {
      if (!['normal', 'secure', 'unknown'].includes(data.field) || !OPAQUE.test(data.documentId ?? '')) { consume(source, e); return decision(s, 'rejected', 'invalid-focus'); }
      s.focusEpoch = e.focusEpoch; s.field = data.field; s.documentId = data.documentId;
      s.canonical.document = null; s.canonical.preview = ''; s.canonical.composition = null;
      s.canonical.lastSerial = 0; s.canonical.needsResync = false; s.pending = null;
      invalidate(s, 'focus'); s.shape.anchor = s.now;
    } else if (policy) {
      if (!['text', 'activity-only'].includes(data.retention) || typeof data.captureEnabled !== 'boolean') { consume(source, e); return decision(s, 'rejected', 'invalid-policy'); }
      s.policyEpoch = e.policyEpoch; s.retention = data.retention; s.captureEnabled = data.captureEnabled;
      s.canonical.document = null; s.canonical.preview = ''; s.canonical.composition = null;
      s.canonical.lastSerial = 0; s.canonical.needsResync = false; s.pending = null; invalidate(s, 'policy'); s.shape.anchor = s.now;
    } else if (e.kind === 'admission-ready' && typeof data.ready === 'boolean') s.admissionReady = data.ready;
    else if ((e.kind === 'visibility' && typeof data.visible === 'boolean') || (e.kind === 'pause' && typeof data.paused === 'boolean')) {
      const wasActive = active(s);
      if (e.kind === 'visibility') s.visible = data.visible; else s.paused = data.paused;
      forward(s, e.kind); exposureChanged(s, wasActive);
    } else if (e.kind === 'request-document-sync') { consume(source, e); bump(s, 'unsupportedModes'); return decision(s, 'unsupported', 'document-sync-not-adopted'); }
    else { consume(source, e); return decision(s, 'rejected', 'unsupported-control'); }
    consume(source, e); return decision(s, 'controlled', e.kind);
  }
  if (source.activity && e.kind === 'activity') {
    const data = e.data;
    if (!data || !integer(data.count) || !['key', 'shortcut'].includes(data.class)) { consume(source, e); return decision(s, 'rejected', 'invalid-activity'); }
    bump(s, data.class === 'key' ? 'activityKeys' : 'activityShortcuts', data.count); consume(source, e);
    return decision(s, 'activity', 'no-text-route');
  }
  // These gates precede payload access, including getters.
  if (s.field !== 'normal' || s.retention !== 'text' || !s.captureEnabled) { consume(source, e); return decision(s, 'suppressed', 'text-route-disabled'); }
  if (source.shapeAnswer && e.kind === 'shape-answer') {
    const data = e.data;
    const ok = data && shapeAnswer(s, data); consume(source, e);
    return decision(s, ok ? 'answered' : 'ignored', ok ? 'current-answer' : 'stale-answer');
  }
  const explicit = e.kind === 'explicit-send';
  const edit = e.kind === 'document-edit' || e.kind === 'composition-final';
  const known = source.appendSupported && (explicit ? source.explicitSend && e.evidence === 'synthetic-explicit-send' : edit && source.commit && e.evidence === 'synthetic-commit');
  if (known) {
    if (!integer(e.serial, 1) || e.operationId !== `e${e.focusEpoch}-p${e.policyEpoch}-c${e.serial}`) { consume(source, e); return decision(s, 'rejected', 'invalid-operation-id'); }
    if (e.serial <= s.canonical.lastSerial) { consume(source, e); bump(s, 'operationDuplicates'); return decision(s, 'ignored', 'operation-duplicate'); }
    if (edit && !source.primaryCommit) { consume(source, e); return decision(s, 'rejected', 'echo-cannot-create-operation'); }
    if (e.serial !== s.canonical.lastSerial + 1) { consume(source, e); s.canonical.needsResync = true; bump(s, 'serialGaps'); invalidate(s, 'operation-serial-gap'); return decision(s, 'held', 'serial-rebase-required'); }
    if (s.pending && (s.pending.source !== e.source || s.pending.seq !== e.seq)) {
      markGap(s, source, 'parallel-unacked-source'); consume(source, e); return decision(s, 'unsupported', 'single-retry-slot-only');
    }
    if (s.pending && ['focusEpoch', 'policyEpoch', 'observedAt', 'operationId', 'kind'].some(k => s.pending[k] !== e[k])) { consume(source, e); markGap(s, source, 'retry-metadata-mismatch'); return decision(s, 'unsupported', 'retry-metadata-mismatch'); }
  }
  if (explicit) {
    if (!known) { consume(source, e); return decision(s, 'suppressed', 'known-selection-required'); }
    const d = e.data;
    if (!d || typeof d.text !== 'string' || !INKS.has(d.ink) || d.selectionDeclared !== true || d.documentId !== null || d.documentVersion !== null || 'changes' in d) { consume(source, e); return decision(s, 'rejected', 'invalid-explicit-selection'); }
    return admit(s, e, source, e.serial, [d.text], d.ink, null, false);
  }
  if (!source.document) { consume(source, e); return decision(s, 'rejected', 'source-capability'); }
  const d = e.data;
  if (!d || typeof d !== 'object') { consume(source, e); return decision(s, 'rejected', 'invalid-document-payload'); }
  if (e.kind === 'baseline') {
    if (d.documentId !== s.documentId || !integer(d.version) || typeof d.text !== 'string' || d.text.length > 512) { consume(source, e); return decision(s, 'rejected', 'invalid-baseline'); }
    if (e.evidence === 'synthetic-rebase') {
      if (!source.primaryCommit || !source.commit || !integer(d.operationSerialBaseline) || d.operationSerialBaseline < s.canonical.lastSerial) { consume(source, e); return decision(s, 'rejected', 'invalid-primary-rebase'); }
      s.canonical.lastSerial = d.operationSerialBaseline; source.appendSupported = true; bump(s, 'trustedRebases'); invalidate(s, 'trusted-rebase');
    }
    applyDocument(s, { documentId: d.documentId, version: d.version, text: d.text }); consume(source, e);
    return decision(s, 'observed', 'baseline-never-material');
  }
  if (e.kind.startsWith('composition-') && e.kind !== 'composition-final') {
    if (!source.composition || !OPAQUE.test(d.compositionId ?? '')) { consume(source, e); return decision(s, 'rejected', 'invalid-composition'); }
    if (e.kind === 'composition-start') s.canonical.composition = { id: d.compositionId, text: '' };
    else if (s.canonical.composition?.id !== d.compositionId) { consume(source, e); return decision(s, 'rejected', 'composition-id'); }
    else if (e.kind === 'composition-update' && typeof d.text === 'string') s.canonical.composition.text = boundedPreview(d.text);
    else if (e.kind === 'composition-cancel') s.canonical.composition = null;
    else { consume(source, e); return decision(s, 'rejected', 'composition-kind'); }
    consume(source, e); return decision(s, 'preview', 'preedit-never-material');
  }
  if (!edit || (e.kind === 'composition-final' && (!source.composition || s.canonical.composition?.id !== d.compositionId))) { consume(source, e); return decision(s, 'rejected', 'document-kind'); }
  const staged = stageDocument(s, d);
  if (staged.error) {
    consume(source, e);
    if (staged.error === 'document-gap') { s.canonical.needsResync = true; bump(s, 'documentGaps'); invalidate(s, 'document-gap'); }
    else bump(s, 'invalidChanges');
    return decision(s, 'rejected', staged.error);
  }
  if (!known) { applyDocument(s, staged.document); consume(source, e); return decision(s, 'preview', 'unknown-commit-quality'); }
  if (!INKS.has(d.ink) || !['type', 'paste', 'completion', 'replace', 'undo', 'redo', 'delete'].includes(d.reason)) { consume(source, e); return decision(s, 'rejected', 'invalid-commit-metadata'); }
  const clearsContext = ['undo', 'redo', 'delete'].includes(d.reason) || staged.segments.length === 0;
  return admit(s, e, source, e.serial, clearsContext ? [] : staged.segments, d.ink, staged.document, clearsContext);
}
export function advanceTo(s, at) { return advance(s, at, true); }
export function exportReceiver(s) {
  const result = { grammar: GRAMMAR, version: s.version, savingOff: s.savingOff, seed: s.seed, shape: s.shape.current,
    now: s.now, count: s.material.body.length, presentedCount: s.material.presented,
    inkCounts: Object.fromEntries([...INKS].map(ink => [ink, s.material.body.filter(u => u.ink === ink).length])),
    counters: { ...s.metrics } };
  if (!s.savingOff) result.body = s.material.body.map(({ id, text, ink }) => ({ id, text, ink }));
  return result;
}
export function restartFromExport(value) {
  // Only saving-off restart is proposed here; there is no decoder of serialized raw body.
  if (!value || value.grammar !== GRAMMAR || value.savingOff !== true || !['sphere', 'box', 'ring'].includes(value.shape)) throw new TypeError('off aggregate export required');
  const s = createReceiver(); s.shape.current = value.shape; s.seed = integer(value.seed) ? value.seed : 1; return s;
}
export function inspect(s) {
  return { body: s.material.body.map(u => u.text).join(''), units: s.material.body.length,
    unitTexts: s.material.body.map(u => u.text), ids: s.material.body.map(u => u.id), inks: s.material.body.map(u => u.ink),
    inkCounts: Object.fromEntries([...INKS].map(ink => [ink, s.material.body.filter(u => u.ink === ink).length])),
    document: s.canonical.document ? { text: s.canonical.document.text, version: s.canonical.document.version } : null,
    composition: s.canonical.composition, serial: s.canonical.lastSerial, normalizedSeq: s.canonical.normalizedSeq,
    sourceSeq: Object.fromEntries(Object.entries(s.sources).map(([id, source]) => [id, source.seq])),
    appendUnsupported: Object.values(s.sources).filter(r => !r.appendSupported).map(r => r.id),
    pendingSlots: Number(s.pending !== null), nextId: s.material.nextId, presented: s.material.presented,
    windowUtf16: windowLength(s), candidate: s.shape.candidate, shape: s.shape.current, shapeAt: s.shape.lastShapeAt,
    holdReasons: s.history.admissions.filter(r => r.added === 0 && r.reason !== 'whole-add-before-ack').map(r => r.reason),
    ackAddedAt: s.history.admissions.find(r => r.added > 0)?.at ?? null,
    ...s.metrics };
}
