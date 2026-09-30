import type { Shape } from './language';
import type { Vec3 } from './model';

/** These are authored surfaces and vocabulary, not model-generated geometry. */
export const WORD_SURFACES = ['flower', 'butterfly', 'jellyfish', 'tree', 'star', 'helix', 'hourglass', 'saturn', 'sword', 'vase'] as const;
export type WordSurface = typeof WORD_SURFACES[number];
export const isWordSurface = (shape: Shape): shape is WordSurface => (WORD_SURFACES as readonly string[]).includes(shape);
export const CLOSED_WORD_SURFACES: readonly Shape[] = ['tree', 'star', 'helix', 'hourglass', 'sword', 'vase'];
const TAU = Math.PI * 2;
const fract = (x: number) => x - Math.floor(x);
const clamp = (x: number) => Math.max(.00001, Math.min(.99999, x));
const assign = (out: Vec3, x: number, y: number, z: number): Vec3 => { out[0] = x; out[1] = y; out[2] = z; return out; };

/** u runs around a patch, v runs down/across it. Patch identity never changes. */
export function wordSurfacePoint(shape: WordSurface, u: number, v: number, t: number, part: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const a = u * TAU, c = Math.cos(a), s = Math.sin(a), b = Math.PI * v;
  if (shape === 'vase' || shape === 'hourglass') {
    const y = 1.3 - 2.6 * v;
    const radius = shape === 'vase'
      ? .28 + .63 * Math.exp(-(((v - .62) / .26) ** 2)) + .16 * Math.exp(-(((v - .015) / .065) ** 2))
      : .18 + .75 * (Math.abs(2 * v - 1) ** 1.35);
    const wave = 1 + .035 * Math.sin(3 * a + 4 * v + t * .12);
    return assign(out, radius * c * wave, y, radius * s * wave);
  }
  if (shape === 'flower') {
    const r = Math.sqrt(1 - v) * (1.02 + .35 * Math.cos(5 * a));
    const cup = .24 * r * r + .10 * Math.cos(5 * a + t * .10) * r;
    return assign(out, r * c, r * s, cup + .08 * Math.sin(t * .16 + 2 * a) * r);
  }
  if (shape === 'butterfly') {
    // Two broad wings with a waist, not four orbital lines.
    if (part < 2) return assign(out, .07 * Math.sin(b) * c, .85 * Math.cos(b), .06 * Math.sin(b) * s);
    const side = part % 2 === 0 ? -1 : 1;
    const r = Math.sqrt(1 - v), wing = .68 + .23 * Math.sin(a) - .2 * Math.cos(2 * a);
    const x = side * (.025 + r * wing * (1 + c) * .74);
    const y = r * s * (1.05 + .19 * s);
    const flap = .24 * Math.sin(t * .19) + .10 * Math.sin(t * .071);
    return assign(out, x * Math.cos(flap), y, Math.abs(x) * Math.sin(flap) + .07 * r * Math.sin(3 * a + t * .13));
  }
  if (shape === 'jellyfish') {
    if (part < 24) {
      const y = 1 - v * .97, r = Math.sqrt(1 - y * y) * (1 + .045 * Math.sin(t * .21));
      return assign(out, r * c, .1 + .9 * y, r * s);
    }
    const arm = part - 24, angle = arm * TAU / 8, y = .14 - v * 1.65;
    const bend = .13 * Math.sin(v * 5 + t * .17 + arm), radius = .018 + .014 * (1 - v);
    const r = .74 + .17 * v;
    return assign(out, r * Math.cos(angle) + bend + radius * c, y, r * Math.sin(angle) + .11 * Math.cos(v * 4 - t * .13 + arm) + radius * s);
  }
  if (shape === 'tree') {
    if (part < 9) {
      const layer = part % 3, h = .95, top = 1.4 - layer * .53;
      const rise = Math.sqrt(v), r = (.57 + .2 * layer) * (.012 + .988 * rise), ripple = 1 + .025 * Math.sin(a * 5 + t * .14 + v);
      return assign(out, r * c * ripple, top - h * rise, r * s * ripple);
    }
    return assign(out, .14 * c, -.65 - .8 * v, .14 * s);
  }
  if (shape === 'star') {
    // A filled, gently inflated five-point star; front and back are both sampled.
    const angle = fract(u) * TAU, sector = Math.floor(angle / (Math.PI / 5)), f = angle - sector * Math.PI / 5;
    const r0 = sector % 2 ? .53 : 1.2, r1 = sector % 2 ? 1.2 : .53;
    const radial = r0 * r1 * Math.sin(Math.PI / 5) / (r1 * Math.sin(Math.PI / 5 - f) + r0 * Math.sin(f));
    const height = 1 - 2 * v, r = Math.sqrt(1 - height * height), z = .20 * height;
    return assign(out, radial * r * Math.sin(a), radial * r * Math.cos(a), z * (1 + .07 * Math.sin(t * .12)));
  }
  if (shape === 'helix') {
    const turn = v * TAU * 2.2 + .10 * Math.sin(t * .13), radius = .66 + .08 * Math.sin(v * TAU - t * .10);
    const tube = .13, q = radius + tube * c;
    return assign(out, q * Math.cos(turn), 1.35 - 2.7 * v + tube * s, q * Math.sin(turn));
  }
  if (shape === 'saturn') {
    if (part < 6) {
      const r = .72 * Math.sin(b);
      return assign(out, r * c, .72 * Math.cos(b), r * s);
    }
    const r = 1.05 + v * .45, tilt = .38 + .045 * Math.sin(t * .08);
    return assign(out, r * c, r * s * Math.sin(tilt), r * s * Math.cos(tilt));
  }
  if (shape === 'sword') {
    if (part < 7) {
      const r = Math.sin(b) ** .35;
      return assign(out, .20 * c * r, 1.6 - 2.28 * v, .065 * s * r);
    }
    if (part < 9) return assign(out, .64 - 1.28 * v, -.65 + .10 * c, .10 * s);
    return assign(out, .10 * c, -.72 - .68 * v, .10 * s);
  }
  return out;
}

