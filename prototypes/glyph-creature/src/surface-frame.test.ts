import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEC, type SceneSpec } from './language';
import { shapePosition, TAU, type Vec3 } from './model';
import { animatedMobius, composedPosition } from './shapes';
import { createSurfaceFrame, mobiusFrame, surfaceFrame, type SurfaceFrame } from './surface-frame';

const dot = (a: Vec3, b: Vec3) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const diff = (a: Vec3, b: Vec3): Vec3 => a.map((value, i) => value - b[i]) as Vec3;
const unit = (v: Vec3): Vec3 => v.map(value => value / Math.hypot(...v)) as Vec3;
const fract = (value: number) => value - Math.floor(value);
function orthonormal(frame: SurfaceFrame) {
  for (const axis of [frame.x, frame.y, frame.z]) {
    expect(axis.every(Number.isFinite)).toBe(true);
    expect(Math.hypot(...axis)).toBeCloseTo(1, 10);
  }
  expect(dot(frame.x, frame.y)).toBeCloseTo(0, 10);
  expect(dot(frame.x, frame.z)).toBeCloseTo(0, 10);
  expect(dot(frame.y, frame.z)).toBeCloseTo(0, 10);
  const cross: Vec3 = [frame.x[1] * frame.y[2] - frame.x[2] * frame.y[1], frame.x[2] * frame.y[0] - frame.x[0] * frame.y[2], frame.x[0] * frame.y[1] - frame.x[1] * frame.y[0]];
  expect(dot(cross, frame.z)).toBeCloseTo(1, 10);
}

describe('文字を形の接線へ沿わせる候補フレーム', () => {
  it('メビウスの解析接線は元の位置関数のu/w微小差分と一致する', () => {
    const h = 1e-5;
    for (const omega of [false, true]) for (const time of [0, 13, 51]) for (const u of [0, .4, 3, 2 * Math.PI, 4 * Math.PI + .8]) for (const w of [-.47, 0, .47]) {
      const frame = mobiusFrame(u, w, time, omega); orthonormal(frame);
      const du = unit(diff(animatedMobius(u + h, w, time, omega), animatedMobius(u - h, w, time, omega)));
      const dw = unit(diff(animatedMobius(u, w + h, time, omega), animatedMobius(u, w - h, time, omega)));
      expect(dot(frame.x, du)).toBeCloseTo(1, 8);
      expect(dot(frame.z, dw)).toBeCloseTo(0, 8);
    }
  });

  it('メビウスの継ぎ目で姿勢が跳ばず、半周の幅反転と一周の復帰を保つ', () => {
    for (const omega of [false, true]) {
      const start = mobiusFrame(.7, .35, 19, omega), lap = mobiusFrame(.7 + TAU * 2, .35, 19, omega);
      const half = mobiusFrame(.7 + TAU, .35, 19, omega), opposite = mobiusFrame(.7, -.35, 19, omega);
      for (const axis of ['x', 'y', 'z'] as const) expect(dot(start[axis], lap[axis])).toBeCloseTo(1, 10);
      expect(dot(half.x, opposite.x)).toBeCloseTo(1, 10);
      expect(dot(half.y, opposite.y)).toBeCloseTo(-1, 10);
      expect(dot(half.z, opposite.z)).toBeCloseTo(-1, 10);
      const before = mobiusFrame(TAU - 1e-5, .35, 19, omega), after = mobiusFrame(TAU + 1e-5, .35, 19, omega);
      for (const axis of ['x', 'y', 'z'] as const) expect(dot(before[axis], after[axis])).toBeGreaterThan(.999999);
    }
  });

  it('球のフレームは元の変形した表面へ接し、独立した位置パラメータの差分と一致する', () => {
    const spec = { ...DEFAULT_SPEC }, h = 1e-5;
    for (const id of [1, 17, 512, 31999]) for (const time of [0, 13, 200]) {
      const seed = 7, frame = surfaceFrame(spec, id, time, seed)!; orthonormal(frame);
      expect(composedPosition(spec, id, time, seed)).toEqual(shapePosition('condense', id, time, seed));
      // Holding b constant changes only longitude; holding a constant changes latitude.
      // Use model's original position function with fractional id, avoiding composedPosition's floor.
      const da = diff(shapePosition('condense', id + .27 * h, time, seed - h), shapePosition('condense', id - .27 * h, time, seed + h));
      const db = diff(shapePosition('condense', id - .13 * h, time, seed + h), shapePosition('condense', id + .13 * h, time, seed - h));
      expect(dot(frame.x, unit(da))).toBeCloseTo(1, 7);
      expect(dot(frame.z, unit(db))).toBeCloseTo(0, 7);
    }
  });

  it('球の流路では文字横軸が曲線へ接し、法線は球の外向きになる', () => {
    const spec: SceneSpec = { ...DEFAULT_SPEC, mode: 'flow' }, h = 1e-5;
    for (const id of [0, 12, 713, 31999]) for (const time of [0, 17]) {
      const frame = surfaceFrame(spec, id, time, 5)!; orthonormal(frame);
      const forward = composedPosition(spec, id, time + h, 5), backward = composedPosition(spec, id, time - h, 5);
      expect(dot(frame.x, unit(diff(forward, backward)))).toBeCloseTo(1, 8);
      expect(dot(frame.z, unit(composedPosition(spec, id, time, 5)))).toBeCloseTo(1, 8);
    }
  });

  it('メビウスのglyphパラメータは元の配置と一致し、出力を再利用できる', () => {
    const out = createSurfaceFrame(), identities = [out.x, out.y, out.z];
    for (const mode of ['flow', 'surface'] as const) for (const deformation of ['gentle', 'omega'] as const) for (const id of [0, 31, 31999]) {
      const spec: SceneSpec = { ...DEFAULT_SPEC, shape: 'mobius', mode, deformation };
      const time = 7, seed = 3, a = fract((id + seed * .13) * .618033988749895), b = fract((id + seed * .27) * .754877666246693);
      const u = a * TAU * 2 + time * .33, w = mode === 'surface' ? (b - .5) * .94 : .37 + (b - .5) * .025;
      expect(composedPosition(spec, id, time, seed)).toEqual(animatedMobius(u, w, time, deformation === 'omega'));
      expect(surfaceFrame(spec, id, time, seed, out)).toBe(out);
      expect(out).toEqual(mobiusFrame(u, w, time, deformation === 'omega'));
      expect(out.x).toBe(identities[0]); expect(out.y).toBe(identities[1]); expect(out.z).toBe(identities[2]);
    }
  });

  it('対象外は出力を変えずnull、球の極でも有限の基底を返す', () => {
    const out = createSurfaceFrame(), original = structuredClone(out);
    for (const partial of [{ shape: 'orbit' }, { shape: 'ring' }, { count: 2 }, { arrangement: 'chain' }, { arrangement: 'swarm' }, { deformation: 'double' }] as Partial<SceneSpec>[]) {
      expect(surfaceFrame({ ...DEFAULT_SPEC, ...partial }, 1, 1, 1, out)).toBeNull();
      expect(out).toEqual(original);
    }
    for (const time of [0, 13, 200, 3600]) orthonormal(surfaceFrame(DEFAULT_SPEC, 0, time, 0)!);
  });
});
