import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEC, SHAPES, interpret, type SceneSpec } from './language';
import { animatedMobius, composedPosition, intakePosition } from './shapes';
import { Matter } from './model';

describe('言葉の組み合わせ', () => {
  it('ユーザーの例を形・流れ・色・数・配置へ分ける', () => {
    expect(interpret('流れる 赤 四角形', DEFAULT_SPEC)).toMatchObject({ spec: { shape: 'square', mode: 'flow' }, ink: 'red' });
    expect(interpret('表面 黄色 立方体', DEFAULT_SPEC)).toMatchObject({ spec: { shape: 'cube', mode: 'surface' }, ink: 'yellow' });
    expect(interpret('円 ８個', DEFAULT_SPEC).spec).toMatchObject({ shape: 'ring', count: 8, arrangement: 'swarm' });
    expect(interpret('円 八個', DEFAULT_SPEC).spec.count).toBe(8);
    expect(interpret('輪っかを八つ浮かべて', DEFAULT_SPEC).spec.count).toBe(8);
    expect(interpret('円環 鎖', DEFAULT_SPEC).spec).toMatchObject({ shape: 'ring', count: 5, arrangement: 'chain' });
    expect(interpret('流れる メビウスの輪', DEFAULT_SPEC).spec.shape).toBe('mobius');
    expect(interpret('直方体', DEFAULT_SPEC).spec.shape).toBe('cuboid');
    expect(interpret('円環 大小', DEFAULT_SPEC).spec).toMatchObject({ count: 2, deformation: 'double' });
    expect(interpret('今日はいい天気です', DEFAULT_SPEC).recognized).toBe(false);
    expect(interpret('円 999個', DEFAULT_SPEC).spec.count).toBe(16);
  });
  it('色・面だけの変更では配置を保ち、明示個数は大小の2個を解除する', () => {
    const chain = interpret('円環 鎖', DEFAULT_SPEC).spec;
    expect(interpret('赤', chain).spec).toEqual(chain);
    expect(interpret('流れる', chain).spec).toMatchObject({ arrangement: 'chain', count: 5, mode: 'flow' });
    const double = interpret('円環 大小', DEFAULT_SPEC).spec;
    expect(interpret('8個', double).spec).toMatchObject({ count: 8, deformation: 'gentle' });
    expect(interpret('立方体 大小', DEFAULT_SPEC).spec).toMatchObject({ shape: 'ring', count: 2 });
  });
  it('色は新しい文字だけに残り、普通の文章を失わない', () => {
    const matter = new Matter(); matter.add('最初の文章。', 1, { ink: 'red', seed: 3 });
    const before = matter.glyphs.map(g => g.ink);
    matter.add('表面 黄色 立方体', 1, { ink: 'yellow', seed: 7 }); matter.step(30);
    expect(matter.glyphs.slice(0, before.length).map(g => g.ink)).toEqual(before);
    expect(matter.glyphs.slice(before.length).every(g => g.ink === 'yellow')).toBe(true);
    expect(matter.batches.map(b => b.text)).toEqual(['最初の文章。', '表面 黄色 立方体']);
  });

});

describe('形と取り込みの連続性', () => {
  it('全形状・配置・表面/流路が有限で有界、時間境界で飛ばない', () => {
    for (const shape of SHAPES) for (const mode of ['flow', 'surface'] as const) for (const count of [1, 8, 16]) {
      const spec: SceneSpec = { ...DEFAULT_SPEC, shape, mode, count, arrangement: count === 1 ? 'single' : 'swarm' };
      for (const id of [0, 1, 9, 100, 31999]) for (const time of [0, 3, 999]) {
        const a = composedPosition(spec, id, time), b = composedPosition(spec, id, time + .00001);
        expect(a.every(Number.isFinite)).toBe(true); expect(Math.max(...a.map(Math.abs))).toBeLessThan(3.5);
        expect(Math.hypot(...a.map((v, i) => v - b[i]))).toBeLessThan(.002);
      }
    }
  });
  it('動くねじれでもメビウスは半周幅反転・4πで閉じ、流路と面が異なる', () => {
    for (const t of [0, 2, 30]) for (const u of [0, .7, 3]) {
      const a = animatedMobius(u, .4, t), b = animatedMobius(u + 4 * Math.PI, .4, t), c = animatedMobius(u + 2 * Math.PI, -.4, t);
      a.forEach((v, i) => { expect(b[i]).toBeCloseTo(v, 8); expect(c[i]).toBeCloseTo(v, 8); });
    }
    const flow = { ...DEFAULT_SPEC, shape: 'mobius', mode: 'flow' } as SceneSpec;
    expect(composedPosition(flow, 55, 3)).not.toEqual(composedPosition({ ...flow, mode: 'surface' }, 55, 3));
  });
  it('8個の輪は固定された8群で動き、鎖は交互の面を持つ', () => {
    const spec = interpret('円 8個', DEFAULT_SPEC).spec;
    expect(new Set(Array.from({ length: 8 }, (_, id) => composedPosition(spec, id, 0).join(','))).size).toBe(8);
    const chain = interpret('円環 鎖 8個', DEFAULT_SPEC).spec;
    expect(chain.count).toBe(8); expect(chain.arrangement).toBe('chain');
    expect(composedPosition(chain, 42, 1)).not.toEqual(composedPosition(spec, 42, 1));
  });
  it('取り込みは入力位置から始まり、到着位置に一致し、種で異なり再現できる', () => {
    const source: [number, number, number] = [1, -2, 0], target: [number, number, number] = [-1, 1, .2];
    expect(intakePosition(source, target, 0, 9)).toEqual(source);
    intakePosition(source, target, 1, 9).forEach((v, i) => expect(v).toBeCloseTo(target[i], 12));
    expect(intakePosition(source, target, .5, 9)).toEqual(intakePosition(source, target, .5, 9));
    expect(intakePosition(source, target, .5, 9)).not.toEqual(intakePosition(source, target, .5, 22));
  });
});
