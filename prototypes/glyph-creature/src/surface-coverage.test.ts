import { expect, it } from 'vitest';
import { DEFAULT_SPEC, interpret } from './language';
import { composedPosition } from './shapes';
import { DANGO_SPACING } from './dango';
import type { Vec3 } from './model';

// Equal-area bins detect the previous one-dimensional rope, even though its
// bounding box was almost spherical and every point lay on the correct radius.
function coverage(points: Vec3[]): number {
  const bins = new Set<number>();
  for (const p of points) {
    const r = Math.hypot(...p), latitude = Math.min(7, Math.floor((p[1] / r + 1) * 4));
    const longitude = Math.min(15, Math.floor((Math.atan2(p[2], p[0]) + Math.PI) / (2 * Math.PI) * 16));
    bins.add(latitude * 16 + longitude);
  }
  return bins.size / 128;
}

it('「流れる 球体」も球全体を覆う。一本の軌道ではこの検査に通らない', () => {
  const spec = interpret('流れる 球体', DEFAULT_SPEC).spec;
  expect(spec).toMatchObject({ shape: 'condense', mode: 'flow' });
  for (const seed of [1, 7, 839]) for (const time of [0, 12, 60, 3600]) {
    const points = Array.from({ length: 2048 }, (_, id) => composedPosition(spec, id, time, seed));
    expect(coverage(points)).toBeGreaterThan(.95);
  }
  const rope = Array.from({ length: 2048 }, (_, id): Vec3 => {
    const u = id / 2048 * Math.PI * 2, latitude = .92 * Math.sin(u * 3);
    return [Math.cos(latitude) * Math.cos(u), Math.sin(latitude), Math.cos(latitude) * Math.sin(u)];
  });
  expect(coverage(rope)).toBeLessThan(.55);
});

it('流れる立方体・直方体は辺へ潰れず六面の内部に文字がある', () => {
  for (const shape of ['cube', 'cuboid'] as const) for (const time of [0, 17, 60]) {
    const extents = shape === 'cuboid' ? [1.35, .75, .55] : [1, 1, 1];
    const faces = new Array(6).fill(0);
    for (let id = 0; id < 2048; id++) {
      const p = composedPosition({ ...DEFAULT_SPEC, shape, mode: 'flow' }, id, time, 7).map((x, i) => x / extents[i]);
      for (let axis = 0; axis < 3; axis++) if (Math.abs(p[axis]) > .98 && Math.abs(p[(axis + 1) % 3]) < .7 && Math.abs(p[(axis + 2) % 3]) < .7) faces[axis * 2 + Number(p[axis] > 0)]++;
    }
    for (const count of faces) expect(count).toBeGreaterThan(60);
  }
});

it('流れる団子も三つの球それぞれの面を覆う', () => {
  for (const group of [0, 1, 2]) for (const time of [0, 60]) {
    const points = Array.from({ length: 2048 }, (_, id) => {
      const p = composedPosition({ ...DEFAULT_SPEC, shape: 'dango', mode: 'flow' }, id * 3 + group, time, 7);
      p[1] -= (group - 1) * DANGO_SPACING; return p;
    });
    expect(coverage(points)).toBeGreaterThan(.95);
  }
});
