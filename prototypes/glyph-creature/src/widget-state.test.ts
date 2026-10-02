import { it, expect } from 'vitest';
import { Matter, MAX_GLYPHS, MAX_INPUT_LENGTH, MAX_KINDS } from './model';
import { saveWidget, restoreWidget } from './widget-state';
it('keeps the preserved v1 storage entry unchanged on the shared web origin', () => {
  const old = '{"preserved":"old body"}', memory = new Map([['glyph-widget-state-v1', old], ['glyph-widget-state-v2', old]]);
  const store = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); } };
  const current = new Matter();
  expect(restoreWidget(current, store)).toBeNull();
  current.add('new words', 4, {seed: 123});
  expect(saveWidget(current, null, store)).toBe(true);
  expect(memory.get('glyph-widget-state-v1')).toBe(old);
  expect(memory.get('glyph-widget-state-v2')).toBe(old);
  expect(memory.has('glyph-widget-state-v3')).toBe(true);
  expect(restoreWidget(new Matter(), store)).not.toBeNull();
});
it('restores original words, their colors and motion without storing model state', () => {
  const memory = new Map<string,string>(), store = {getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>{memory.set(k,v);}};
  const a = new Matter(); a.add('過去の文字',64,{ink:'white',seed:42}); a.step(5); a.add('青い文字',64,{ink:'blue',seed:101}); a.spec.shape='mobius'; a.step(5);
  expect(saveWidget(a,null,store)).toBe(true);
  const b = new Matter(); expect(restoreWidget(b,store)?.spec.shape).toBe('mobius');
  expect(b.glyphs).toEqual(a.glyphs); expect(b.batches).toEqual(a.batches); expect(b.time).toBe(a.time);
  expect([...memory.values()][0]).not.toContain('worker');
});
it('a corrupt cache does not partly replace the current body', () => {
  const m = new Matter(); m.add('残す',2,{seed:1}); const before=JSON.stringify(m.inspect());
  expect(restoreWidget(m,{getItem:()=>'{"version":1,"batches":[]}',setItem:()=>{}})).toBeNull(); expect(JSON.stringify(m.inspect())).toBe(before);
});

function mutableStore() {
  let value = '';
  return {
    getItem: (_key: string) => value || null,
    setItem: (_key: string, next: string) => { value = next; },
    edit: (change: (state: any) => void) => { const state = JSON.parse(value); change(state); value = JSON.stringify(state); },
  };
}

it('restores a kinds-limited batch while retaining its whole original text, colors and later accepted input', () => {
  const original = new Matter(), store = mutableStore();
  const text = Array.from({ length: 1100 }, (_, i) => String.fromCodePoint(0x4e00 + i)).join('');
  const result = original.add(text, 64, { ink: 'blue', seed: 42 });
  expect(result).toMatchObject({ added: MAX_KINDS - 1, limited: true, reason: 'kinds' });
  original.step(5); original.add('一丁', 64, { ink: 'white', seed: 103 }); original.step(3);
  expect(saveWidget(original, null, store)).toBe(true);
  const restored = new Matter();
  expect(restoreWidget(restored, store)).not.toBeNull();
  expect(restored.glyphs).toEqual(original.glyphs);
  expect(restored.batches).toEqual(original.batches);
  expect(restored.batches[0].text).toBe(text);
  expect(restored.batches[0].repeat).toBe(64);
  expect(restored.time).toBe(original.time);
  expect([...restored.kinds]).toEqual([...original.kinds]);
});

it('restores a capacity-limited final batch by its accepted count rather than input times repeat', () => {
  const original = new Matter(), store = mutableStore();
  const text = 'あ'.repeat(MAX_INPUT_LENGTH);
  expect(original.add(text, 256, { ink: 'red', seed: 5 })).toMatchObject({ added: MAX_GLYPHS - 1, limited: true, reason: 'capacity' });
  expect(saveWidget(original, null, store)).toBe(true);
  const restored = new Matter();
  expect(restoreWidget(restored, store)).not.toBeNull();
  expect(restored.glyphs).toEqual(original.glyphs);
  expect(restored.batches).toEqual(original.batches);
  expect(restored.glyphs).toHaveLength(MAX_GLYPHS);
});

it.each([0, -1, 1.5, '2', undefined, MAX_GLYPHS, 1, 3])('rejects corrupt added=%s without changing the current body', added => {
  const saved = new Matter(), store = mutableStore();
  saved.add('あい', 1, { ink: 'blue', seed: 9 });
  expect(saveWidget(saved, null, store)).toBe(true);
  store.edit(state => { state.batches[0].added = added; });
  const current = new Matter(); current.add('残す', 2, { seed: 1 });
  const before = JSON.stringify(current.inspect()), glyphs = current.glyphs, batches = current.batches;
  expect(restoreWidget(current, store)).toBeNull();
  expect(JSON.stringify(current.inspect())).toBe(before);
  expect(current.glyphs).toBe(glyphs);
  expect(current.batches).toBe(batches);
});

it('a late batch reconstruction mismatch does not commit already reconstructed earlier batches', () => {
  const saved = new Matter(), store = mutableStore();
  saved.add('最初', 2, { ink: 'white', seed: 10 }); saved.step(2); saved.add('次', 2, { ink: 'blue', seed: 12 });
  expect(saveWidget(saved, null, store)).toBe(true);
  store.edit(state => { state.batches[1].added = 1; });
  const current = new Matter(); current.add('既存', 3, { ink: 'red', seed: 14 });
  const before = JSON.stringify(current.inspect()), glyphs = current.glyphs, batches = current.batches;
  expect(restoreWidget(current, store)).toBeNull();
  expect(JSON.stringify(current.inspect())).toBe(before);
  expect(current.glyphs).toBe(glyphs);
  expect(current.batches).toBe(batches);
});
