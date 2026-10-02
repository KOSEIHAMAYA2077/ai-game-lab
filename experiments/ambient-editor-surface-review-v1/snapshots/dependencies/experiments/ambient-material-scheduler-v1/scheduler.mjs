// Pure artificial downstream scheduler. No I/O, real clock or platform imports.
export const PARAMETERS = Object.freeze({
  batchIntervalMs: 2000, windowLookbackMs: 6000, windowMaxUtf16: 128,
  candidateTtlMs: 6000, consistentSamples: 2, minimumShapeHoldMs: 5000,
  revealTickMs: 100, revealUnitsPerTick: 4, maximumBodyUnits: 256,
  maximumEventUtf16: 256, maximumRecentChunks: 64, maximumMetadataHistory: 64, counterSaturation: 1000000,
});
export const LEXICAL_GROUPS = Object.freeze({
  sphere: { ja: ['球', '球体', 'たま'], en: ['sphere', 'ball'] },
  box: { ja: ['箱', '立方体'], en: ['box', 'cube'] },
  ring: { ja: ['輪', 'リング'], en: ['ring', 'torus'] },
});
const POLICIES = ['per-word', 'batch', 'batch-hysteresis'];
const INKS = new Set(['white', 'blue', 'green', 'purple']);
const OPAQUE = /^[A-Za-z0-9_-]{1,32}$/;
const wordSegmenter = new Intl.Segmenter('ja', { granularity: 'word' });
const materialSegmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
const integer = (n, minimum = 0) => Number.isSafeInteger(n) && n >= minimum;
const active = state => state.visible && !state.paused;
const safeBoundary = (text, offset) => offset === 0 || offset === text.length ||
  !(text.charCodeAt(offset - 1) >= 0xD800 && text.charCodeAt(offset - 1) <= 0xDBFF &&
    text.charCodeAt(offset) >= 0xDC00 && text.charCodeAt(offset) <= 0xDFFF);
