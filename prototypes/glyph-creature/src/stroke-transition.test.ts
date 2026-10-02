import { expect, it } from 'vitest';
import { dampAngle } from './stroke-transition';

const distance = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

it('何周流れた角度でも、戻すときに最短の一回転未満で収束する', () => {
  const alpha = 1 - Math.exp(-3.3 / 60);
  for (const start of [-1080.3, -18.3, Math.PI - .01, 1080.3]) {
    let current = start, travelled = 0;
    for (let i = 0; i < 180; i++) {
      const next = dampAngle(current, 0, alpha);
      const step = distance(next, current);
      expect(step).toBeLessThanOrEqual(Math.PI * alpha + 1e-12);
      expect(distance(next, 0)).toBeLessThanOrEqual(distance(current, 0) + 1e-12);
      travelled += step; current = next;
    }
    expect(travelled).toBeLessThanOrEqual(Math.PI + 1e-9);
    expect(distance(current, 0)).toBeLessThan(.001);
  }
});

it('±πの境界を越えて追従しても、見た目の方向は跳ばない', () => {
  let current = 0, previous = 0;
  for (let i = 0; i < 7200; i++) {
    current = dampAngle(current, i / 60 * .3, 1 - Math.exp(-3.3 / 60));
    expect(distance(current, previous)).toBeLessThan(.006);
    expect(Math.abs(current)).toBeLessThanOrEqual(Math.PI);
    previous = current;
  }
});
