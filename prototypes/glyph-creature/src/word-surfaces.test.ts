import { expect, it } from 'vitest';
import { DEFAULT_SPEC, SHAPES, SHAPE_GROUPS, shapeChoices, interpret } from './language';
import { composedPosition } from './shapes';
import { surfaceFrame } from './surface-frame';
import { WORD_SURFACES, wordSurface } from './word-surfaces';
import { ShapeCycle } from './shape-cycle';

it('新しい言葉を形へ結び、包含語を重複候補にしない', () => {
  const examples = { flower: ['花', '花びら', 'blossom'], butterfly: ['蝶', 'ちょうちょ', 'butterfly'], jellyfish: ['くらげ', '水母', 'jellyfish'], tree: ['大樹', '樹木', 'tree'], star: ['星型', '星', 'star'], helix: ['螺旋', 'コイル', 'coil'], hourglass: ['砂時計', 'hourglass'], saturn: ['土星', 'saturn'], sword: ['剣', 'sword'], vase: ['花瓶', '壺', 'vase'] };
  for (const [shape, words] of Object.entries(examples)) for (const word of words) expect(shapeChoices(word)).toEqual([shape]);
  expect(shapeChoices('花火')).toEqual(['fireworks']);
  expect(shapeChoices('メビウスの輪')).toEqual(['mobius']);
  expect(interpret('青いくらげが呼吸する', DEFAULT_SPEC)).toMatchObject({ spec: { shape: 'jellyfish', motion: 'breathe' }, ink: 'blue' });
  expect(interpret('表面 黄色 花瓶 3個', DEFAULT_SPEC)).toMatchObject({ spec: { shape: 'vase', mode: 'surface', count: 3 }, ink: 'yellow' });
  expect(shapeChoices('花と土星')).toEqual(['flower', 'saturn']);
  expect(shapeChoices('offspring startling flowery')).toEqual([]);
  for (const words of ['これは形ではない', 'はなしを続ける', 'はなすこと', '木曜日']) expect(shapeChoices(words)).toEqual([]);
  expect(shapeChoices('はなを眺める')).toEqual(['flower']);
});

it('形選択の分類は全形状を重複せず覆う', () => {
  const listed = SHAPE_GROUPS.flatMap(group => group.shapes);
  expect(listed.length).toBe(SHAPES.length);
  expect([...listed].sort()).toEqual([...SHAPES].sort());
});

it('全追加形状の位置と面姿勢は少数・上限ID・長時間で有限、滑らかに変化する', () => {
  for (const shape of WORD_SURFACES) for (const time of [0, 13, 600, 3600]) for (const seed of [0, 1, 927]) {
    for (const id of [0, 1, 6, 7, 8, 9, 14, 127, 31999]) {
      const spec = { ...DEFAULT_SPEC, shape }, p = composedPosition(spec, id, time, seed), q = composedPosition(spec, id, time + .00001, seed);
      expect(p.every(Number.isFinite)).toBe(true); expect(Math.max(...p.map(Math.abs))).toBeLessThan(2);
      expect(Math.hypot(...p.map((x, i) => x - q[i]))).toBeLessThan(.001);
      const frame = surfaceFrame(spec, id, time, seed)!;
      for (const v of [frame.x, frame.y, frame.z]) { expect(v.every(Number.isFinite)).toBe(true); expect(Math.hypot(...v)).toBeCloseTo(1, 8); }
      expect(frame.x.reduce((n, x, i) => n + x * frame.y[i], 0)).toBeCloseTo(0, 8);
    }
  }
});

it('新しい形でもflowは面を保ち、現在の語と時刻を失わない', () => {
  for (const shape of WORD_SURFACES) for (const id of [1, 12, 139]) {
    const spec = { ...DEFAULT_SPEC, shape };
    expect(composedPosition(spec, id, 13)).toEqual(composedPosition({ ...spec, mode: 'flow' }, id, 13));
    expect(wordSurface(shape, id, 13, 77)).toEqual(wordSurface(shape, id, 13, 77));
    expect(wordSurface(shape, id, 13, 77)).not.toEqual(wordSurface(shape, id, 14, 77));
  }
});

it('静かな自動巡回が追加形状を一巡し、明示語で選んだ後も続く', () => {
  const cycle = new ShapeCycle(); let spec = { ...DEFAULT_SPEC };
  const visited = new Set<string>();
  for (let i = 0; i < 40; i++) { spec = cycle.advance(30, spec)!; visited.add(spec.shape); }
  for (const shape of WORD_SURFACES) expect(visited.has(shape)).toBe(true);
  expect(visited.has('fireworks')).toBe(false);
});