const bump = (state, key, count = 1) => { state.metrics[key] = Math.min(PARAMETERS.counterSaturation, state.metrics[key] + count); };
function record(state, kind, value) {
  const rows = state.history[kind];
  rows.push(value);
  if (rows.length > PARAMETERS.maximumMetadataHistory) { rows.shift(); bump(state, 'metadataDropped'); }
}
function peaks(state) {
  state.metrics.presentationQueuePeak = Math.max(state.metrics.presentationQueuePeak, state.body.length - state.presented);
  state.metrics.analysisPendingSlotPeak = Math.max(state.metrics.analysisPendingSlotPeak, Number(state.nextBatchAt !== Infinity));
}
function boundRecent(chunks, now) {
  let rows = chunks.filter(row => now < row.at + PARAMETERS.windowLookbackMs).map(row => ({ ...row }));
  rows = rows.slice(-PARAMETERS.maximumRecentChunks);
  let excess = rows.reduce((n, row) => n + row.text.length, 0) - PARAMETERS.windowMaxUtf16;
  while (excess > 0 && rows.length) {
    if (rows[0].text.length <= excess) { excess -= rows[0].text.length; rows.shift(); }
    else {
      let start = excess;
      if (!safeBoundary(rows[0].text, start)) start++;
      rows[0].text = rows[0].text.slice(start); excess = 0;
    }
  }
  return rows.filter(row => row.text.length);
}
function query(chunks, now) {
  const rows = boundRecent(chunks, now);
  const text = rows.map(row => row.text).join('');
  const ends = []; let offset = 0;
  for (const row of rows) { offset += row.text.length; ends.push({ end: offset, at: row.at, seq: row.seq }); }
  let result = null; let matchCount = 0;
  // ASCII folding keeps UTF-16 offsets aligned even when other Unicode lowercase mappings expand.
  const lower = text.replace(/[A-Z]/g, character => character.toLowerCase());
  let priority = 0;
  for (const [shape, aliases] of Object.entries(LEXICAL_GROUPS)) {
    for (const language of ['ja', 'en']) for (const alias of aliases[language]) {
      let start = lower.indexOf(alias);
      while (start !== -1) {
        const end = start + alias.length;
        const before = lower[start - 1] ?? ''; const after = lower[end] ?? '';
        if (language === 'ja' || (!/[a-z0-9_]/.test(before) && !/[a-z0-9_]/.test(after))) {
          matchCount++;
          const origin = ends.find(row => end <= row.end);
          const candidate = { shape, end, length: alias.length, priority, evidenceAt: origin.at, evidenceSeq: origin.seq };
          if (!result || candidate.end > result.end ||
            (candidate.end === result.end && candidate.length > result.length) ||
            (candidate.end === result.end && candidate.length === result.length && candidate.priority < result.priority)) result = candidate;
        }
        start = lower.indexOf(alias, start + 1);
      }
    }
    priority++;
  }
  return { result, queryUnits: text.length, matchCount };
}
function invalidate(state, reason) {
  if (state.candidate) {
    bump(state, 'candidateInvalidations');
    record(state, 'candidates', { at: state.now, shape: state.candidate.shape, reason });
  }
  state.candidate = null;
}
function resetLexical(state, reason, clearWindow) {
  invalidate(state, reason); state.cache = null; state.nextBatchAt = Infinity;
  state.catchup = false; state.dirty = false;
  if (clearWindow) state.recent = [];
}
function nextGrid(state, after = false) {
  const interval = PARAMETERS.batchIntervalMs;
  const relative = (state.now - state.batchAnchorAt) / interval;
  const step = Math.max(1, after ? Math.floor(relative) + 1 : Math.ceil(relative));
  return state.batchAnchorAt + step * interval;
}
function scheduleDirty(state) {
  if (!active(state)) return;
  state.nextBatchAt = Math.min(state.nextBatchAt, nextGrid(state)); peaks(state);
}
function resume(state) {
  state.batchAnchorAt = state.now; state.catchup = true; state.dirty = true;
  state.nextBatchAt = state.now + PARAMETERS.batchIntervalMs;
  if (state.presented < state.body.length) state.nextRevealAt = state.now + PARAMETERS.revealTickMs;
  peaks(state);
}
function applyCandidate(state) {
  const candidate = state.candidate;
  if (!candidate || !active(state) || state.dirty || state.now >= candidate.expiresAt) return;
  if (state.policy === 'batch-hysteresis' && (candidate.samples < PARAMETERS.consistentSamples ||
    state.now < state.lastShapeAt + PARAMETERS.minimumShapeHoldMs)) return;
  if (candidate.shape !== state.shape) {
    const delayMs = state.now - candidate.evidenceAt;
    record(state, 'changes', { at: state.now, from: state.shape, to: candidate.shape,
      evidenceAt: candidate.evidenceAt, evidenceSeq: candidate.evidenceSeq, delayMs, samples: candidate.samples });
    state.shape = candidate.shape; state.lastShapeAt = state.now;
    bump(state, 'actualShapeChanges'); bump(state, 'totalReflectionDelayMs', delayMs);
    state.metrics.maximumReflectionDelayMs = Math.max(state.metrics.maximumReflectionDelayMs, delayMs);
  }
  state.candidate = null;
}
function observe(state, result, cached = false) {
  if (!result || state.now >= result.evidenceAt + PARAMETERS.candidateTtlMs) {
    invalidate(state, result ? 'expired-observation' : 'no-lexical-match'); return;
  }
  if (result.shape === state.shape) { invalidate(state, 'already-current'); return; }
  const same = state.candidate?.shape === result.shape;
  if (!same) invalidate(state, 'changed-candidate');
  state.candidate = {
    shape: result.shape, samples: same ? Math.min(PARAMETERS.consistentSamples, state.candidate.samples + 1) : 1,
    evidenceAt: cached && same ? state.candidate.evidenceAt : result.evidenceAt,
    evidenceSeq: cached && same ? state.candidate.evidenceSeq : result.evidenceSeq,
    expiresAt: cached && same ? state.candidate.expiresAt : result.evidenceAt + PARAMETERS.candidateTtlMs,
  };
  record(state, 'candidates', { at: state.now, shape: state.candidate.shape, samples: state.candidate.samples,
    evidenceAt: state.candidate.evidenceAt, expiresAt: state.candidate.expiresAt, cached });
  applyCandidate(state);
}
function analyze(state, chunks, reason) {
  const output = query(chunks, state.now);
  bump(state, 'actualLexicalAnalysisCalls');
  record(state, 'analyses', { at: state.now, reason, queryUnits: output.queryUnits,
    matchCount: output.matchCount, shape: output.result?.shape ?? null, evidenceSeq: output.result?.evidenceSeq ?? null });
  state.cache = output.result;
  state.dirty = false;
  observe(state, output.result);
}
function processDue(state) {
  if (state.candidate && state.now >= state.candidate.expiresAt) {
    bump(state, 'candidateExpiries'); invalidate(state, 'ttl-expired');
    if (!state.dirty) state.nextBatchAt = Infinity;
  }
  if (active(state) && state.nextBatchAt <= state.now) {
    state.nextBatchAt = Infinity;
    if (state.dirty || state.catchup) {
      analyze(state, state.recent, state.catchup ? 'resume-catchup' : 'batch'); state.catchup = false;
    } else if (state.policy === 'batch-hysteresis' && state.candidate && state.cache) {
      bump(state, 'cachedConsistencySamples'); observe(state, state.cache, true);
    }
    if (state.policy === 'batch-hysteresis' && state.candidate && state.candidate.samples < PARAMETERS.consistentSamples) {
      state.nextBatchAt = nextGrid(state, true);
    }
  }
  applyCandidate(state);
  if (active(state) && state.nextRevealAt <= state.now) {
    const count = Math.min(PARAMETERS.revealUnitsPerTick, state.body.length - state.presented);
    if (count) {
      state.presented += count; bump(state, 'revealTicks'); bump(state, 'revealedUnits', count);
      record(state, 'reveals', { at: state.now, count, presented: state.presented });
    }
    state.nextRevealAt = state.presented < state.body.length ? state.now + PARAMETERS.revealTickMs : Infinity;
  }
  peaks(state);
}
function nextDeadline(state) {
  const candidate = state.candidate;
  const eligible = candidate && state.policy === 'batch-hysteresis' && !state.dirty &&
    candidate.samples >= PARAMETERS.consistentSamples && state.lastShapeAt + PARAMETERS.minimumShapeHoldMs > state.now
      ? state.lastShapeAt + PARAMETERS.minimumShapeHoldMs : Infinity;
  return Math.min(active(state) ? state.nextBatchAt : Infinity,
    active(state) ? state.nextRevealAt : Infinity, candidate?.expiresAt ?? Infinity, eligible);
}
function advanceMutable(state, at, includeEqual) {
  if (!integer(at) || at < state.now) throw new TypeError('Artificial clock must advance monotonically');
  let guard = 0;
  while (true) {
    const deadline = nextDeadline(state);
    if (deadline === Infinity || (includeEqual ? deadline > at : deadline >= at)) break;
    if (deadline < state.now) throw new Error('Scheduler deadline moved backwards');
    state.now = deadline; state.recent = boundRecent(state.recent, state.now); processDue(state);
    if (++guard > 100_000) throw new Error('Artificial clock work guard exceeded');
  }
  state.now = at; state.recent = boundRecent(state.recent, at); peaks(state);
}

