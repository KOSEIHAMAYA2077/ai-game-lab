import { describe, expect, it } from 'vitest';
import type { Vec3 } from './model';
import { createSurfaceFrame, normalizeSurfaceFrame } from './surface-frame';
import { defaultSkeletonSpec, skeletonSurface, skeletonSurfacePoint, SKELETON_FAMILIES, validateSkeletonSpec, type SkeletonSpec } from './skeleton-surface';

const distance = (a: Vec3, b: Vec3) => Math.hypot(...a.map((x, i) => x - b[i]));
const crossLength = (a: Vec3, b: Vec3) => Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
const closeVector = (a: Vec3, b: Vec3, precision = 8) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i], precision));
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, x, i) => sum + x * b[i], 0);
function pointNormal(spec: SkeletonSpec, u: number, v: number, time: number, part: number): Vec3 {
  const h = .00001;
  const u0 = skeletonSurfacePoint(spec, u - h, v, time, part), u1 = skeletonSurfacePoint(spec, u + h, v, time, part);
  const v0 = skeletonSurfacePoint(spec, u, v - h, time, part), v1 = skeletonSurfacePoint(spec, u, v + h, time, part);
  const du = u1.map((x, i) => (x - u0[i]) / (2 * h)) as Vec3, dv = v1.map((x, i) => (x - v0[i]) / (2 * h)) as Vec3;
  return [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]];
}

