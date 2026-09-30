import type { Vec3 } from './model';

const TAU = Math.PI * 2;
const fract = (x: number) => x - Math.floor(x);
function phase(seed: number, salt: number): number {
  let x = (seed + salt) | 0;
  x = Math.imul(x ^ x >>> 16, 0x21f0aaad);
  x = Math.imul(x ^ x >>> 15, 0x735a2d97);
  return ((x ^ x >>> 15) >>> 0) / 4294967296 * TAU;
}

/** A smooth material-coordinate warp, not a fluid solver. No per-frame randomness. */
export function mobiusMaterial(id: number, time: number, seed: number, surface: boolean): [number, number] {
  const a = fract((id + seed * .13) * .618033988749895);
  const b = fract((id + seed * .27) * .754877666246693);
  const p = phase(seed, 43), q = surface ? 2 * b - 1 : .78 + (b - .5) * .035;
  const base = a * TAU * 2 + time * .13;
  // Under (u + 2π, q -> -q), u-shifts agree and the transverse field reverses.
  const u = base + .48 * q * Math.sin(base / 2 + time * .061 + p) + .19 * Math.sin(2 * base - time * .071 + p);
  const drift = .35 * Math.sin(u / 2 + time * .09 + p) + .12 * Math.sin(1.5 * u - time * .057 + p);
  // This bounded shear fixes both edges and keeps the material on the strip.
  const width = (q + drift) / (1 + q * drift);
  return [u, .47 * width];
}

/** Shared position and analytic tangents: deformation and glyph planes use the same map. */
export function mobiusSurface(u: number, w: number, t: number, omega = false,
  out: Vec3 = [0, 0, 0], du?: Vec3, dw?: Vec3): Vec3 {
  const a = 2 * u - .09 * t, b = 3 * u + .071 * t;
  const theta = u + .22 * Math.sin(a) + .08 * Math.sin(b);
  const r = 1.25 + .23 * Math.cos(2 * u + .11 * t) + .10 * Math.sin(3 * u - .073 * t) + (omega ? .26 * Math.cos(u) : 0);
  const twist = u / 2 + .65 * Math.sin(u - .13 * t) + .22 * Math.sin(3 * u + .071 * t) + .3 * Math.sin(.091 * t);
  const width = 1 + .18 * Math.sin(2 * u - .1 * t);
  const cw = Math.cos(twist), sw = Math.sin(twist), ct = Math.cos(theta), st = Math.sin(theta);
  const radial = r + w * width * cw, sy = (omega ? .68 : .84) + .07 * Math.sin(.069 * t);
  out[0] = radial * ct; out[1] = radial * st * sy;
  out[2] = w * width * sw + .22 * Math.sin(2 * u + .083 * t) + .12 * Math.cos(3 * u - .097 * t);
  if (du || dw) {
    const thetaU = 1 + .44 * Math.cos(a) + .24 * Math.cos(b);
    const rU = -.46 * Math.sin(2 * u + .11 * t) + .3 * Math.cos(3 * u - .073 * t) - (omega ? .26 * Math.sin(u) : 0);
    const twistU = .5 + .65 * Math.cos(u - .13 * t) + .66 * Math.cos(3 * u + .071 * t);
    const widthU = .36 * Math.cos(2 * u - .1 * t);
    const radialU = rU + w * (widthU * cw - width * sw * twistU);
    if (du) {
      du[0] = radialU * ct - radial * st * thetaU;
      du[1] = (radialU * st + radial * ct * thetaU) * sy;
      du[2] = w * (widthU * sw + width * cw * twistU) + .44 * Math.cos(2 * u + .083 * t) - .36 * Math.sin(3 * u - .097 * t);
    }
    if (dw) { dw[0] = width * cw * ct; dw[1] = width * cw * st * sy; dw[2] = width * sw; }
  }
  return out;
}