export function createScheduler({ policy = 'batch-hysteresis', rawSavingOff = true, bodyLimit = PARAMETERS.maximumBodyUnits } = {}) {
  if (!POLICIES.includes(policy) || typeof rawSavingOff !== 'boolean' || !integer(bodyLimit, 1) || bodyLimit > PARAMETERS.maximumBodyUnits) {
    throw new TypeError('Invalid experiment settings');
  }
  return {
    version: 'ambient-material-scheduler-v1-r1', policy, rawSavingOff, bodyLimit,
    now: 0, lastSeq: 0, epoch: 0, context: null, visible: true, paused: false,
    body: [], nextId: 1, presented: 0, recent: [], revision: 0,
    dirty: false, cache: null, candidate: null, shape: 'sphere', lastShapeAt: 0,
    catchup: false, batchAnchorAt: 0, nextBatchAt: Infinity, nextRevealAt: Infinity,
    history: { changes: [], analyses: [], candidates: [], reveals: [], admissions: [] },
    metrics: Object.fromEntries(['receivedMaterialUnits', 'retainedMaterialUnits', 'retainedCodeUnits', 'capacityRejectedUnits',
      'actualShapeChanges', 'actualLexicalAnalysisCalls', 'cachedConsistencySamples', 'candidateExpiries',
      'candidateInvalidations', 'presentationQueuePeak', 'analysisPendingSlotPeak', 'revealTicks', 'revealedUnits',
      'metadataDropped', 'streamGapCount', 'missingSequences', 'duplicateEvents', 'staleEpoch', 'invalidEvents',
      'totalReflectionDelayMs', 'maximumReflectionDelayMs'].map(key => [key, 0])),
  };
}

export function advanceTo(previous, at, includeEqual = true) {
  const state = structuredClone(previous); advanceMutable(state, at, includeEqual); return state;
}