describe('bounded scaffold surfaces', () => {
  it('rejects untrusted families, missing fields, nonfinite numbers and out-of-range values', () => {
    for (const family of SKELETON_FAMILIES) {
      const valid = defaultSkeletonSpec(family);
      expect(validateSkeletonSpec(valid)).toEqual(valid);
      expect(validateSkeletonSpec({ ...valid, family: 'arbitrary code' })).toBeNull();
      for (const key of ['height', 'width', 'neck', 'bend', 'twist']) {
        for (const invalid of [NaN, Infinity, -Infinity, '1', null, undefined]) expect(validateSkeletonSpec({ ...valid, [key]: invalid })).toBeNull();
      }
      for (const [key, number] of [['height', .49], ['width', 1.81], ['neck', 1.01], ['bend', -1.01], ['twist', 1.01]] as const) {
        expect(validateSkeletonSpec({ ...valid, [key]: number })).toBeNull();
      }
    }
    for (const raw of [null, [], false, 'vase', 1]) expect(validateSkeletonSpec(raw)).toBeNull();
  });

  it('returns finite fitted points and non-degenerate surface frames at parameter extremes', () => {
    for (const family of SKELETON_FAMILIES) for (const height of [.5, 1.8]) for (const width of [.5, 1.8]) {
      for (const neck of [.15, 1]) for (const bend of [-1, 1]) for (const twist of [-1, 1]) {
        const spec: SkeletonSpec = { family, height, width, neck, bend, twist };
        for (const time of [0, 73, 4000]) for (const id of [0, 1, 11, 97, 31999]) {
          const p: Vec3 = [0, 0, 0], du: Vec3 = [0, 0, 0], dv: Vec3 = [0, 0, 0];
          expect(skeletonSurface(spec, id, time, 27, p, du, dv)).toBe(p);
          for (const vector of [p, du, dv]) expect(vector.every(Number.isFinite)).toBe(true);
          expect(Math.hypot(...p)).toBeLessThanOrEqual(1.48 + 1e-8);
          expect(crossLength(du, dv)).toBeGreaterThan(.00001);
          const frame = createSurfaceFrame(); frame.x = du; frame.y = dv; normalizeSurfaceFrame(frame);
          for (const vector of [frame.x, frame.y, frame.z]) expect(Math.hypot(...vector)).toBeCloseTo(1, 8);
        }
      }
    }
  });

  it('covers surface area in two coordinates rather than locking letters to a few orbital lines', () => {
    for (const family of SKELETON_FAMILIES) {
      const points = Array.from({ length: 2048 }, (_, id) => skeletonSurface(defaultSkeletonSpec(family), id, 17, 27));
      const octants = new Set(points.map(p => p.map(x => x >= 0 ? '+' : '-').join('')));
      expect(octants.size).toBe(8);
      for (let axis = 0; axis < 3; axis++) {
        const extent = Math.max(...points.map(p => p[axis])) - Math.min(...points.map(p => p[axis]));
        expect(extent).toBeGreaterThan(family === 'sword' && axis === 2 ? .06 : .15);
      }
      // Different glyphs receive different transverse locations, not only a
      // shared centerline. Quantized 3-D occupancy catches a sparse-line map.
      const occupied = new Set(points.map(p => p.map(x => Math.floor(x * 12)).join(',')));
      expect(occupied.size, family).toBeGreaterThan(family === 'sword' ? 150 : 300);
    }
  });

  it('uses stable identity and continuous material motion over long runs', () => {
    for (const family of SKELETON_FAMILIES) for (const id of [0, 1, 127, 31999]) for (const time of [0, 17, 4000, 1e9]) {
      const spec = defaultSkeletonSpec(family), p = skeletonSurface(spec, id, time, 27);
      expect(skeletonSurface(spec, id, time, 27)).toEqual(p);
      expect(distance(p, skeletonSurface(spec, id, time + .00001, 27))).toBeLessThan(.001);
    }
    for (const family of SKELETON_FAMILIES) {
      const spec = defaultSkeletonSpec(family);
      const displacement = Array.from({ length: 100 }, (_, id) => distance(skeletonSurface(spec, id, 0, 27), skeletonSurface(spec, id, 17, 27)));
      expect(displacement.reduce((n, value) => n + value, 0) / displacement.length).toBeGreaterThan(.10);
    }
  });

  it('Möbius local deformation keeps the half-turn identification and 4π return', () => {
    for (const height of [.5, 1.8]) for (const width of [.5, 1.8]) for (const bend of [-1, 1]) for (const twist of [-1, 1]) {
      const spec = { ...defaultSkeletonSpec('mobius'), height, width, bend, twist };
      for (const time of [0, 31, 4000]) for (const u of [-.4, 0, .23, 1.7]) for (const v of [0, .2, .5, 1]) {
        closeVector(skeletonSurfacePoint(spec, u, v, time), skeletonSurfacePoint(spec, u + 1, 1 - v, time));
        closeVector(skeletonSurfacePoint(spec, u, v, time), skeletonSurfacePoint(spec, u + 2, v, time));
      }
    }
  });

  it('ring seams agree and its material covers the inner wall as well as the outer wall', () => {
    const spec = defaultSkeletonSpec('ring');
    for (const time of [0, 73]) for (const u of [0, .23, 1.7]) for (const v of [0, .2, .5]) {
      closeVector(skeletonSurfacePoint(spec, u, v, time), skeletonSurfacePoint(spec, u + 1, v, time));
      closeVector(skeletonSurfacePoint(spec, u, v, time), skeletonSurfacePoint(spec, u, v + 1, time));
    }
    const points = Array.from({ length: 2048 }, (_, id) => skeletonSurface(spec, id, 0, 27));
    const radius = points.map(p => Math.hypot(p[0], p[1] / .85));
    expect(Math.max(...radius) / Math.min(...radius)).toBeGreaterThan(1.5);
    expect(points.filter(p => p[2] < 0).length).toBeGreaterThan(600);
    expect(points.filter(p => p[2] > 0).length).toBeGreaterThan(600);
  });

  it('height, width, neck, bend and twist change positions without adding or dropping glyphs', () => {
    for (const family of SKELETON_FAMILIES) {
      const base = defaultSkeletonSpec(family);
      for (const [key, value] of [['height', 1.8], ['width', .5], ['neck', .15], ['bend', 1], ['twist', 1]] as const) {
        const changed = { ...base, [key]: value };
        const differences = Array.from({ length: 128 }, (_, id) => distance(skeletonSurface(base, id, 17, 27), skeletonSurface(changed, id, 17, 27)));
        expect(differences.reduce((n, delta) => n + delta, 0) / differences.length, `${family}:${key}`).toBeGreaterThan(.015);
      }
    }
  });

  it('vase neck-to-belly ratio follows the neck parameter', () => {
    const ratio = (neck: number) => {
      const spec = { ...defaultSkeletonSpec('vase'), neck };
      const mouth = skeletonSurfacePoint(spec, 0, .03, 0), belly = skeletonSurfacePoint(spec, 0, .63, 0);
      return Math.abs(mouth[0] / belly[0]);
    };
    expect(ratio(.15)).toBeLessThan(.5);
    expect(ratio(1)).toBeGreaterThan(.9);
  });

  it('vase cavity, lip and outside base join exactly while the cavity closes above the base', () => {
    for (const neck of [.15, 1]) for (const bend of [-1, 1]) for (const twist of [-1, 1]) for (const time of [0, 73]) {
      const spec = { ...defaultSkeletonSpec('vase'), neck, bend, twist };
      for (const u of [0, .13, .71]) {
        closeVector(skeletonSurfacePoint(spec, u, 0, time, 0), skeletonSurfacePoint(spec, u, 1, time, 2));
        closeVector(skeletonSurfacePoint(spec, -u, 0, time, 1), skeletonSurfacePoint(spec, u, 0, time, 2));
        closeVector(skeletonSurfacePoint(spec, u, 1, time, 0), skeletonSurfacePoint(spec, u, 0, time, 3));
        closeVector(skeletonSurfacePoint(spec, u, 1, time, 1), skeletonSurfacePoint(spec, 0, 1, time, 1));
      }
      expect(skeletonSurfacePoint(spec, 0, 1, time, 1)[1]).toBeGreaterThan(skeletonSurfacePoint(spec, 0, 1, time, 3)[1]);
    }
  });

  it('outward coating normals face away from solid patches and into the vase cavity', () => {
    for (const family of ['vase', 'sword'] as const) for (const time of [0, 73]) {
      const spec = defaultSkeletonSpec(family);
      const parts = family === 'vase' ? [0, 1, 2, 3] : [0, 1, 2];
      for (const part of parts) for (const u of [0, .17, .33, .67]) for (const v of [.13, .5, .88]) {
        const normal = pointNormal(spec, u, v, time, part);
        if (family === 'vase' && part >= 2) {
          expect(normal[1] * (part === 2 ? 1 : -1)).toBeGreaterThan(.00001);
        } else {
          const p = skeletonSurfacePoint(spec, u, v, time, part), opposite = skeletonSurfacePoint(spec, u + .5, v, time, part);
          const radial = p.map((x, i) => (x - opposite[i]) / 2) as Vec3;
          expect(dot(normal, radial) * (family === 'vase' && part === 1 ? -1 : 1), `${family}:${part}`).toBeGreaterThan(.00001);
        }
      }
    }
    for (const family of ['sphere', 'cube'] as const) for (const id of [0, 1, 7, 127]) {
      const spec = defaultSkeletonSpec(family), p: Vec3 = [0, 0, 0], du: Vec3 = [0, 0, 0], dv: Vec3 = [0, 0, 0];
      skeletonSurface(spec, id, 17, 27, p, du, dv);
      const normal: Vec3 = [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]];
      expect(dot(normal, p)).toBeGreaterThan(.00001);
    }
    const ring = defaultSkeletonSpec('ring');
    for (const u of [0, .17, .67]) for (const v of [.13, .5, .88]) {
      const p = skeletonSurfacePoint(ring, u, v, 17), opposite = skeletonSurfacePoint(ring, u, v + .5, 17);
      expect(dot(pointNormal(ring, u, v, 17, 0), p.map((x, i) => (x - opposite[i]) / 2) as Vec3)).toBeGreaterThan(.00001);
    }
  });

  it('differentials returned by the renderer path agree with the material surface', () => {
    for (const family of ['vase', 'sword', 'mobius', 'ring'] as const) {
      const spec = defaultSkeletonSpec(family), frame = createSurfaceFrame(), p: Vec3 = [0, 0, 0];
      for (const id of [0, 1, 7, 9, 127]) {
        skeletonSurface(spec, id, 17, 27, p, frame.x, frame.y);
        const onlyU: Vec3 = [NaN, NaN, NaN], onlyV: Vec3 = [NaN, NaN, NaN];
        expect(skeletonSurface(spec, id, 17, 27, undefined, onlyU)).toEqual(p);
        expect(skeletonSurface(spec, id, 17, 27, undefined, undefined, onlyV)).toEqual(p);
        expect(onlyU).toEqual(frame.x); expect(onlyV).toEqual(frame.y);
      }
    }
  });
});
