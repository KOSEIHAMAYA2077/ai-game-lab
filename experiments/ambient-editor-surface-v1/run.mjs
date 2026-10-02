import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createAdapter } from '../ambient-editor-adapter-v1/adapter-r2.mjs';
import { validateStorage } from '../ambient-integration-contract-v1/storage-gate.mjs';
import { createProjection, createFrameGate } from './projection.mjs';
import { sampleSurface, MAPPING } from './.runtime/cpu-r1/surface.mjs';
const here = dirname(fileURLToPath(import.meta.url));
class Field {
  tagName = 'TEXTAREA'; value; readOnly = false; selectionStart = 0; selectionEnd = 0; listeners = new Map();
  constructor(value = '') { this.value = value; this.selectionStart = this.selectionEnd = value.length; }
  addEventListener(type, fn) { const list = this.listeners.get(type) ?? []; list.push(fn); this.listeners.set(type, list); }
  removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter(v => v !== fn)); }
  emit(type, data = {}) {
    const e = { type, target: this, isTrusted: true, isComposing: false, defaultPrevented: false, ...data };
    Object.defineProperty(e, 'clipboardData', { get() { throw new Error('clipboard accessed'); } });
    Object.defineProperty(e, 'dataTransfer', { get() { throw new Error('data transfer accessed'); } });
    (this.listeners.get(type) ?? []).forEach(fn => fn(e));
  }
}
function editor(value = '', options = {}) {
  const field = new Field(value); let at = 0;
  const adapter = createAdapter({ element: field, clock: () => at, ...options });
  const setTime = n => { at = n; };
  function edit(next, type, data = null, range = [field.value.length, field.value.length]) {
    at++; field.selectionStart = range[0]; field.selectionEnd = range[1];
    field.emit('beforeinput', { inputType: type, data });
    field.value = next; field.selectionStart = field.selectionEnd = next.length;
    field.emit('input', { inputType: type, data });
  }
  function view(time = 10000) {
    at = time; const s = adapter.advance(at), p = createProjection(), tiles = new Map();
    p.sync(adapter.readBody(), s.presentedCount, time / 1000, text => { if (!tiles.has(text)) tiles.set(text, tiles.size); return tiles.get(text); });
    return { p, tiles, snapshot: s };
  }
  return { field, adapter, edit, view, setTime };
}
const rows = [];
async function test(id, fn) { const began = performance.now(); try { rows.push({ id, pass: true, actual: await fn(), cpuMilliseconds: performance.now() - began }); } catch (error) { rows.push({ id, pass: false, failure: String(error.stack), cpuMilliseconds: performance.now() - began }); } }
const metadata = p => ({ ids: [...p.ids.slice(0, p.count)], inks: p.inks.slice(0, p.count), drawn: p.count });
const text = a => [...a.readBody()].map(u => u.text).join('');
await test('S01', () => { const e = editor(), { p } = e.view(); assert.equal(e.adapter.snapshot().bodyCount, 0); assert.equal(p.count, 0); assert.equal(p.inspect().placeholder, true); assert.deepEqual([...p.ids], Array(256).fill(0)); return p.inspect(); });
await test('S02', () => { const e = editor(); e.edit('A', 'insertText', 'A'); e.adapter.setInk('green'); e.edit('AB', 'insertText', 'B'); const { p } = e.view(); assert.equal(text(e.adapter), 'AB'); assert.deepEqual(metadata(p), { ids: [1, 2], inks: ['blue', 'green'], drawn: 2 }); return metadata(p); });
await test('S03', () => {
  const e = editor(); e.setTime(1); e.field.emit('compositionstart', { data: '' }); e.field.value = '漢'; e.field.emit('compositionupdate', { data: '漢' }); e.field.emit('input', { inputType: 'insertCompositionText', data: '漢', isComposing: true });
  assert.equal(e.adapter.snapshot().bodyCount, 0); assert.equal(e.adapter.snapshot().shape, 'sphere');
  e.field.value = '漢字'; e.setTime(2); e.field.emit('compositionend', { data: '漢字' }); e.field.emit('input', { inputType: 'insertText', data: '漢字' });
  const { p } = e.view(); assert.equal(text(e.adapter), '漢字'); assert.deepEqual(metadata(p).ids, [1, 2]); assert.equal(e.adapter.snapshot().bodyCount, 2); return { preeditMaterial: 0, final: text(e.adapter), ...metadata(p) };
});
await test('S04', () => {
  const e = editor(); e.edit('AB', 'insertFromPaste'); const original = [...e.adapter.readBody()];
  e.edit('A', 'deleteContentBackward', null, [2, 2]); e.edit('AB', 'historyUndo'); e.edit('A', 'historyRedo');
  assert.deepEqual([...e.adapter.readBody()], original); const { p } = e.view(); assert.deepEqual(metadata(p), { ids: [1, 2], inks: ['blue', 'blue'], drawn: 2 }); return { body: text(e.adapter), document: e.field.value, ...metadata(p) };
});
await test('S05', () => { const e = editor('ABC'); e.edit('AxC', 'insertReplacementText', 'x', [1, 2]); const { p } = e.view(); assert.equal(text(e.adapter), 'x'); assert.deepEqual(metadata(p).ids, [1]); return { body: text(e.adapter), ...metadata(p) }; });
await test('S06', () => { const e = editor(); e.edit('👩🏽‍💻', 'insertFromPaste'); const { p } = e.view(); assert.equal(e.adapter.snapshot().bodyCount, 1); assert.equal([...e.adapter.readBody()][0].text, '👩🏽‍💻'); assert.deepEqual(metadata(p).ids, [1]); return { unit: text(e.adapter), ...metadata(p), clipboardReads: 0 }; });
await test('S07', () => { const e = editor(); e.edit('輪', 'insertText', '輪'); e.edit('輪輪', 'insertText', '輪'); e.field.emit('input', { inputType: 'insertText', data: '輪' }); const { p, tiles } = e.view(); assert.equal(text(e.adapter), '輪輪'); assert.deepEqual(metadata(p).ids, [1, 2]); assert.equal(tiles.size, 1); return { ...metadata(p), atlasKinds: tiles.size }; });
await test('S08', () => { const e = editor(); e.edit('A'.repeat(256), 'insertFromPaste'); e.edit('A'.repeat(256) + 'B', 'insertText', 'B'); assert.equal(e.adapter.snapshot().status, 'held'); assert.equal(e.adapter.snapshot().bodyCount, 256); const { p } = e.view(); assert.deepEqual(metadata(p).ids, Array.from({ length: 256 }, (_, i) => i + 1)); assert.equal(p.count, 256); return { bodyCount: 256, drawn: p.count, extraWholeHold: true }; });
await test('S09', () => {
  let now = 0, next = 1, calls = 0; const jobs = new Map();
  const gate = createFrameGate({ clock: () => now, schedule: (fn, delay) => { const id = next++; jobs.set(id, { fn, at: now + delay }); return id; }, cancel: id => jobs.delete(id), frame: () => { calls++; } });
  const advance = to => { for (;;) { const due = [...jobs].sort((a, b) => a[1].at - b[1].at)[0]; if (!due || due[1].at >= to) break; jobs.delete(due[0]); now = due[1].at; due[1].fn(); } now = to; };
  gate.setActive(true); advance(1000); assert.ok(calls <= 15); const before = gate.inspect(); gate.setActive(false); advance(5000); assert.equal(calls, before.frames); assert.equal(jobs.size, 0); assert.equal(gate.inspect().visualSeconds, before.visualSeconds);
  gate.setActive(true); advance(5001); assert.equal(gate.inspect().visualSeconds, before.visualSeconds); gate.setActive(false); advance(9000); assert.equal(jobs.size, 0); gate.destroy(); gate.setActive(true); assert.equal(jobs.size, 0);
  return { firstSecondFrames: before.frames, resumedZeroDelta: true, inactiveJobs: 0, terminal: gate.inspect() };
});
await test('S10', () => {
  const e = editor(); e.edit('青い輪A👩🏽‍💻', 'insertFromPaste'); const original = [...e.adapter.readBody()]; let samples = 0, maxLengthError = 0, maxFrameError = 0;
  const dot = (a, b) => a.reduce((n, x, i) => n + x * b[i], 0);
  for (const shape of ['sphere', 'box', 'ring']) for (const t of [0, 3, 21]) for (let id = 1; id <= 256; id++) {
    const s = sampleSurface(shape, id, t), p = s.position, { x, y, z } = s.frame;
    assert.equal(s.receiverId, id); assert.ok([...p, ...x, ...y, ...z].every(Number.isFinite));
    const error = shape === 'sphere' ? Math.abs(Math.hypot(...p) - 1.2) : shape === 'box' ? Math.abs(p.reduce((n, v) => n + Math.abs(v) ** 12, 0) - 1) : 0;
    maxLengthError = Math.max(maxLengthError, error); assert.ok(error < 1e-9);
    const frameError = Math.max(Math.abs(dot(x, x) - 1), Math.abs(dot(y, y) - 1), Math.abs(dot(z, z) - 1), Math.abs(dot(x, y)), Math.abs(dot(x, z)), Math.abs(dot(y, z)));
    maxFrameError = Math.max(maxFrameError, frameError); assert.ok(frameError < 1e-9);
    const cross = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]]; assert.ok(dot(cross, z) > .999999999);
    samples++;
  }
  assert.deepEqual([...e.adapter.readBody()], original); assert.equal(MAPPING.ring, 'mobius'); return { samples, maxLengthError, maxFrameError, bodyUnchanged: true, ringViewOnly: 'mobius' };
});
await test('S11', () => { const e = editor(); e.edit('A', 'insertText', 'A'); e.field.value = 'Ax'; e.field.emit('input', { inputType: 'insertText', data: 'x', isTrusted: false }); const value = e.adapter.exportState(); assert.equal(validateStorage(value).valid, true); const serialized = JSON.stringify(value); for (const key of ['"text"', '"ids"', '"body"', '"inks"', '"query"', '"fingerprint"', '"window"']) assert.equal(serialized.includes(key), false); return { validated: true, keys: Object.keys(value) }; });
await test('S12', () => { const e = editor('', { shapeMode: 'deferred' }); e.edit('箱', 'insertText', '箱'); e.setTime(2001); e.adapter.advance(2001); assert.equal(e.adapter.snapshot().shapePending, true); e.edit('箱A', 'insertText', 'A'); assert.equal(e.adapter.snapshot().bodyCount, 2); assert.equal(e.adapter.snapshot().shape, 'sphere'); const { p } = e.view(2200); assert.equal(p.count, 2); return { bodyImmediately: 2, drawn: p.count, shapeWithoutAnswer: e.adapter.snapshot().shape }; });
const path = resolve(here, 'results-r1.json');
try { await access(path); throw new Error('retain previous raw results'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const cases = await readFile(resolve(here, 'CASES.json'));
await writeFile(path, JSON.stringify({ scope: 'Synthetic CPU only: no browser, GPU, actualDOM/IME/OS/resource/human proof. Raw actual strings synthetic only.', casesSha256: createHash('sha256').update(cases).digest('hex'), passed: rows.filter(r => r.pass).length, total: rows.length, rows }, null, 2) + '\n');
console.log(JSON.stringify({ passed: rows.filter(r => r.pass).length, total: rows.length, failures: rows.filter(r => !r.pass).map(r => ({ id: r.id, failure: r.failure })) }));
if (rows.some(r => !r.pass)) process.exitCode = 1;
