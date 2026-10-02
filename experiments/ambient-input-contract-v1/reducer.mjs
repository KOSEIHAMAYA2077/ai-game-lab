// Independent synthetic-event experiment: no OS or widget dependencies.
const MAX_COUNTER = 1_000_000;
const MAX_ID = Number.MAX_SAFE_INTEGER;
const IDS = /^[A-Za-z0-9_-]{1,32}$/;
const INKS = new Set(['white', 'blue', 'green', 'purple']);
const REASONS = new Set(['typing', 'paste', 'completion', 'replace', 'delete', 'undo', 'redo']);
const TEXT_KINDS = new Set(['snapshot', 'edit', 'composition-begin', 'composition-update', 'composition-cancel', 'composition-commit']);
const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
const graphemes = text => [...segmenter.segment(text)].map(x => x.segment);
const defaults = {
  mode: 'append-only', retention: 'text', persistText: false,
  maxSources: 8, maxEventText: 256, maxDocument: 512, maxPreview: 64,
  maxBody: 256, maxPending: 512, maxJobs: 8, drainPerTick: 8,
  sources: [
    { id: 'system', control: true },
    { id: 'keys', activity: true },
    { id: 'ownedEditor', documentDiff: true, composition: true, committedText: true, stableRevision: true },
    { id: 'documentApi', documentDiff: true },
  ],
};

const integer = (n, min = 0) => Number.isSafeInteger(n) && n >= min;
const opaque = value => typeof value === 'string' && IDS.test(value);
const atBoundary = (text, offset) => offset === 0 || offset === text.length ||
  !(text.charCodeAt(offset - 1) >= 0xD800 && text.charCodeAt(offset - 1) <= 0xDBFF &&
    text.charCodeAt(offset) >= 0xDC00 && text.charCodeAt(offset) <= 0xDFFF);
const preview = (text, limit) => {
  let end = Math.min(text.length, limit);
  if (!atBoundary(text, end)) end--;
  return text.slice(0, end);
};
const bump = (state, name, count = 1) => {
  state.metrics[name] = Math.min(MAX_COUNTER, state.metrics[name] + count);
};
const pendingCount = state => state.pending.reduce((n, job) => n + job.text.length, 0);
const cancelSnapshot = state => {
  if (state.settings.mode === 'document-sync') {
    bump(state, 'cancelledSnapshots', state.pending.length); state.pending = [];
  }
};

export function createState(config = {}) {
  const settings = Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, config[key] ?? value]));
  if (!['append-only', 'document-sync'].includes(settings.mode) ||
      !['text', 'activity-only'].includes(settings.retention) || typeof settings.persistText !== 'boolean') {
    throw new TypeError('Invalid experiment mode or retention');
  }
  for (const key of ['maxSources', 'maxEventText', 'maxDocument', 'maxPreview', 'maxBody', 'maxPending', 'maxJobs', 'drainPerTick']) {
    if (!integer(settings[key], 1) || settings[key] > MAX_COUNTER) throw new TypeError(`Invalid bounded setting: ${key}`);
  }
  if (!Array.isArray(settings.sources) || settings.sources.length > settings.maxSources) throw new TypeError('Invalid source registry');
  const sources = {};
  for (const declaration of settings.sources) {
    if (!opaque(declaration.id) || Object.hasOwn(sources, declaration.id)) throw new TypeError('Invalid or repeated source id');
    const entry = { id: declaration.id, seq: 0 };
    for (const capability of ['control', 'activity', 'documentDiff', 'composition', 'committedText', 'stableRevision']) {
      entry[capability] = declaration[capability] === true;
    }
    Object.defineProperty(sources, entry.id, { value: entry, enumerable: true, writable: true, configurable: true });
  }
  delete settings.sources;
  return {
    contract: 'ambient-artificial-v1', settings, sources, epoch: 0, focus: null,
    document: null, composition: null, preview: '', lastCommitSerial: 0,
    nextGlyphId: 1, body: [], pending: [], synchronized: false,
    metrics: Object.fromEntries(['activity', 'key', 'shortcut', 'edit', 'acceptedCommits', 'unknownEdits',
      'duplicates', 'staleContext', 'invalid', 'blockedText', 'backpressure', 'capacityHolds',
      'coalesced', 'cancelledSnapshots', 'drained', 'untrustedKnownClaims'].map(k => [k, 0])),
  };
}

