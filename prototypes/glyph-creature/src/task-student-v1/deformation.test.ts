import { describe, expect, it } from 'vitest';
import { boundedParams, deformationParams, deformPoint, deformVector, deformBasis } from './deformation';

describe('independent student surface deformation', () => {
  it('uses the bounded lengths, widths and curvature requested by each head', () => {
    expect(deformationParams({ length: 'long', width: 'narrow', bend: 'curved' })).toEqual({ length: 1.65, width: .65, bend: .35 });
    expect(deformationParams({ length: 'short', width: 'wide', bend: 'straight' })).toEqual({ length: .7, width: 1.5, bend: 0 });
    expect(boundedParams({ length: Infinity, width: -10, bend: 5 })).toEqual({ length: 1, width: .65, bend: .35 });
  });

  it('has a finite, bounded bow for both settled surfaces and long intake paths', () => {
    const params = deformationParams({ length: 'long', width: 'narrow', bend: 'curved' });
    for (const y of [-100, -5, -2, 0, 2, 5, 100]) {
      const point = deformPoint([2, y, -3], params);
      expect(point.every(Number.isFinite)).toBe(true);
      expect(point[0] - 2 * params.width).toBeGreaterThanOrEqual(-1e-10);
      expect(point[0] - 2 * params.width).toBeLessThanOrEqual(.700000001);
    }
  });

  it('uses the derivative of the position map to keep tangents on the same surface', () => {
    const params = deformationParams({ length: 'long', width: 'wide', bend: 'curved' });
    const p = [.4, -.9, 1.2], v = [.3, .8, -.4], epsilon = 1e-5;
    const left = deformPoint(p.map((n, i) => n - epsilon * v[i]), params);
    const right = deformPoint(p.map((n, i) => n + epsilon * v[i]), params);
    const tangent = deformVector(v, p, params);
    for (let axis = 0; axis < 3; axis++) expect((right[axis] - left[axis]) / (2 * epsilon)).toBeCloseTo(tangent[axis], 8);
  });

  it('keeps letter frames orthonormal across the extreme attribute combinations', () => {
    const dot = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i], 0);
    for (const length of ['short', 'neutral', 'long'] as const) for (const width of ['narrow', 'neutral', 'wide'] as const) {
      const params = deformationParams({ length, width, bend: 'curved' });
      for (const y of [-3, -1, 0, 1, 3]) {
        const frame = deformBasis([Math.SQRT1_2, Math.SQRT1_2, 0], [-Math.SQRT1_2, Math.SQRT1_2, 0], [.3, y, -.7], params);
        for (const axis of [frame.x, frame.y, frame.z]) { expect(axis.every(Number.isFinite)).toBe(true); expect(Math.hypot(...axis)).toBeCloseTo(1, 10); }
        expect(dot(frame.x, frame.y)).toBeCloseTo(0, 10);
        expect(dot(frame.x, frame.z)).toBeCloseTo(0, 10);
        expect(dot(frame.y, frame.z)).toBeCloseTo(0, 10);
      }
    }
  });
});