/** Rotation whose angle depends on its own axis coordinate; preserves sphere area. */
function shear(p: Vec3, u: Vec3 | undefined, v: Vec3 | undefined, axis: number, angle: number, derivative: number) {
  const i = (axis + 1) % 3, j = (axis + 2) % 3, c = Math.cos(angle), s = Math.sin(angle);
  const x = c * p[i] - s * p[j], y = s * p[i] + c * p[j];
  for (const tangent of [u, v]) if (tangent) {
    const dx = c * tangent[i] - s * tangent[j] - y * derivative * tangent[axis];
    const dy = s * tangent[i] + c * tangent[j] + x * derivative * tangent[axis];
    tangent[i] = dx; tangent[j] = dy;
  }
  p[i] = x; p[j] = y;
}

/** Smooth swirls across a rounded box. Surface orientation uses exact differentials. */
export function cubeSurface(id: number, time: number, seed: number, cuboid = false,
  p: Vec3 = [0, 0, 0], du?: Vec3, dv?: Vec3): Vec3 {
  const a = fract((id + seed * .13) * .618033988749895), b = fract((id + seed * .27) * .754877666246693);
  const angle = a * TAU, y = 2 * b - 1, radius = Math.sqrt(Math.max(0, 1 - y * y));
  const c = Math.cos(angle), s = Math.sin(angle);
  p[0] = radius * c; p[1] = y; p[2] = radius * s;
  // Unit longitude tangent stays defined at the two poles.
  if (du) { du[0] = -s; du[1] = 0; du[2] = c; }
  if (dv) { dv[0] = y * c; dv[1] = -radius; dv[2] = y * s; }
  let f = 2.4 * p[1] + .075 * time + phase(seed, 71);
  shear(p, du, dv, 1, .13 * time + .65 * Math.sin(f), 1.56 * Math.cos(f));
  f = 2.8 * p[0] - .063 * time + phase(seed, 119);
  shear(p, du, dv, 0, .5 * Math.sin(f), 1.4 * Math.cos(f));
  f = 2.6 * p[2] + .043 * time + phase(seed, 213);
  shear(p, du, dv, 2, .4 * Math.sin(f), 1.04 * Math.cos(f));
  const powers = p.map(x => x ** 11), sum = p.reduce((n, x, i) => n + x * powers[i], 0), m = sum ** (1 / 12);
  const extents = cuboid ? [1.35, .75, .55] : [1, 1, 1];
  for (const tangent of [du, dv]) if (tangent) {
    const projection = tangent.reduce((n, x, i) => n + x * powers[i], 0) / sum;
    for (let axis = 0; axis < 3; axis++) tangent[axis] = (tangent[axis] - p[axis] * projection) / m * extents[axis];
  }
  for (let axis = 0; axis < 3; axis++) p[axis] = p[axis] / m * extents[axis];
  return p;
}

/** Slow, staggered releases. Each ray has a stable direction and gently curling tail. */
export function quietFireworks(id: number, time: number, seed: number): Vec3 {
  const group = id % 3, ray = Math.floor(id / 3) % 97;
  const a = phase(seed + ray * 31, 817) / TAU, b = phase(seed + ray * 37, 129) / TAU;
  const tail = .62 + .38 * fract((id + seed * .13) * .618033988749895);
  const duration = 24 + 5 * Math.sin(phase(seed + group, 59));
  const progress = time / duration + group / 3 + .13 * a;
  const opening = .5 - .5 * Math.cos(TAU * progress);
  // Keep an open core instead of stacking hundreds of glyphs onto one bright point.
  const radius = .46 + .98 * opening;
  const angle = ray * 2.399963229728653 + .4 * a + .16 * Math.sin(.11 * time + 5 * b);
  const z = 1 - 2 * (ray + .5) / 97, radial = Math.sqrt(1 - z * z);
  const curl = .16 * opening * Math.sin(radius * 2.1 - .12 * time + 5 * b);
  return [Math.cos(angle + curl) * radial * radius * tail + .24 * Math.sin(group * 2.1),
    z * radius * tail - .22 * opening * opening + .16 + .08 * opening * Math.sin(angle * 2 + .07 * time),
    Math.sin(angle + curl) * radial * radius * tail];
}
