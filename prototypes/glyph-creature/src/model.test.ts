import { describe, expect, it } from 'vitest';
import { Matter, FORMS, MAX_GLYPHS, MAX_KINDS, splitGlyphs, shapePosition, mobius, cameraDistance, growth, newness } from './model';

describe('文字の保持と成長', () => {
  it('濁点と結合絵文字を壊さず、大文字・全角を区別する', () => {
    expect(splitGlyphs('か\u3099 が A a Ａ 👩‍🚀 \n')).toEqual(['が', 'が', 'A', 'a', 'Ａ', '👩‍🚀']);
  });
  it('以前の文字を消さずに追記し、新しい文字だけ赤から白になる', () => {
    const matter = new Matter(); matter.add('あa?'); matter.step(10); matter.add('輪');
    expect(matter.glyphs.map(g => g.text)).toEqual(['@', 'あ', 'a', '?', '輪']);
    expect(matter.inspect().redCount).toBe(1);
    matter.step(8); expect(matter.inspect().redCount).toBe(0);
    expect(newness(-20, matter.time)).toBe(0);
  });
  it('空白で増えず、上限で既存の文字を失わない', () => {
    const matter = new Matter(); expect(matter.add(' \n ').empty).toBe(true);
    matter.add('保存'); const result = matter.add('あ'.repeat(200), 256);
    expect(result.limited).toBe(true); expect(matter.glyphs).toHaveLength(MAX_GLYPHS);
    expect(matter.glyphs.slice(0, 3).map(g => g.text)).toEqual(['@', '保', '存']);
    expect(matter.add('追加').added).toBe(0);
    matter.reset(); expect(matter.inspect().count).toBe(1); expect(matter.inspect().characters).toEqual(['@']);
  });
  it('異なる文字の上限を通知し、別の記号へ置換しない', () => {
    const matter = new Matter();
    const text = Array.from({ length: MAX_KINDS + 1 }, (_, i) => String.fromCodePoint(0x4e00 + i)).join('');
    const result = matter.add(text);
    expect(result.limited).toBe(true); expect(matter.kinds.size).toBe(MAX_KINDS);
    expect(matter.glyphs.at(-1)?.text).toBe(String.fromCodePoint(0x4e00 + MAX_KINDS - 2));
  });
  it('長すぎる入力を丸ごと断り、末尾の絵文字を切断しない', () => {
    const matter = new Matter();
    expect(matter.add('a'.repeat(16383) + '😀')).toEqual({ added: 0, limited: true, empty: false, reason: 'input' });
    expect(matter.glyphs.map(g => g.text)).toEqual(['@']);
    expect(matter.add('😀').added).toBe(1);
    expect(matter.glyphs.at(-1)?.text).toBe('😀');
  });
  it('文字数が増えると成長してカメラが引き、密度も上がる', () => {
    expect(cameraDistance(8000)).toBeGreaterThan(cameraDistance(100));
    expect(growth(8000)).toBeGreaterThan(growth(100));
    expect(8000 / growth(8000) ** 2).toBeGreaterThan(100 / growth(100) ** 2);
  });
});

describe('流れと形', () => {
  it('メビウスは一周で帯幅が反転し、二周で同じ点へ戻る', () => {
    const start = mobius(0, 0.4); const end = mobius(4 * Math.PI, 0.4); const half = mobius(2 * Math.PI, 0.4);
    start.forEach((v, i) => expect(end[i]).toBeCloseTo(v, 10));
    mobius(0, -0.4).forEach((v, i) => expect(half[i]).toBeCloseTo(v, 10));
    const before = mobius(2 * Math.PI - 1e-5, 0.4); const after = mobius(2 * Math.PI + 1e-5, 0.4);
    expect(Math.hypot(...before.map((v, i) => v - after[i]))).toBeLessThan(0.001);
  });
  it('4形状は有限で異なり、同じ時刻で再現し時間とともに流れる', () => {
    const poses = FORMS.map(form => shapePosition(form, 42, 3, 1));
    expect(new Set(poses.map(p => p.join(','))).size).toBe(4);
    for (const form of FORMS) {
      expect(shapePosition(form, 42, 3, 1)).toEqual(shapePosition(form, 42, 3, 1));
      expect(shapePosition(form, 42, 4, 1)).not.toEqual(shapePosition(form, 42, 3, 1));
      for (const id of [0, 1, 100, MAX_GLYPHS - 1]) expect(shapePosition(form, id, 1000).every(Number.isFinite)).toBe(true);
    }
  });
});
