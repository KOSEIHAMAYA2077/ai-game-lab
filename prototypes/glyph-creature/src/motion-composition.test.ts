import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEC, SHAPES, type SceneSpec } from './language';
import { composedPosition } from './shapes';
import { prepareMotion } from './motions';
import type { Vec3 } from './model';

const norm = (p: Vec3) => Math.hypot(...p);
const difference = (a: Vec3, b: Vec3) => a.map((n, i) => n - b[i]) as Vec3;
const close = (actual: Vec3, expected: Vec3, digits = 9) => actual.forEach((n, i) => expect(n).toBeCloseTo(expected[i], digits));

describe('形・運動・群配置の結合', () => {
  it('実際の形の位置に呼吸と波が届き、姿勢計算用には変形前の位置を渡す', () => {
    const time = Math.PI / 1.5, scale = Math.exp(.12);
    for (const shape of ['cube', 'mobius', 'dango'] as const) for (const mode of ['surface', 'flow'] as const) {
      const spec: SceneSpec = { ...DEFAULT_SPEC, shape, mode }, id = 17, seed = 5;
      const calm = composedPosition(spec, id, time, seed);
      const breathed = composedPosition({ ...spec, motion: 'breathe' }, id, time, seed);
      close(breathed, calm.map(n => n * scale) as Vec3);
      expect(norm(difference(breathed, calm))).toBeGreaterThan(.01);
      const local: Vec3 = [NaN, NaN, NaN], prepared = prepareMotion('wave', time);
      const waved = composedPosition({ ...spec, motion: 'wave' }, id, time, seed, prepared, local);
      close(local, calm);
      expect(waved[1]).toBeCloseTo(calm[1], 12);
      expect(norm(waved)).toBeCloseTo(norm(calm), 12);
      expect(norm(difference(waved, calm))).toBeGreaterThan(.001);
      close(waved, composedPosition({ ...spec, motion: 'wave' }, id, time, seed));
    }
  });

  it('群の中心を移動させず各形だけを変形し、鎖・大小・団子の群にも成立する', () => {
    const layouts: SceneSpec[] = [
      { ...DEFAULT_SPEC, shape: 'ring', count: 8, arrangement: 'swarm' },
      { ...DEFAULT_SPEC, shape: 'dango', count: 3, arrangement: 'swarm' },
      { ...DEFAULT_SPEC, shape: 'ring', count: 8, arrangement: 'chain' },
      { ...DEFAULT_SPEC, shape: 'ring', count: 2, arrangement: 'swarm', deformation: 'double' },
    ];
    const time = 2.1, seed = 3, scale = prepareMotion('breathe', time).scale;
    for (const spec of layouts) {
      const centers: Vec3[] = [];
      for (let group = 0; group < spec.count; group++) {
        let center: Vec3 | undefined;
        for (const localId of [0, 7, 29, 105]) {
          const id = localId * spec.count + group;
          const calm = composedPosition(spec, id, time, seed);
          const breathed = composedPosition({ ...spec, motion: 'breathe' }, id, time, seed);
          // For local scaling, B = C + s(A-C). Recover C without copying placement formulas.
          const recovered = breathed.map((n, axis) => (n - scale * calm[axis]) / (1 - scale)) as Vec3;
          if (center) close(recovered, center); else center = recovered;
          const waved = composedPosition({ ...spec, motion: 'wave' }, id, time, seed);
          // Placement is a rotation and uniform scale: local wave preserves radius around C.
          expect(norm(difference(waved, center))).toBeCloseTo(norm(difference(calm, center)), 9);
        }
        centers.push(center!);
      }
      // A world-space transform incorrectly scales every group about zero. That must fail here.
      for (let group = 1; group < centers.length; group++) {
        expect(norm(difference(centers[group], centers[group - 1]))).toBeGreaterThan(.1);
      }
    }
  });

  it('古い日記のmotion省略は全形状・配置で明示calmと同じ位置になる', () => {
    for (const shape of SHAPES) for (const count of [1, 6]) {
      const current: SceneSpec = { ...DEFAULT_SPEC, shape, count, arrangement: count === 1 ? 'single' : 'swarm' };
      const { motion: _motion, ...old } = current;
      for (const id of [0, 17, 31999]) for (const time of [0, 7, 10000]) {
        expect(composedPosition(old, id, time, 11)).toEqual(composedPosition(current, id, time, 11));
      }
    }
  });

  it('団子を含む全形状で、新しい運動・両mode・群配置が有限で時間連続になる', () => {
    for (const shape of SHAPES) for (const motion of ['breathe', 'wave'] as const) for (const mode of ['surface', 'flow'] as const) for (const count of [1, 6]) {
      const spec: SceneSpec = { ...DEFAULT_SPEC, shape, motion, mode, count, arrangement: count === 1 ? 'single' : 'swarm' };
      for (const id of [0, 7, 31999]) for (const time of [0, 2.5, 3600]) for (const seed of [0, 11]) {
        const p = composedPosition(spec, id, time, seed), next = composedPosition(spec, id, time + 1e-5, seed);
        expect(p.every(Number.isFinite)).toBe(true);
        expect(norm(p)).toBeLessThan(5);
        expect(norm(difference(next, p))).toBeLessThan(.002);
      }
    }
  });
});
