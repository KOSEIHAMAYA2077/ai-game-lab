import { expect, it } from 'vitest';
import { CreatureRig, RIGGED_CREATURES, creatureRig, creatureInfluences, skinCreaturePoint } from './creature-rig';
import { expandedSurface, expandedSurfacePoint } from './expanded-surfaces';
import { DEFAULT_SPEC } from './language';
import { surfaceFrame } from './surface-frame';

it('実際の親子Boneと逆行列を持ち、初期姿勢では表面を変えない', () => {
  for (const shape of RIGGED_CREATURES) {
    const rig = new CreatureRig(shape);
    expect(rig.skeleton.boneInverses).toHaveLength(rig.bones.length);
    rig.bones.forEach((bone, i) => {
      expect(bone.isBone).toBe(true);
      const parent = rig.definitions[i].parent;
      if (parent >= 0) expect(bone.parent).toBe(rig.bones[parent]);
    });
    const point: [number, number, number] = [.31, -.29, .19];
    expect(skinCreaturePoint(shape, 32, .61, null, [...point])).toEqual(point);
  }
});

it('全てのウェイトが正規化され、親の動きが子関節へ届く', () => {
  for (const shape of RIGGED_CREATURES) for (let part = 0; part < 64; part++) for (const v of [0, .2, .51, .89, 1]) {
    const p = expandedSurfacePoint(shape, .37, v, 12, part);
    const influence = creatureInfluences(shape, part, v, p);
    expect(influence.weights.reduce((a, b) => a + b)).toBeCloseTo(1, 12);
    expect(influence.weights.every(w => w >= 0 && w <= 1)).toBe(true);
    for (const i of influence.indices) expect(i).toBeLessThan(creatureRig(shape).bones.length);
  }
  const rig = new CreatureRig('bird'), a = rig.pose(1.5), first = Array.from(a.joints), b = rig.pose(4.5);
  const wrist = 5 * 3;
  expect(Math.abs(first[wrist + 1] - b.joints[wrist + 1])).toBeGreaterThan(.30);
  expect(Math.abs(first[1] - b.joints[1])).toBeLessThan(.07);
});

it('動く表面と面姿勢が長時間も有限で、関節と時刻で飛ばない', () => {
  for (const shape of RIGGED_CREATURES) for (const time of [0, 1.5, 4.5, 60, 600, 3600]) for (let id = 0; id < 64; id++) {
    const p = expandedSurface(shape, id, time, 7), q = expandedSurface(shape, id, time + .00001, 7);
    expect(p.every(Number.isFinite)).toBe(true);
    expect(Math.max(...p.map(Math.abs))).toBeLessThan(1.85);
    expect(Math.hypot(...p.map((x, i) => x - q[i]))).toBeLessThan(.001);
    const frame = surfaceFrame({ ...DEFAULT_SPEC, shape }, id, time, 7)!;
    for (const axis of [frame.x, frame.y, frame.z]) expect(Math.hypot(...axis)).toBeCloseTo(1, 7);
  }
});

it('複数体と数値微分で文字ごとに骨行列を作り直さない', () => {
  const rig = creatureRig('fish'), before = rig.updates;
  for (let id = 0; id < 512; id++) {
    const time = 987.654 + (id % 16) * .23;
    expandedSurface('fish', id, time, 7, undefined, [0, 0, 0], [0, 0, 0]);
  }
  expect(rig.updates - before).toBe(16);
});
