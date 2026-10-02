import { describe, expect, it } from 'vitest';
import { applyMotionFrame, applyMotionPosition, applyMotionTangent, invertMotionPosition, MOTIONS, prepareMotion } from './motions';
import { interpretMotion, motionChoices } from './motion-language';
import type { Vec3 } from './model';

const close = (actual: Vec3, expected: Vec3, digits = 10) => actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], digits));
const length = (p: Vec3) => Math.hypot(...p);
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

describe('形を保つ運動', () => {
  it('呼吸は立方体の直線・相似性を保ち、波は半径を保って逆に戻せる', () => {
    const a: Vec3 = [1, -.2, .4], b: Vec3 = [-1, .8, 1.1];
    for (const t of [0, .5, 3, 18, 10000]) {
      const breath = prepareMotion('breathe', t);
      expect(breath.scale).toBeGreaterThanOrEqual(Math.exp(-.12));
      expect(breath.scale).toBeLessThanOrEqual(Math.exp(.12));
      const midpoint = a.map((v, i) => (v + b[i]) / 2) as Vec3;
      const qa = applyMotionPosition(breath, a), qb = applyMotionPosition(breath, b);
      close(applyMotionPosition(breath, midpoint), qa.map((v, i) => (v + qb[i]) / 2) as Vec3);
      for (const kind of MOTIONS) for (const p of [a, b, [0, 0, 0] as Vec3]) {
        const motion = prepareMotion(kind, t), q = applyMotionPosition(motion, p);
        close(invertMotionPosition(motion, q), p);
        if (kind === 'wave') expect(length(q)).toBeCloseTo(length(p), 12);
      }
    }
  });

  it('変形後の接線は位置差分と一致し、法線も面に直交する', () => {
    const epsilon = 1e-5;
    const u: Vec3 = [.1, 1, -.3], v: Vec3 = [.7, -.2, .5];
    for (const kind of MOTIONS) for (const t of [0, .8, 21]) for (const p of [[.8, -.6, 1], [-1.2, .9, .3]] as Vec3[]) {
      const motion = prepareMotion(kind, t), tu = applyMotionTangent(motion, p, u), tv = applyMotionTangent(motion, p, v);
      const normal = cross(tu, tv);
      for (const tangent of [u, v]) {
        const a = applyMotionPosition(motion, p.map((x, i) => x + tangent[i] * epsilon) as Vec3);
        const b = applyMotionPosition(motion, p.map((x, i) => x - tangent[i] * epsilon) as Vec3);
        const difference = a.map((x, i) => (x - b[i]) / (2 * epsilon)) as Vec3;
        close(applyMotionTangent(motion, p, tangent), difference, 8);
        expect(dot(normal, difference)).toBeCloseTo(0, 8);
      }
    }
  });

  it('フレーム一括変換は元の位置で微分し、同じ出力配列を使い回せる', () => {
    const original: Vec3 = [.8, -.6, 1], u: Vec3 = [1, .3, .1], v: Vec3 = [-.1, .9, .4];
    const reusable = prepareMotion('calm', 0);
    for (const kind of MOTIONS) {
      expect(prepareMotion(kind, 3.2, reusable)).toBe(reusable);
      const p2: Vec3 = [...original], u2: Vec3 = [...u], v2: Vec3 = [...v];
      applyMotionFrame(reusable, p2, u2, v2, p2, u2, v2);
      close(p2, applyMotionPosition(reusable, original));
      close(u2, applyMotionTangent(reusable, original, u));
      close(v2, applyMotionTangent(reusable, original, v));
      const out: Vec3 = [0, 0, 0];
      expect(applyMotionPosition(reusable, original, out)).toBe(out);
      expect(applyMotionTangent(reusable, original, u, out)).toBe(out);
    }
  });
});

describe('運動のことば', () => {
  it('日本語文から複数候補を拾い、重複で抽選を偏らせない', () => {
    expect(motionChoices('波打つ赤い球が呼吸する。波打って、また息づく。')).toEqual(['wave', 'breathe']);
    expect(interpretMotion('呼吸する 波打つ 立方体', 'calm', () => .8)).toMatchObject({ motion: 'wave', recognized: true });
    expect(motionChoices('ＢＲＥＡＴＨＥ, WAVE!')).toEqual(['breathe', 'wave']);
  });

  it('英語の単語の一部を誤認せず、未指定維持と明示解除を区別する', () => {
    expect(motionChoices('microwave wavelength abnormality repulsing')).toEqual([]);
    expect(interpretMotion('黄色の立方体', 'breathe')).toMatchObject({ motion: 'breathe', recognized: false });
    expect(interpretMotion('普通の立方体', 'breathe')).toMatchObject({ motion: 'calm', recognized: true });
    expect(interpretMotion('揺れなし', 'wave').motion).toBe('calm');
    expect(interpretMotion('calm red cube', 'wave').motion).toBe('calm');
  });
});
