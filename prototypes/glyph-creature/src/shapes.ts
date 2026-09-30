import type { SceneSpec } from './language';
import { shapePosition, TAU, type Vec3 } from './model';
import { applyMotionPosition, prepareMotion, type MotionTransform } from './motions';
import { dangoPosition } from './dango';
import { mobiusMaterial, mobiusSurface, sphereSurface, cubeSurface, quietFireworks } from './surface-flow';

const fract = (n: number) => n - Math.floor(n);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function animatedMobius(u: number, w: number, t: number, omega = false): Vec3 {
  return mobiusSurface(u, w, t, omega);
}

function polygon(u: number, vertices: [number, number][]): Vec3 {
  const lengths = vertices.map((a, i) => Math.hypot(a[0] - vertices[(i + 1) % vertices.length][0], a[1] - vertices[(i + 1) % vertices.length][1]));
  let d = fract(u) * lengths.reduce((a, b) => a + b, 0);
  let edge = 0;
  while (edge < lengths.length - 1 && d > lengths[edge]) d -= lengths[edge++];
  const a = vertices[edge], b = vertices[(edge + 1) % vertices.length];
  return [mix(a[0], b[0], d / lengths[edge]), mix(a[1], b[1], d / lengths[edge]), 0];
}
const square: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const triangle: [number, number][] = [[0, 1.3], [-1.12, -.65], [1.12, -.65]];
const cross: [number, number][] = [[-.32,-1.2],[.32,-1.2],[.32,-.32],[1.2,-.32],[1.2,.32],[.32,.32],[.32,1.2],[-.32,1.2],[-.32,.32],[-1.2,.32],[-1.2,-.32],[-.32,-.32]];

type SurfaceTangents = { x: Vec3; y: Vec3 };
function single(spec: SceneSpec, id: number, time: number, seed: number, tangents?: SurfaceTangents): Vec3 {
  if (spec.shape === 'dango') return dangoPosition(id, time, seed, spec.mode, undefined, tangents?.x, tangents?.y);
  const a = fract((id + seed * .13) * .618033988749895);
  const b = fract((id + seed * .27) * .754877666246693);
  const surface = spec.mode === 'surface';
  if (spec.shape === 'fireworks') return quietFireworks(id, time, seed);
  if (spec.shape === 'condense') {
    // A solid stays a surface even when the sentence includes “flow”.
    const p = sphereSurface(id, time, seed, undefined, tangents?.x, tangents?.y);
    for (let axis = 0; axis < 3; axis++) {
      p[axis] *= 1.2;
      if (tangents) { tangents.x[axis] *= 1.2; tangents.y[axis] *= 1.2; }
    }
    return p;
  }
  if (spec.shape === 'mobius') {
    const [u, w] = mobiusMaterial(id, time, seed, surface);
    return mobiusSurface(u, w, time, spec.deformation === 'omega', undefined, tangents?.x, tangents?.y);
  }
  if (spec.shape === 'ring') {
    const u = a * TAU + time * .38;
    const v = b * TAU + time * .24;
    const tube = surface ? .15 : .015;
    const r = 1.12 + tube * Math.cos(v);
    return [r * Math.cos(u), r * Math.sin(u), tube * Math.sin(v)];
  }
  if (spec.shape === 'cube' || spec.shape === 'cuboid') {
    return cubeSurface(id, time, seed, spec.shape === 'cuboid', undefined, tangents?.x, tangents?.y);
  }
  if (spec.shape === 'square' || spec.shape === 'triangle' || spec.shape === 'cross') {
    const p = polygon(a + time * .09, spec.shape === 'square' ? square : spec.shape === 'triangle' ? triangle : cross);
    const r = surface ? Math.sqrt(b) : 1;
    return [p[0] * r, p[1] * r, .025 * Math.sin(time * .3 + a * TAU)];
  }
  return shapePosition(spec.shape, id, time, seed);
}

/** localPoint receives the undeformed point. Optional tangents share its calculation
 * for single solid surfaces and the Möbius strip; normalize before rendering. */
export function composedPosition(spec: SceneSpec, id: number, time: number, seed = 1,
  motion: MotionTransform = prepareMotion(spec.motion ?? 'calm', time), localPoint?: Vec3, tangents?: SurfaceTangents): Vec3 {
  const count = spec.deformation === 'double' ? 2 : spec.count;
  const group = id % count;
  const p = single(spec, Math.floor(id / count), time + group * .23, seed, tangents);
  if (localPoint) { localPoint[0] = p[0]; localPoint[1] = p[1]; localPoint[2] = p[2]; }
  applyMotionPosition(motion, p, p);
  if (count === 1) return p;
  if (spec.arrangement === 'chain') {
    const spacing = 1.45, fit = 3.7 / (2.5 + (count - 1) * spacing);
    const phase = time * .12;
    const q: Vec3 = group % 2 === 0 ? p : [p[0], -p[2], p[1]];
    const x = (group - (count - 1) / 2) * spacing + q[0];
    return [x * fit, (q[1] * Math.cos(phase) - q[2] * Math.sin(phase)) * fit, (q[1] * Math.sin(phase) + q[2] * Math.cos(phase)) * fit];
  }
  const phase = group * TAU / count + time * .1;
  const size = spec.deformation === 'double' ? group === 0 ? .92 : .38 : Math.min(.53, 1.3 / Math.sqrt(count));
  const pitch = group * 1.3 + time * (.12 + group * .009);
  const q: Vec3 = [p[0], p[1] * Math.cos(pitch) - p[2] * Math.sin(pitch), p[1] * Math.sin(pitch) + p[2] * Math.cos(pitch)];
  const spread = spec.deformation === 'double' ? .9 : 1.22;
  return [q[0] * size + spread * Math.cos(phase), q[1] * size + .9 * Math.sin(phase) + .16 * Math.sin(time * .3 + group), q[2] * size + .58 * Math.sin(phase * 2 + time * .15)];
}

export function randomUnit(seed: number): number {
  let x = seed | 0; x = Math.imul(x ^ x >>> 16, 0x21f0aaad); x = Math.imul(x ^ x >>> 15, 0x735a2d97);
  return ((x ^ x >>> 15) >>> 0) / 4294967296;
}

/** Continuous, varied intake with fixed endpoints and seeded reproducibility. */
export function intakePosition(source: Vec3, target: Vec3, progress: number, seed: number): Vec3 {
  const t = Math.max(0, Math.min(1, progress));
  const blend = t * t * (3 - 2 * t), envelope = Math.sin(Math.PI * t) ** 1.5;
  const phase = randomUnit(seed) * TAU, turns = 1.1 + randomUnit(seed + 1) * 1.8;
  const angle = phase + t * TAU * turns, radius = (.18 + randomUnit(seed + 2) * .5) * envelope;
  return [mix(source[0], target[0], blend) + radius * Math.cos(angle), mix(source[1], target[1], blend) + radius * Math.sin(angle), mix(source[2], target[2], blend) + (.2 + randomUnit(seed + 3) * .5) * envelope * Math.sin(angle * .71)];
}