const dx: Vec3 = [0, 0, 0], dy: Vec3 = [0, 0, 0];
/** Uniform 2-D samples carry stable glyph identities, with bounded smooth drift.
 * Numerical surface differentials are shared by position/orientation in the renderer.
 * This is a procedural material motion, not a physical fluid simulation. */
export function wordSurface(shape: WordSurface, id: number, time: number, seed: number, out: Vec3 = [0, 0, 0], du?: Vec3, dv?: Vec3): Vec3 {
  const aa = fract((id + seed * .13) * .618033988749895), bb = fract((id + seed * .27) * .754877666246693);
  const part = id % (shape === 'jellyfish' ? 32 : shape === 'butterfly' ? 20 : 10);
  const u = aa + time * .022 + .055 * Math.sin(bb * TAU + time * .073 + seed);
  const v = clamp(bb + .065 * Math.sin(Math.PI * bb) * Math.sin(aa * TAU + time * .095 + seed * .3));
  wordSurfacePoint(shape, u, v, time, part, out);
  if (du || dv) {
    const h = .00001;
    if (du) {
      wordSurfacePoint(shape, u + h, v, time, part, dx); wordSurfacePoint(shape, u - h, v, time, part, dy);
      for (let k = 0; k < 3; k++) du[k] = (dx[k] - dy[k]) / (2 * h);
    }
    if (dv) {
      wordSurfacePoint(shape, u, v + h, time, part, dx); wordSurfacePoint(shape, u, v - h, time, part, dy);
      for (let k = 0; k < 3; k++) dv[k] = (dx[k] - dy[k]) / (2 * h);
    }
    // The crossguard runs in the opposite direction to the upright blade.
    if (shape === 'sword' && part >= 7 && part < 9 && dv) for (let k = 0; k < 3; k++) dv[k] *= -1;
  }
  return out;
}
