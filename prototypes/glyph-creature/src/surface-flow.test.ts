import { describe, expect, it } from 'vitest';
import type { Vec3 } from './model';
import { DEFAULT_SPEC, type SceneSpec } from './language';
import { composedPosition } from './shapes';
import { createSurfaceFrame, normalizeSurfaceFrame, surfaceFrame } from './surface-frame';
import { cubeSurface, mobiusMaterial, mobiusSurface, quietFireworks } from './surface-flow';

const TAU = 2 * Math.PI;
const GOLDEN = .618033988749895;
const SILVER = .754877666246693;
const fract = (x: number) => x - Math.floor(x);
const distance = (a: Vec3, b: Vec3) => Math.hypot(...a.map((x, i) => x - b[i]));
const difference = (a: Vec3, b: Vec3, denominator: number): Vec3 => a.map((x, i) => (x - b[i]) / denominator) as Vec3;
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const closeVector = (a: Vec3, b: Vec3, digits = 7) => a.forEach((value, i) => expect(value).toBeCloseTo(b[i], digits));

// The v0.6.0 burst is retained only as a velocity comparison, not as the desired trajectory.
function previousFireworks(id: number, time: number, seed: number): Vec3 {
  const group = id % 3, ray = Math.floor(id / 3) % 79;
  const phase = fract(time * .19 + group / 3), opening = Math.sin(Math.PI * phase) ** 2;
  const radius = 2.1 * opening, angle = ray * 2.399963229728653;
  const z = 1 - 2 * (ray + .5) / 79, radial = Math.sqrt(1 - z * z);
  const tail = .62 + .38 * fract((id + seed * .13) * GOLDEN);
  return [Math.cos(angle) * radial * radius * tail + .35 * Math.sin(group * 2.1),
    z * radius * tail - .6 * opening ** 2 + .35, Math.sin(angle) * radial * radius * tail];
}

function speedSummary(position: (id: number, time: number, seed: number) => Vec3) {
  const h = 1 / 1200;
  let squared = 0, max = 0, count = 0;
  for (const seed of [1, 839]) for (let t = 0; t <= 120; t += .3) for (let id = 0; id < 291; id += 7) {
    const speed = distance(position(id, t + h, seed), position(id, t - h, seed)) / (2 * h);
    squared += speed * speed; max = Math.max(max, speed); count++;
  }
  return { rms: Math.sqrt(squared / count), max };
}

