import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEC } from './language';
import { contourColored, contourPageWeight, contourFrame, contourPath, contourSupported, contourVisit, facingBody, onBody, surfaceJourney } from './contour';
import type { Vec3 } from './model';
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const norm12 = (p: Vec3) => p.reduce((sum, x) => sum + x ** 12, 0);

describe('view-dependent contour circulation', () => {
  it('uses the perspective silhouette of a sphere and a readable tangent frame', () => {
    for (const camera of [[0,0,5], [4,2,-3], [-3,1,2]] as Vec3[]) for (let i = 0; i < 128; i++) {
      const { point, tangent } = contourPath('condense', i / 128, camera, [1,0,0]);
      expect(Math.hypot(...point)).toBeCloseTo(1.2, 9);
      expect(facingBody('condense', point, camera)).toBeCloseTo(0, 9);
      const axes = contourFrame(point, tangent, camera);
      expect(Math.hypot(...axes.x)).toBeCloseTo(1, 9);
      expect(dot(axes.x, axes.z)).toBeCloseTo(0, 9);
      expect(dot(axes.x, axes.y)).toBeCloseTo(0, 9);
    }
  });
  it('keeps rounded cube routes continuous, closed and on the original surface', () => {
    let last = contourPath('cube', 0, [3,2,5], [1,0,0]).point;
    let front = 0, back = 0;
    for (let i = 1; i <= 4096; i++) {
      const { point, tangent } = contourPath('cube', i / 4096, [3,2,5], [1,0,0]);
      expect(norm12(point)).toBeCloseTo(1, 8);
      expect(point.concat(tangent).every(Number.isFinite)).toBe(true);
      expect(Math.hypot(...point.map((x, axis) => x - last[axis]))).toBeLessThan(.022);
      const facing = facingBody('cube', point, [3,2,5]); if (facing > .1) front++; if (facing < -.1) back++;
      last = point;
    }
    expect(front).toBeGreaterThan(300); expect(back).toBeGreaterThan(300);
    expect(last).toEqual(contourPath('cube', 0, [3,2,5], [1,0,0]).point);
  });
  it('takes letters from face to contour and back without cutting through the body', () => {
    for (const shape of ['condense', 'cube'] as const) {
      const a = onBody(shape, [1,2,-3]), b = contourPath(shape, .3, [1,2,6], [1,0,0]).point;
      expect(surfaceJourney(shape, a, b, 0)).toEqual(a); expect(surfaceJourney(shape, a, b, 1)).toEqual(b);
      for (let i = 0; i <= 100; i++) {
        const p = surfaceJourney(shape, a, b, i / 100);
        expect(shape === 'cube' ? norm12(p) : Math.hypot(...p) / 1.2).toBeCloseTo(1, 8);
      }
      expect(surfaceJourney(shape, a, a.map(x => -x) as Vec3, .5).every(Number.isFinite)).toBe(true);
    }
  });
  it('keeps staggered visits continuous through a full cycle', () => {
    for (let id = 1; id < 10; id++) {
      let min = 1, max = 0, previous = contourVisit(id, 0);
      for (let i = 1; i <= 4320; i++) {
        const value = contourVisit(id, i / 60); min = Math.min(min, value); max = Math.max(max, value);
        expect(Math.abs(value - previous)).toBeLessThan(.005); previous = value;
      }
      expect(min).toBe(0); expect(max).toBe(1);
    }
  });
  it('rotates larger cohorts only after returning the previous letters to their surface', () => {
    expect(contourPageWeight(0, 400, 10)).toBe(1); expect(contourPageWeight(200, 400, 10)).toBe(0);
    expect(contourPageWeight(0, 400, 48)).toBe(0); expect(contourPageWeight(200, 400, 48)).toBe(0);
    expect(contourPageWeight(200, 400, 55)).toBe(1); expect(contourPageWeight(350, 400, 103)).toBe(1);
    expect(contourPageWeight(0, 400, 151)).toBe(1);
    expect(contourPageWeight(0, 80, 0)).toBe(1);
  });
  it('never recruits auto-fading or white letters and limits support to convex single bodies', () => {
    expect(contourColored(undefined)).toBe(false); expect(contourColored('white')).toBe(false); expect(contourColored('red')).toBe(true);
    expect(contourSupported({ ...DEFAULT_SPEC, shape: 'condense', motion: 'breathe' })).toBe(true);
    expect(contourSupported({ ...DEFAULT_SPEC, shape: 'cube', motion: 'wave' })).toBe(false);
    expect(contourSupported({ ...DEFAULT_SPEC, shape: 'mobius' })).toBe(false);
    expect(contourSupported({ ...DEFAULT_SPEC, shape: 'cube', count: 8 })).toBe(false);
  });
});
