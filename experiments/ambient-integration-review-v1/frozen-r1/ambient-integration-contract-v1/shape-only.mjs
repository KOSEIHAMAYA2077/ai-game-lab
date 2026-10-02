// Reads constants only. No scheduler body/ID/reveal allocator is called.
import { PARAMETERS as P, LEXICAL_GROUPS } from '../ambient-material-scheduler-v1/scheduler.mjs';
export { P };
const active = s => s.visible && !s.paused;
const boundary = (t, i) => i === 0 || i === t.length || !(t.charCodeAt(i - 1) >= 0xD800 && t.charCodeAt(i - 1) <= 0xDBFF && t.charCodeAt(i) >= 0xDC00 && t.charCodeAt(i) <= 0xDFFF);
const bump = (s, key, n = 1) => { s.metrics[key] = Math.min(P.counterSaturation, (s.metrics[key] ?? 0) + n); };
const record = (s, key, row) => { s.history[key].push(row); if (s.history[key].length > P.maximumMetadataHistory) s.history[key].shift(); };
const chunkText = (s, row) => s.material.body.slice(row.start, row.end).map(u => u.text).join('').slice(row.trim);
function bound(s) {
  s.shape.recent = s.shape.recent.filter(r => s.now < r.at + P.windowLookbackMs).slice(-P.maximumRecentChunks);
  let excess = s.shape.recent.reduce((n, r) => n + chunkText(s, r).length, 0) - P.windowMaxUtf16;
  while (excess > 0 && s.shape.recent.length) {
    const r = s.shape.recent[0], t = chunkText(s, r);
    if (t.length <= excess) { excess -= t.length; s.shape.recent.shift(); }
    else { let cut = excess; if (!boundary(t, cut)) cut++; r.trim += cut; excess = 0; }
  }
}
export const windowLength = s => s.shape.recent.reduce((n, r) => n + chunkText(s, r).length, 0);
export function createShape(mode) {
  return { mode, current: 'sphere', lastShapeAt: 0, recent: [], generation: 0, windowRevision: 0,
    dirty: false, cache: null, candidate: null, pending: null, nextRequestId: 1,
    nextBatchAt: Infinity, anchor: 0, catchup: false };
}
export function invalidateShape(s, clearWindow = true) {
  const sh = s.shape;
  sh.generation++; sh.candidate = null; sh.pending = null; sh.cache = null;
  sh.nextBatchAt = Infinity; sh.dirty = false; sh.catchup = false;
  if (clearWindow) { sh.recent = []; sh.windowRevision++; }
}
function grid(s, after = false) {
  const relative = (s.now - s.shape.anchor) / P.batchIntervalMs;
  const step = Math.max(1, after ? Math.floor(relative) + 1 : Math.ceil(relative));
  return s.shape.anchor + step * P.batchIntervalMs;
}
export function materialToShape(s, chunks, seq, observedAt) {
  const sh = s.shape;
  sh.recent.push(...chunks.map(({ start, end }) => ({ start, end, trim: 0, at: observedAt, seq })));
  sh.windowRevision++; sh.dirty = true; sh.pending = null; bound(s);
  if (active(s)) sh.nextBatchAt = Math.min(sh.nextBatchAt, grid(s));
}
export function exposureChanged(s, wasActive) {
  if (wasActive && !active(s)) { invalidateShape(s, false); s.material.nextRevealAt = Infinity; }
  if (!wasActive && active(s)) {
    s.shape.anchor = s.now; s.shape.catchup = true; s.shape.dirty = true;
    s.shape.nextBatchAt = s.now + P.batchIntervalMs;
    if (s.material.presented < s.material.body.length) s.material.nextRevealAt = s.now + P.revealTickMs;
  }
}
function lexical(s) {
  bound(s);
  const text = s.shape.recent.map(r => chunkText(s, r)).join('');
  const lower = text.replace(/[A-Z]/g, c => c.toLowerCase());
  const ends = []; let offset = 0;
  for (const row of s.shape.recent) { offset += chunkText(s, row).length; ends.push({ end: offset, at: row.at, seq: row.seq }); }
  let result = null, priority = 0;
  for (const [shape, groups] of Object.entries(LEXICAL_GROUPS)) {
    for (const language of ['ja', 'en']) for (const alias of groups[language]) {
      let start = lower.indexOf(alias);
      while (start !== -1) {
        const end = start + alias.length;
        if (language === 'ja' || (!/[a-z0-9_]/.test(lower[start - 1] ?? '') && !/[a-z0-9_]/.test(lower[end] ?? ''))) {
          const origin = ends.find(r => end <= r.end);
          const item = { shape, end, length: alias.length, priority, evidenceAt: origin.at, evidenceSeq: origin.seq };
          if (!result || end > result.end || (end === result.end && item.length > result.length) ||
            (end === result.end && item.length === result.length && priority < result.priority)) result = item;
        }
        start = lower.indexOf(alias, start + 1);
      }
    }
    priority++;
  }
  bump(s, 'queries'); record(s, 'queries', { at: s.now, queryUnits: text.length, result: result?.shape ?? null });
  return result;
}
function apply(s) {
  const sh = s.shape, c = sh.candidate;
  if (!c || !active(s) || sh.dirty || s.now >= c.expiresAt || c.samples < P.consistentSamples || s.now < sh.lastShapeAt + P.minimumShapeHoldMs) return;
  if (c.shape !== sh.current) {
    record(s, 'changes', { at: s.now, from: sh.current, to: c.shape, evidenceAt: c.evidenceAt, delay: s.now - c.evidenceAt });
    sh.current = c.shape; sh.lastShapeAt = s.now; bump(s, 'shapeChanges');
  }
  sh.candidate = null;
}
function observe(s, result, cached = false) {
  const sh = s.shape;
  if (!result || s.now >= result.evidenceAt + P.candidateTtlMs || result.shape === sh.current) { sh.candidate = null; return; }
  const same = sh.candidate?.shape === result.shape;
  const previous = sh.candidate;
  sh.candidate = { shape: result.shape, samples: same ? Math.min(P.consistentSamples, previous.samples + 1) : 1,
    evidenceAt: cached && same ? previous.evidenceAt : result.evidenceAt,
    expiresAt: cached && same ? previous.expiresAt : result.evidenceAt + P.candidateTtlMs };
  apply(s);
  if (sh.candidate && sh.candidate.samples < P.consistentSamples) sh.nextBatchAt = grid(s, true);
}
export function shapeAnswer(s, data) {
  const sh = s.shape, p = sh.pending;
  if (!active(s) || !p || sh.dirty || s.now >= p.expiresAt ||
    ['requestId', 'focusEpoch', 'policyEpoch', 'generation', 'windowRevision'].some(k => data[k] !== p[k]) || data.shape !== p.result?.shape) {
    bump(s, 'staleAnswers'); return false;
  }
  sh.pending = null; sh.cache = p.result; bump(s, 'acceptedAnswers'); observe(s, p.result);
  return true;
}
export function latestAnswer(s) {
  const p = s.shape.pending;
  if (!p) return {};
  return Object.fromEntries(['requestId', 'focusEpoch', 'policyEpoch', 'generation', 'windowRevision'].map(k => [k, p[k]]).concat([['shape', p.result?.shape ?? null]]));
}
function due(s) {
  const sh = s.shape, m = s.material;
  if (sh.candidate && s.now >= sh.candidate.expiresAt) { sh.candidate = null; bump(s, 'candidateExpiries'); if (!sh.dirty) sh.nextBatchAt = Infinity; }
  if (sh.pending && s.now >= sh.pending.expiresAt) sh.pending = null;
  if (active(s) && sh.nextBatchAt <= s.now) {
    sh.nextBatchAt = Infinity;
    if (sh.dirty || sh.catchup) {
      const result = lexical(s); sh.dirty = false; sh.catchup = false;
      if (sh.mode === 'deferred' && result) {
        sh.pending = { requestId: sh.nextRequestId++, focusEpoch: s.focusEpoch, policyEpoch: s.policyEpoch,
          generation: sh.generation, windowRevision: sh.windowRevision, expiresAt: result.evidenceAt + P.candidateTtlMs, result };
      } else { sh.cache = result; observe(s, result); }
    } else if (sh.candidate && sh.cache) { bump(s, 'cachedSamples'); observe(s, sh.cache, true); }
  }
  apply(s);
  if (active(s) && m.nextRevealAt <= s.now) {
    const count = Math.min(P.revealUnitsPerTick, m.body.length - m.presented);
    m.presented += count;
    if (count) record(s, 'reveals', { at: s.now, count });
    m.nextRevealAt = m.presented < m.body.length ? s.now + P.revealTickMs : Infinity;
  }
}
function deadline(s) {
  const sh = s.shape, c = sh.candidate;
  const eligible = c && !sh.dirty && c.samples >= P.consistentSamples && sh.lastShapeAt + P.minimumShapeHoldMs > s.now
    ? sh.lastShapeAt + P.minimumShapeHoldMs : Infinity;
  return Math.min(active(s) ? sh.nextBatchAt : Infinity, active(s) ? s.material.nextRevealAt : Infinity,
    c?.expiresAt ?? Infinity, sh.pending?.expiresAt ?? Infinity, active(s) ? eligible : Infinity);
}
export function advance(s, at, equal = true) {
  if (!Number.isSafeInteger(at) || at < s.now) throw new TypeError('monotonic artificial delivery clock required');
  let iterations = 0;
  for (;;) {
    const next = deadline(s);
    if (next === Infinity || (equal ? next > at : next >= at)) break;
    if (next < s.now || ++iterations > 100000) throw new Error('invalid bounded scheduler clock');
    s.now = next; bound(s); due(s);
  }
  s.now = at; bound(s);
  s.metrics.queuePeak = Math.max(s.metrics.queuePeak, s.material.body.length - s.material.presented);
  return s;
}
