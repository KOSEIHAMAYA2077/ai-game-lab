import type { Ink, SceneSpec } from './language';
import { smooth, type Vec3 } from './model';
import { randomUnit } from './shapes';

export type ContourMode = 'off' | 'emphasis' | 'contour';
export type ContourShape = 'condense' | 'cube';
const TAU = Math.PI * 2;
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function unit(v: Vec3): Vec3 { const d = Math.hypot(...v) || 1; return v.map(x => x / d) as Vec3; }
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const subtract = (a: Vec3, b: Vec3): Vec3 => a.map((x, i) => x - b[i]) as Vec3;
export function contourSupported(spec: SceneSpec): boolean {
  return (spec.shape === 'condense' || spec.shape === 'cube') && spec.count === 1
    && spec.arrangement === 'single' && spec.deformation !== 'double' && spec.motion !== 'wave';
}
export function contourColored(ink?: Ink): boolean { return Boolean(ink && ink !== 'white'); }
/** Enrollment is fixed at insertion. Existing IDs are never re-selected after another batch. */
export function contourCandidate(id: number): boolean { return randomUnit(id * 1853 + 41) < .34; }
/** Staggered visits: 6 s approach, 15 s circulation, 6 s return, 9 s on the face. */
export function contourVisit(id: number, time: number): number {
  const phase = ((time + randomUnit(id * 319 + 9) * 36) % 36 + 36) % 36;
  return smooth(phase / 6) * (1 - smooth((phase - 21) / 6));
}

export function onBody(shape: ContourShape, p: Vec3): Vec3 {
  const divisor = shape === 'condense' ? Math.hypot(...p) / 1.2 : p.reduce((sum, x) => sum + x ** 12, 0) ** (1 / 12);
  if (divisor < 1e-10) return shape === 'condense' ? [0, 0, 1.2] : [0, 0, 1];
  return p.map(x => x / divisor) as Vec3;
}
/** Travel stays on the convex body, instead of cutting through its black interior. */
export function surfaceJourney(shape: ContourShape, a: Vec3, b: Vec3, amount: number): Vec3 {
  if (amount <= 0) return [...a];
  if (amount >= 1) return [...b];
  const u = unit(a), v = unit(b), cosine = Math.max(-1, Math.min(1, dot(u, v)));
  let direction: Vec3;
  if (cosine > .9995) direction = u.map((x, i) => x + (v[i] - x) * amount) as Vec3;
  else {
    const angle = Math.acos(cosine);
    let side = subtract(v, u.map(x => x * cosine) as Vec3);
    if (Math.hypot(...side) < 1e-6) side = cross(u, Math.abs(u[1]) < .8 ? [0, 1, 0] : [1, 0, 0]);
    side = unit(side);
    direction = u.map((x, i) => x * Math.cos(angle * amount) + side[i] * Math.sin(angle * amount)) as Vec3;
  }
  return onBody(shape, direction);
}
export function facingBody(shape: ContourShape, p: Vec3, camera: Vec3): number {
  const normal = unit(shape === 'condense' ? p : p.map(x => x ** 11) as Vec3);
  return dot(normal, unit(subtract(camera, p)));
}

// A closed walk covers all twelve cube edges; repeated edges keep one stable route.
const corners: Vec3[] = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
const route = [0,1,2,3,0,1,5,4,7,6,2,3,7,6,5,4];
function cubeRoute(phase: number): Vec3 {
  const position = ((phase % 1) + 1) % 1 * route.length, segment = Math.floor(position), u = position - segment;
  const at = (offset: number) => corners[route[(segment + offset + route.length) % route.length]];
  const a = at(-1), b = at(0), c = at(1), d = at(2);
  // Smooth turns are projected back onto the SAME L12 surface as cubeSurface.
  const linear = b.map((x, i) => .5 * (2 * x + (-a[i] + c[i]) * u
    + (2 * a[i] - 5 * x + 4 * c[i] - d[i]) * u * u
    + (-a[i] + 3 * x - 3 * c[i] + d[i]) * u * u * u)) as Vec3;
  return onBody('cube', linear);
}

export function contourPath(shape: ContourShape, phase: number, camera: Vec3, right: Vec3): { point: Vec3; tangent: Vec3 } {
  if (shape === 'cube') {
    const point = cubeRoute(phase);
    const tangent = unit(subtract(cubeRoute(phase + .0004), cubeRoute(phase - .0004)));
    return { point, tangent };
  }
  const direction = unit(camera), d = Math.max(1.2001, Math.hypot(...camera));
  const x = unit(subtract(right, direction.map(v => v * dot(right, direction)) as Vec3));
  const y = unit(cross(direction, x));
  const radius = 1.2 * Math.sqrt(1 - (1.2 / d) ** 2), center = 1.2 ** 2 / d;
  const angle = phase * TAU;
  const point = direction.map((v, i) => v * center + radius * (x[i] * Math.cos(angle) + y[i] * Math.sin(angle))) as Vec3;
  const tangent = x.map((v, i) => -v * Math.sin(angle) + y[i] * Math.cos(angle)) as Vec3;
  return { point, tangent };
}

export function contourFrame(point: Vec3, tangent: Vec3, camera: Vec3): { x: Vec3; y: Vec3; z: Vec3 } {
  const z = unit(subtract(camera, point));
  let x = subtract(tangent, z.map(v => v * dot(tangent, z)) as Vec3);
  if (Math.hypot(...x) < 1e-5) x = cross(z, Math.abs(z[1]) < .8 ? [0, 1, 0] : [1, 0, 0]);
  x = unit(x);
  return { x, y: unit(cross(z, x)), z };
}

/** At most 160 participants per interval. Every input cohort gets a turn; handoffs happen at zero weight. */
export function contourPageWeight(rank: number, poolSize: number, time: number): number {
  const pages = Math.ceil(poolSize / 160);
  if (pages <= 1) return 1;
  const page = Math.floor(time / 48) % pages;
  if (Math.floor(rank / 160) !== page) return 0;
  const phase = time % 48;
  return smooth(phase / 4) * (1 - smooth((phase - 44) / 4));
}
