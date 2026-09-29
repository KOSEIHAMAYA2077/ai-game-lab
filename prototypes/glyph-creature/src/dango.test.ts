import { describe, expect, it } from 'vitest';
import { TAU, type Vec3 } from './model';
import { createSurfaceFrame } from './surface-frame';
import { DANGO_RADIUS, DANGO_SPACING, dangoFrame, dangoPosition } from './dango';

const delta = (a: Vec3, b: Vec3): Vec3 => a.map((v, i) => v - b[i]) as Vec3;
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const normalized = (v: Vec3): Vec3 => v.map(n => n / Math.hypot(...v)) as Vec3;
const center = (id: number): Vec3 => [0, (id % 3 - 1) * DANGO_SPACING, 0];

describe('文字でできる三つの団子', () => {
  it('IDを3球へ均等配分し、surface/flowとも指定半径の球から離れない', () => {
    const counts = [0, 0, 0];
    for (let id = 0; id < 301; id++) {
      counts[id % 3]++;
      for (const mode of ['surface', 'flow'] as const) for (const time of [0, 17, 150]) {
        const p = dangoPosition(id, time, 7, mode);
        expect(Math.hypot(...delta(p, center(id)))).toBeCloseTo(DANGO_RADIUS, 10);
      }
    }
    expect(counts).toEqual([101, 100, 100]);
    expect(DANGO_RADIUS * 2).toBeGreaterThan(DANGO_SPACING);
  });

  it('表面は各球の上下左右前後を覆い、流路とは異なる位置になる', () => {
    for (const group of [0, 1, 2]) {
      const points = Array.from({ length: 256 }, (_, local) => delta(dangoPosition(local * 3 + group, 0), center(group)));
      for (const axis of [0, 1, 2]) {
        expect(Math.min(...points.map(p => p[axis]))).toBeLessThan(-.42);
        expect(Math.max(...points.map(p => p[axis]))).toBeGreaterThan(.42);
        expect(Math.abs(points.reduce((sum, p) => sum + p[axis], 0) / points.length)).toBeLessThan(.015);
      }
    }
    expect(dangoPosition(71, 3, 2, 'surface')).not.toEqual(dangoPosition(71, 3, 2, 'flow'));
  });

  it('循環の一周で位置も姿勢も戻り、継ぎ目で跳ばない', () => {
    for (const mode of ['surface', 'flow'] as const) {
      const period = TAU / (mode === 'flow' ? .30 : .22);
      for (const id of [0, 1, 2, 127, 31999]) {
        const a = dangoPosition(id, 3, 5, mode), b = dangoPosition(id, 3 + period, 5, mode);
        expect(Math.hypot(...delta(a, b))).toBeLessThan(1e-12);
        const start = dangoFrame(id, 3, 5, mode), end = dangoFrame(id, 3 + period, 5, mode);
        for (const axis of ['x', 'y', 'z'] as const) expect(dot(start[axis], end[axis])).toBeCloseTo(1, 10);
        expect(Math.hypot(...delta(dangoPosition(id, period - 1e-5, 5, mode), dangoPosition(id, period + 1e-5, 5, mode)))).toBeLessThan(1e-4);
      }
    }
  });

  it('文字の横軸は位置の時間差分へ接し、法線は外を向く', () => {
    for (const mode of ['surface', 'flow'] as const) for (const id of [1, 2, 43, 279, 31999]) {
      const time = 12, frame = dangoFrame(id, time, 4, mode);
      const velocity = normalized(delta(dangoPosition(id, time + 1e-5, 4, mode), dangoPosition(id, time - 1e-5, 4, mode)));
      expect(dot(frame.x, velocity)).toBeCloseTo(1, 8);
      expect(dot(frame.z, normalized(delta(dangoPosition(id, time, 4, mode), center(id))))).toBeCloseTo(1, 10);
      expect(dot(frame.x, frame.y)).toBeCloseTo(0, 10);
      expect(dot(frame.x, frame.z)).toBeCloseTo(0, 10);
      expect(dot(frame.y, frame.z)).toBeCloseTo(0, 10);
      for (const axis of [frame.x, frame.y, frame.z]) expect(Math.hypot(...axis)).toBeCloseTo(1, 10);
    }
  });

  it('極の直上/近辺でも有限で、同じ出力配列を再利用する', () => {
    const position: Vec3 = [0, 0, 0], frame = createSurfaceFrame(), x = frame.x, y = frame.y, z = frame.z;
    for (const seed of [0, 1e-14, (1 - 1e-14) / (.27 * .754877666246693)]) for (const time of [0, 20, 3600]) {
      expect(dangoPosition(0, time, seed, 'surface', position)).toBe(position);
      expect(dangoFrame(0, time, seed, 'surface', frame)).toBe(frame);
      expect([...position, ...frame.x, ...frame.y, ...frame.z].every(Number.isFinite)).toBe(true);
      for (const axis of [frame.x, frame.y, frame.z]) expect(Math.hypot(...axis)).toBeCloseTo(1, 10);
      expect(frame.x).toBe(x); expect(frame.y).toBe(y); expect(frame.z).toBe(z);
    }
  });
});