export function accept(previous, event) {
  const state = structuredClone(previous);
  const decision = (disposition, reason, added = 0) => ({ state, decision: { disposition, reason, added, at: state.now } });
  if (!event || !integer(event.at) || event.at < state.now || !integer(event.seq, 1) || !integer(event.epoch)) {
    bump(state, 'invalidEvents'); return decision('rejected', 'invalid-header');
  }
  // Events at a deadline are ingested before that deadline; caller flushes each timestamp after its full group.
  advanceMutable(state, event.at, false);
  if (event.seq <= state.lastSeq) { bump(state, 'duplicateEvents'); return decision('ignored', 'duplicate-sequence'); }
  if (event.seq > state.lastSeq + 1) {
    bump(state, 'streamGapCount'); bump(state, 'missingSequences', event.seq - state.lastSeq - 1);
    resetLexical(state, 'stream-gap', true);
  }
  state.lastSeq = event.seq;
  if (event.kind === 'focus') {
    if (event.epoch !== state.epoch + 1 || typeof event.context !== 'string' || !OPAQUE.test(event.context)) {
      bump(state, 'invalidEvents'); return decision('rejected', 'invalid-focus');
    }
    state.epoch = event.epoch; state.context = event.context;
    resetLexical(state, 'focus-change', true); state.batchAnchorAt = state.now;
    return decision('focused', 'context-reset');
  }
  if (event.epoch !== state.epoch || state.context === null) {
    bump(state, 'staleEpoch'); return decision('rejected', 'stale-context');
  }
  if (event.kind === 'visibility' || event.kind === 'pause') {
    if (typeof event.value !== 'boolean') { bump(state, 'invalidEvents'); return decision('rejected', 'invalid-control'); }
    const wasActive = active(state);
    if (event.kind === 'visibility') state.visible = event.value; else state.paused = event.value;
    if (wasActive && !active(state)) {
      resetLexical(state, event.kind === 'visibility' ? 'hidden' : 'paused', false); state.nextRevealAt = Infinity;
    } else if (!wasActive && active(state)) resume(state);
    return decision('controlled', active(state) ? 'active' : 'suppressed');
  }
  if (event.kind !== 'material' || event.quality !== 'known') {
    bump(state, 'invalidEvents'); return decision('rejected', 'normalized-known-material-required');
  }
  if (typeof event.text !== 'string' || event.text.length > PARAMETERS.maximumEventUtf16 || !INKS.has(event.ink)) {
    bump(state, 'invalidEvents'); return decision('rejected', 'invalid-material');
  }
  const units = [...materialSegmenter.segment(event.text)].map(row => row.segment);
  bump(state, 'receivedMaterialUnits', units.length);
  if (state.body.length + units.length > state.bodyLimit) {
    bump(state, 'capacityRejectedUnits', units.length);
    record(state, 'admissions', { at: state.now, seq: event.seq, status: 'capacity-held', units: units.length });
    return decision('held', 'body-capacity');
  }
  const priorRecent = state.recent;
  for (const text of units) state.body.push({ id: state.nextId++, text, ink: event.ink, originSeq: event.seq, originEpoch: event.epoch });
  bump(state, 'retainedMaterialUnits', units.length); bump(state, 'retainedCodeUnits', event.text.length);
  record(state, 'admissions', { at: state.now, seq: event.seq, status: 'immediate', units: units.length });
  state.revision++; state.dirty = true;
  if (active(state) && state.presented < state.body.length && state.nextRevealAt === Infinity) {
    state.nextRevealAt = state.now + PARAMETERS.revealTickMs;
  }
  if (active(state) && state.policy === 'per-word' && !state.catchup) {
    for (const segment of wordSegmenter.segment(event.text)) {
      if (!segment.isWordLike) continue;
      const prefix = event.text.slice(0, segment.index + segment.segment.length);
      analyze(state, [...priorRecent, { at: state.now, seq: event.seq, text: prefix }], 'word');
    }
    state.dirty = false;
  }
  state.recent = boundRecent([...priorRecent, { at: state.now, seq: event.seq, text: event.text }], state.now);
  if (state.policy !== 'per-word' || state.catchup) scheduleDirty(state);
  peaks(state); return decision('accepted', 'immediate-material', units.length);
}

export function exportMetadata(state) {
  const result = {
    version: state.version, policy: state.policy, rawSavingOff: state.rawSavingOff,
    now: state.now, epoch: state.epoch, visible: state.visible, paused: state.paused, shape: state.shape,
    bodyCount: state.body.length, presentedCount: state.presented,
    pendingPresentation: state.body.length - state.presented, recentCodeUnits: state.recent.reduce((n, row) => n + row.text.length, 0),
    candidate: state.candidate ? { ...state.candidate } : null, metrics: { ...state.metrics },
    material: state.body.map(({ id, ink, originSeq, originEpoch }) => ({ id, ink, originSeq, originEpoch })),
    history: structuredClone(state.history),
  };
  if (!state.rawSavingOff) result.body = state.body.map(({ id, text, ink }) => ({ id, text, ink }));
  return result;
}
