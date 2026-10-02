import { expect, it } from 'vitest';
import { wordSurfacePoint } from './word-surfaces';

it('傘が約7秒で収縮し、幅と高さが別々に変わる', () => {
  const narrow = wordSurfacePoint('jellyfish', 0, 1, 1.8, 0);
  const wide = wordSurfacePoint('jellyfish', 0, 1, 5.4, 0);
  expect(narrow[0] / wide[0]).toBeGreaterThan(.87);
  expect(narrow[0] / wide[0]).toBeLessThan(.93);
  const height = (time: number) => wordSurfacePoint('jellyfish', 0, 0, time, 0)[1]
    - wordSurfacePoint('jellyfish', 0, 1, time, 0)[1];
  expect(height(1.8) / height(5.4)).toBeGreaterThan(1.04);
  expect(height(1.8) / height(5.4)).toBeLessThan(1.11);
});

it('全触手が拍動中も傘の縁へつながり、先端はそれぞれ遅れて揺れる', () => {
  for (const time of [0, 1.8, 3.6, 5.4, 120, 3600]) for (let arm = 0; arm < 8; arm++) {
    const rim = wordSurfacePoint('jellyfish', arm / 8, 1, time, 0);
    const root = wordSurfacePoint('jellyfish', .25, 0, time, 24 + arm);
    expect(Math.hypot(...root.map((value, axis) => value - rim[axis]))).toBeCloseTo(.031, 6);
    const tip = wordSurfacePoint('jellyfish', .25, 1, time, 24 + arm);
    const next = wordSurfacePoint('jellyfish', .25, 1, time + .00001, 24 + arm);
    expect(tip.every(Number.isFinite)).toBe(true);
    expect(Math.hypot(...tip.map((value, axis) => value - next[axis]))).toBeLessThan(.0001);
  }
});