function reconcile(state, job) {
  const old = state.body;
  const target = job.text;
  let prefix = 0;
  while (prefix < old.length && prefix < target.length && old[prefix].text === target[prefix]) prefix++;
  let suffix = 0;
  while (suffix < old.length - prefix && suffix < target.length - prefix &&
    old[old.length - 1 - suffix].text === target[target.length - 1 - suffix]) suffix++;
  const middle = target.slice(prefix, target.length - suffix).map(text => ({
    id: state.nextGlyphId++, text, ink: job.ink, origin: job.origin,
  }));
  state.body = [...old.slice(0, prefix), ...middle, ...(suffix ? old.slice(old.length - suffix) : [])];
  state.synchronized = state.document?.version === job.version && state.epoch === job.origin.epoch;
}

export function reduce(previous, event) {
  const state = structuredClone(previous);
  const decision = (disposition, reason, knownCommit = false, retry = false) => ({
    state, decision: { ack: !retry, disposition, reason, retry, knownCommit, queued: pendingCount(state) },
  });
  const invalid = reason => { bump(state, 'invalid'); return decision('rejected', reason); };
  if (!event || !opaque(event.source) || !integer(event.seq, 1) || !integer(event.epoch)) return invalid('invalid-header');
  const source = Object.hasOwn(state.sources, event.source) ? state.sources[event.source] : null;
  // Unknown sources are rejected before touching any text or context payload.
  if (!source) { bump(state, 'blockedText'); return decision('ignored', 'unknown-source'); }
  if (event.seq <= source.seq) { bump(state, 'duplicates'); return decision('ignored', 'duplicate-sequence'); }
  const ack = () => { source.seq = event.seq; };
  const ackInvalid = reason => { ack(); return invalid(reason); };
  if (event.kind === 'focus') {
    if (!source.control || event.epoch !== state.epoch + 1) return ackInvalid('invalid-focus-epoch');
    const context = event.context;
    if (!context || !opaque(context.app) || !opaque(context.field) || !opaque(context.document) ||
      !['normal', 'unknown', 'secure'].includes(context.exposure)) return ackInvalid('invalid-focus-context');
    ack();
    state.epoch = event.epoch;
    state.focus = { app: context.app, field: context.field, document: context.document, exposure: context.exposure };
    state.document = null; state.composition = null; state.preview = ''; state.lastCommitSerial = 0;
    state.synchronized = false;
    if (state.settings.mode === 'document-sync') {
      bump(state, 'cancelledSnapshots', state.pending.length);
      state.pending = [];
      // Visible body is context-specific; do not show the previous document as the new one.
      state.body = [];
    }
    return decision('focused', 'new-context');
  }
  if (event.epoch !== state.epoch) {
    ack(); bump(state, 'staleContext'); return decision('ignored', 'stale-context');
  }
  if (event.kind === 'activity') {
    if (!source.activity || !['key', 'shortcut', 'edit'].includes(event.activityClass) || !integer(event.count, 1)) return ackInvalid('invalid-activity');
    ack(); bump(state, 'activity', event.count); bump(state, event.activityClass, event.count);
    return decision('activity', 'metadata-only');
  }
  if (event.kind === 'tick') {
    if (!source.control || (event.budget !== undefined && !integer(event.budget, 1))) return ackInvalid('invalid-tick');
    ack(); let remaining = Math.min(event.budget ?? state.settings.drainPerTick, state.settings.drainPerTick);
    if (state.settings.mode === 'append-only') {
      while (remaining && state.pending.length) {
        const job = state.pending[0];
        const count = Math.min(remaining, job.text.length);
        for (const text of job.text.splice(0, count)) state.body.push({ id: state.nextGlyphId++, text, ink: job.ink, origin: job.origin });
        remaining -= count; bump(state, 'drained', count);
        if (!job.text.length) state.pending.shift();
      }
    } else if (state.pending.length) {
      const job = state.pending[0];
      if (job.version !== state.document?.version || job.origin.epoch !== state.epoch ||
          state.document.needsResync || state.composition) {
        cancelSnapshot(state); return decision('held', 'snapshot-no-longer-current');
      }
      const cost = Math.min(remaining, job.workRemaining);
      job.workRemaining -= cost; bump(state, 'drained', cost);
      if (job.workRemaining === 0) { reconcile(state, job); state.pending = []; }
    }
    return decision('drained', 'bounded-work');
  }
  if (!TEXT_KINDS.has(event.kind)) return ackInvalid('unknown-event-kind');
  // Privacy modes branch before reading body fields, including text/change properties.
  if (!state.focus || state.focus.exposure !== 'normal' || state.settings.retention === 'activity-only') {
    ack(); bump(state, 'blockedText'); bump(state, 'activity'); bump(state, 'edit');
    return decision('activity', state.settings.retention === 'activity-only' ? 'text-retention-disabled' : 'field-text-disabled');
  }
  if (event.kind === 'snapshot') {
    if (!source.documentDiff || !integer(event.version) || typeof event.text !== 'string' ||
      event.text.length > state.settings.maxEventText || event.text.length > state.settings.maxDocument) return ackInvalid('invalid-snapshot');
    if (state.document && event.version < state.document.version) { ack(); return decision('ignored', 'stale-snapshot'); }
    ack(); state.document = { version: event.version, text: event.text, needsResync: false };
    if (event.commitSerialBaseline !== undefined) {
      if (source.committedText && event.quality === 'known' && integer(event.commitSerialBaseline) &&
          event.commitSerialBaseline >= state.lastCommitSerial) state.lastCommitSerial = event.commitSerialBaseline;
      else bump(state, 'untrustedKnownClaims');
    }
    state.preview = preview(event.text, state.settings.maxPreview); state.synchronized = false;
    state.composition = null;
    if (state.settings.mode === 'document-sync') {
      bump(state, 'cancelledSnapshots', state.pending.length); state.pending = [];
    }
    return decision('preview', 'baseline-is-not-material');
  }
  if (event.kind.startsWith('composition-')) {
    if (!source.composition || !opaque(event.compositionId)) return ackInvalid('invalid-composition-source');
    if (event.kind === 'composition-begin') {
      ack(); state.composition = { id: event.compositionId, source: source.id, text: '' };
      cancelSnapshot(state);
      state.preview = ''; return decision('preview', 'composition-start');
    }
    const matches = state.composition?.id === event.compositionId && state.composition.source === source.id;
    if (!matches) return ackInvalid('composition-not-active');
    if (event.kind === 'composition-update') {
      if (typeof event.text !== 'string' || event.text.length > state.settings.maxEventText) return ackInvalid('invalid-composition-text');
      ack(); state.composition.text = event.text; state.preview = preview(event.text, state.settings.maxPreview);
      bump(state, 'activity'); bump(state, 'edit'); return decision('preview', 'unconfirmed-composition');
    }
    if (event.kind === 'composition-cancel') {
      ack(); state.composition = null; state.preview = preview(state.document?.text ?? '', state.settings.maxPreview);
      return decision('preview', 'composition-cancelled');
    }
  }
  if (!source.documentDiff) return ackInvalid('source-has-no-document-diff');
  const known = event.quality === 'known' && source.committedText;
  if (event.quality === 'known' && !source.committedText) bump(state, 'untrustedKnownClaims');
  if (known) {
    if (!integer(event.commitSerial, 1)) return ackInvalid('missing-canonical-commit-serial');
    if (event.commitSerial <= state.lastCommitSerial) {
      ack(); bump(state, 'duplicates');
      if (event.kind === 'composition-commit') state.composition = null;
      return decision('ignored', 'duplicate-commit');
    }
    if (event.commitSerial !== state.lastCommitSerial + 1) {
      ack(); if (state.document) state.document.needsResync = true;
      cancelSnapshot(state);
      return invalid('commit-serial-gap');
    }
  }
  const change = event.change;
  if (!change || !integer(change.baseVersion) || !integer(change.version, 1) ||
      !integer(change.start) || !integer(change.deleteCount) || typeof change.text !== 'string' ||
      change.text.length > state.settings.maxEventText || change.version !== change.baseVersion + 1 ||
      (event.reason !== undefined && !REASONS.has(event.reason)) || (event.ink !== undefined && !INKS.has(event.ink))) return ackInvalid('invalid-change');
  if (!state.document) return ackInvalid('document-baseline-required');
  if (change.baseVersion < state.document.version) { ack(); return decision('ignored', 'stale-document-version'); }
  if (change.baseVersion !== state.document.version || state.document.needsResync) {
    ack(); state.document.needsResync = true; cancelSnapshot(state); return invalid('document-version-gap');
  }
  const current = state.document.text;
  const end = change.start + change.deleteCount;
  if (change.start > current.length || end > current.length || !atBoundary(current, change.start) || !atBoundary(current, end)) return ackInvalid('invalid-range');
  const nextText = current.slice(0, change.start) + change.text + current.slice(end);
  if (nextText.length > state.settings.maxDocument) return ackInvalid('document-capacity');
  const ink = event.ink ?? 'white';
  const origin = { source: source.id, epoch: state.epoch, document: state.focus.document, commitSerial: event.commitSerial ?? 0 };
  let newJob = null;
  let holdReason = null;
  if (known && state.settings.mode === 'append-only' && !['undo', 'redo'].includes(event.reason)) {
    const text = graphemes(change.text);
    if (text.length) {
      if (state.body.length + pendingCount(state) + text.length > state.settings.maxBody ||
          state.nextGlyphId + pendingCount(state) + text.length > MAX_ID) holdReason = 'body-capacity';
      else if (text.length > state.settings.maxPending) holdReason = 'single-job-capacity';
      else if (state.pending.length >= state.settings.maxJobs || pendingCount(state) + text.length > state.settings.maxPending) {
        bump(state, 'backpressure'); return decision('deferred', 'pending-capacity', true, true);
      } else newJob = { kind: 'append', text, ink, origin, version: change.version };
    }
  } else if (known && state.settings.mode === 'document-sync' && source.stableRevision && event.stableRevision === true) {
    const text = graphemes(nextText);
    if (text.length > state.settings.maxBody || state.nextGlyphId + text.length > MAX_ID) holdReason = 'body-capacity';
    else if (text.length > state.settings.maxPending) holdReason = 'single-job-capacity';
    else newJob = { kind: 'snapshot', text, ink, origin, version: change.version, workRemaining: Math.max(1, text.length) };
  }
  ack(); state.document = { version: change.version, text: nextText, needsResync: false };
  state.preview = preview(nextText, state.settings.maxPreview); state.synchronized = false;
  if (!newJob) cancelSnapshot(state);
  bump(state, 'activity'); bump(state, 'edit');
  if (event.kind === 'composition-commit') state.composition = null;
  if (!known) {
    bump(state, 'unknownEdits'); return decision('preview', 'commit-quality-unknown');
  }
  state.lastCommitSerial = event.commitSerial; bump(state, 'acceptedCommits');
  if (holdReason) {
    bump(state, 'capacityHolds');
    if (state.settings.mode === 'document-sync') {
      bump(state, 'cancelledSnapshots', state.pending.length); state.pending = [];
    }
    return decision('held', holdReason, true);
  }
  if (newJob) {
    if (state.settings.mode === 'document-sync') {
      if (state.pending.length) bump(state, 'coalesced');
      state.pending = [newJob];
    } else state.pending.push(newJob);
    return decision('queued', state.settings.mode === 'append-only' ? 'known-insertion' : 'known-stable-revision', true);
  }
  return decision('preview', state.settings.mode === 'document-sync' ? 'whole-revision-not-confirmed' : 'no-new-append-material', true);
}

export function inspect(state) {
  return {
    epoch: state.epoch, mode: state.settings.mode, retention: state.settings.retention,
    bodyCount: state.body.length, pendingCount: pendingCount(state), pendingJobs: state.pending.length,
    documentVersion: state.document?.version ?? null, documentUnits: state.document?.text.length ?? 0,
    previewUnits: state.preview.length, compositionUnits: state.composition?.text.length ?? 0,
    lastCommitSerial: state.lastCommitSerial, nextGlyphId: state.nextGlyphId,
    synchronized: state.synchronized, needsResync: state.document?.needsResync ?? false,
    highWater: Object.fromEntries(Object.entries(state.sources).map(([id, source]) => [id, source.seq])),
    metrics: { ...state.metrics },
  };
}

export function serializeForPersistence(state) {
  const result = { contract: state.contract, mode: state.settings.mode, retention: state.settings.retention,
    persistText: state.settings.persistText, metrics: { ...state.metrics } };
  if (state.settings.persistText && state.settings.retention === 'text') {
    result.body = state.body.map(({ id, text, ink }) => ({ id, text, ink }));
    result.nextGlyphId = state.nextGlyphId;
  }
  return result;
}