describe('ゆっくり変化する表面と文字の流れ', () => {
  it('メビウスの半ねじれ同一点と4π帰還を変形中も保つ', () => {
    for (const omega of [false, true]) for (const time of [0, 31, 4000]) {
      for (const u of [-7, 0, .73, 7.1]) for (const w of [-.47, -.1, 0, .47]) {
        const p = mobiusSurface(u, w, time, omega);
        closeVector(p, mobiusSurface(u + TAU, -w, time, omega), 10);
        closeVector(p, mobiusSurface(u + 2 * TAU, w, time, omega), 10);
        const du: Vec3 = [0, 0, 0], dw: Vec3 = [0, 0, 0], halfU: Vec3 = [0, 0, 0], halfW: Vec3 = [0, 0, 0];
        mobiusSurface(u, w, time, omega, [0, 0, 0], du, dw);
        mobiusSurface(u + TAU, -w, time, omega, [0, 0, 0], halfU, halfW);
        closeVector(du, halfU, 10);
        closeVector(dw, halfW.map(x => -x) as Vec3, 10);
      }
    }
  });

  it('メビウスの正規化前の解析接線が位置の中央差分と一致する', () => {
    const h = 1e-5;
    for (const omega of [false, true]) for (const time of [0, 17, 1200]) {
      for (const u of [0, .41, 2.7, TAU - h, TAU + h, 4 * TAU + .3]) for (const w of [-.47, 0, .47]) {
        const du: Vec3 = [0, 0, 0], dw: Vec3 = [0, 0, 0], out: Vec3 = [0, 0, 0];
        expect(mobiusSurface(u, w, time, omega, out, du, dw)).toBe(out);
        closeVector(du, difference(mobiusSurface(u + h, w, time, omega), mobiusSurface(u - h, w, time, omega), 2 * h));
        closeVector(dw, difference(mobiusSurface(u, w + h, time, omega), mobiusSurface(u, w - h, time, omega), 2 * h));
        const onlyU: Vec3 = [NaN, NaN, NaN], onlyW: Vec3 = [NaN, NaN, NaN];
        expect(mobiusSurface(u, w, time, omega, undefined, onlyU)).toEqual(out);
        expect(mobiusSurface(u, w, time, omega, undefined, undefined, onlyW)).toEqual(out);
        expect(onlyU).toEqual(du); expect(onlyW).toEqual(dw);
        expect(Math.hypot(...cross(du, dw))).toBeGreaterThan(.1);
      }
    }
  });

  it('丸めた立方体と直方体の表面を12乗ノルムで保持し、接線が面へ接する', () => {
    for (const cuboid of [false, true]) for (const time of [0, 31, 4000, 1e9]) {
      for (const seed of [0, 7, 0xffffffff]) for (const id of [0, 1, 127, 31999]) {
        const du: Vec3 = [0, 0, 0], dv: Vec3 = [0, 0, 0], out: Vec3 = [0, 0, 0];
        expect(cubeSurface(id, time, seed, cuboid, out, du, dv)).toBe(out);
        const onlyU: Vec3 = [NaN, NaN, NaN], onlyV: Vec3 = [NaN, NaN, NaN];
        expect(cubeSurface(id, time, seed, cuboid, undefined, onlyU)).toEqual(out);
        expect(cubeSurface(id, time, seed, cuboid, undefined, undefined, onlyV)).toEqual(out);
        expect(onlyU).toEqual(du); expect(onlyV).toEqual(dv);
        const extents = cuboid ? [1.35, .75, .55] : [1, 1, 1];
        const norm = out.reduce((sum, x, axis) => sum + (x / extents[axis]) ** 12, 0);
        expect(norm).toBeCloseTo(1, 10);
        const gradient = out.map((x, axis) => (x / extents[axis]) ** 11 / extents[axis]) as Vec3;
        for (const tangent of [du, dv]) {
          expect(tangent.every(Number.isFinite)).toBe(true);
          expect(Math.hypot(...tangent)).toBeGreaterThan(.05);
          expect(dot(gradient, tangent)).toBeCloseTo(0, 10);
        }
        expect(Math.hypot(...cross(du, dv))).toBeGreaterThan(.1);
      }
    }
  });

  it('立方体の生の接線は初期球面の経度の単位接線と極角の中央差分に一致する', () => {
    const h = 1e-4;
    // A fractional seed keeps the seeded hash constant during this small perturbation.
    // id ± .27h, seed ∓ h changes only longitude; id ∓ .13h, seed ± h changes only y.
    for (const cuboid of [false, true]) for (const time of [0, 31, 400]) {
      for (const seed of [7.25, 123.25]) for (const id of [1, 17, 512, 31999]) {
        const b = fract((id + seed * .27) * SILVER), y = 2 * b - 1, radius = Math.sqrt(1 - y * y);
        const du: Vec3 = [0, 0, 0], dv: Vec3 = [0, 0, 0];
        cubeSurface(id, time, seed, cuboid, [0, 0, 0], du, dv);
        const longitudeStep = .14 * GOLDEN * TAU * h;
        const longitudeDerivative = difference(cubeSurface(id + .27 * h, time, seed - h, cuboid),
          cubeSurface(id - .27 * h, time, seed + h, cuboid), 2 * longitudeStep * radius);
        const yStep = .28 * SILVER * h;
        const polarAngleDifference = Math.acos(y + yStep) - Math.acos(y - yStep);
        const polarDerivative = difference(cubeSurface(id - .13 * h, time, seed + h, cuboid),
          cubeSurface(id + .13 * h, time, seed - h, cuboid), polarAngleDifference);
        // Large ids incur cancellation in the material-coordinate perturbation.
        closeVector(du, longitudeDerivative, 5);
        closeVector(dv, polarDerivative, 5);
      }
    }
  });

  it('位置と接線の共有計算は従来の位置・個別フレームと同じ結果を返す', () => {
    const forms: Partial<SceneSpec>[] = [
      { shape: 'cube', mode: 'surface' }, { shape: 'cuboid', mode: 'surface' },
      { shape: 'mobius', mode: 'surface' }, { shape: 'mobius', mode: 'flow' },
      { shape: 'mobius', mode: 'surface', deformation: 'omega' },
      { shape: 'mobius', mode: 'flow', deformation: 'omega' },
    ];
    const shared = createSurfaceFrame(), local: Vec3 = [NaN, NaN, NaN];
    for (const form of forms) for (const motion of ['calm', 'breathe', 'wave'] as const) {
      const spec = { ...DEFAULT_SPEC, ...form, motion };
      for (const time of [0, 1, 17, 1200]) for (const seed of [0, 7]) for (const id of [0, 1, 311, 31999]) {
        const p = composedPosition(spec, id, time, seed, undefined, local, shared);
        expect(p).toEqual(composedPosition(spec, id, time, seed));
        // Tangents and localPoint describe the surface before the optional motion.
        expect(local).toEqual(composedPosition({ ...spec, motion: 'calm' }, id, time, seed));
        normalizeSurfaceFrame(shared);
        const separate = surfaceFrame(spec, id, time, seed)!;
        for (const axis of ['x', 'y', 'z'] as const) closeVector(shared[axis], separate[axis], 12);
      }
    }
  });

  it('文字が帯の外へ出ず、長時間でも有限かつ時間連続でseedを再現する', () => {
    for (const seed of [0, 7, 0xffffffff]) for (const id of [0, 1, 511, 31999]) {
      for (const time of [0, 1, 31, 4000, 1e9]) for (const surface of [false, true]) {
        const uv = mobiusMaterial(id, time, seed, surface);
        expect(uv.every(Number.isFinite)).toBe(true);
        expect(Math.abs(uv[1])).toBeLessThanOrEqual(.47 + 1e-12);
        expect(mobiusMaterial(id, time, seed, surface)).toEqual(uv);
        const later = mobiusMaterial(id, time + 1e-4, seed, surface);
        expect(distance(mobiusSurface(...uv, time), mobiusSurface(...later, time + 1e-4))).toBeLessThan(.001);
      }
      for (const position of [cubeSurface, quietFireworks]) for (const time of [0, 31, 4000, 1e9]) {
        const p = position(id, time, seed);
        expect(p.every(Number.isFinite)).toBe(true);
        expect(position(id, time, seed)).toEqual(p);
        expect(distance(p, position(id, time + 1e-4, seed))).toBeLessThan(.001);
      }
    }
    for (const position of [cubeSurface, quietFireworks]) {
      const delta = Array.from({ length: 30 }, (_, id) => distance(position(id, 17, 7), position(id, 17, 839)));
      expect(delta.reduce((sum, x) => sum + x, 0) / delta.length).toBeGreaterThan(.1);
    }
    expect(mobiusMaterial(12, 17, 7, true)).not.toEqual(mobiusMaterial(12, 17, 839, true));
  });

  it('花火の移動速度を旧版より抑え、各群が周期的に一点へ潰れない', () => {
    const before = speedSummary(previousFireworks), after = speedSummary(quietFireworks);
    expect(after.rms).toBeLessThan(before.rms * .35);
    expect(after.max).toBeLessThan(before.max * .4);
    for (const seed of [1, 839]) for (let time = 0; time <= 120; time += .5) for (let group = 0; group < 3; group++) {
      const points = Array.from({ length: 97 }, (_, ray) => quietFireworks(3 * ray + group, time, seed));
      const center = points.reduce((p, q) => p.map((x, i) => x + q[i] / points.length) as Vec3, [0, 0, 0] as Vec3);
      const variance = points.reduce((sum, p) => sum + distance(p, center) ** 2, 0) / points.length;
      expect(Math.sqrt(variance)).toBeGreaterThan(.05);
    }
  });
});
