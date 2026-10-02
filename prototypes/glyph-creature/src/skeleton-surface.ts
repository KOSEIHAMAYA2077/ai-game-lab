import type { Vec3 } from './model';
import { cubeSurface, sphereSurface } from './surface-flow';

/** A small authored scaffold vocabulary. The language model chooses these bounded
 * parameters; it does not emit vertices or execute geometry code. */
export const SKELETON_FAMILIES = ['vase', 'sword', 'mobius', 'ring', 'sphere', 'cube'] as const;
export type SkeletonFamily = typeof SKELETON_FAMILIES[number];
export type SkeletonSpec = { family: SkeletonFamily; height: number; width: number; neck: number; bend: number; twist: number };

export function defaultSkeletonSpec(family: SkeletonFamily): SkeletonSpec {
  return { family, height: 1, width: 1, neck: .45, bend: 0, twist: 0 };
}

/** Invalid model output is rejected, never silently turned into another family. */
export function validateSkeletonSpec(raw: unknown): SkeletonSpec | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (!(SKELETON_FAMILIES as readonly unknown[]).includes(value.family)) return null;
  const ranges = { height: [.5, 1.8], width: [.5, 1.8], neck: [.15, 1], bend: [-1, 1], twist: [-1, 1] } as const;
  for (const [name, range] of Object.entries(ranges)) {
    const number = value[name];
    if (typeof number !== 'number' || !Number.isFinite(number) || number < range[0] || number > range[1]) return null;
  }
  return { family: value.family as SkeletonFamily, height: value.height as number, width: value.width as number,
    neck: value.neck as number, bend: value.bend as number, twist: value.twist as number };
}

const TAU = Math.PI * 2;
const fract = (x: number) => x - Math.floor(x);
const clamp = (x: number) => Math.max(.00001, Math.min(.99999, x));
const assign = (out: Vec3, x: number, y: number, z: number) => { out[0] = x; out[1] = y; out[2] = z; return out; };

/** Conservative analytic bounds keep every family inside a radius of 1.48.
 * Normalization preserves aspect ratios rather than cancelling height/width. */
function fitScale(spec: SkeletonSpec): number {
  let radius: number;
  if (spec.family === 'vase') radius = Math.hypot(spec.width * (1.01 + .60 * spec.neck) + .49 * Math.abs(spec.bend) + .04, 1.25 * spec.height);
  else if (spec.family === 'sword') radius = Math.hypot(.79 * spec.width + .29 * Math.abs(spec.bend), 1.53 * spec.height, .14 + .06 * spec.neck);
  else if (spec.family === 'mobius') {
    const w = .2 + .5 * spec.neck;
    radius = Math.hypot((1.30 + 1.18 * w) * spec.width, (1.30 + 1.18 * w) * .91 * spec.height, 1.18 * w + .34 + .18 * Math.abs(spec.bend));
  } else if (spec.family === 'ring') {
    const r = 1 + .12 + .25 * spec.neck;
    radius = Math.hypot(r * Math.max(spec.width, .85 * spec.height) + .10 * Math.abs(spec.bend), .12 + .25 * spec.neck + .14);
  } else radius = Math.hypot(spec.width, spec.height, .7 + .6 * spec.neck) + .23 * Math.abs(spec.bend);
  return 1.48 / radius;
}

function vaseRadius(v: number, neck: number): number {
  return .18 + .64 * Math.exp(-(((v - .63) / .255) ** 2))
    + .60 * neck * Math.exp(-(((v - .02) / .26) ** 2)) + .08 * Math.exp(-(((v - .015) / .045) ** 2));
}

function innerVaseRadius(spec: SkeletonSpec, v: number): number {
  if (v >= 1) return 0;
  const radius = Math.max(.02, vaseRadius(.94 * v, spec.neck) - .055);
  // The cavity ends above the outside bottom and closes as a rounded bowl.
  const floor = Math.max(0, (v - .90) / .10);
  return radius * Math.sqrt(Math.max(0, 1 - floor * floor));
}

function vasePoint(spec: SkeletonSpec, u: number, axial: number, radius: number, time: number, out: Vec3): Vec3 {
  const a = u * TAU, scale = fitScale(spec);
  const r = radius * spec.width * (1 + .025 * Math.sin(3 * a + 4 * axial + time * .12) + .15 * spec.twist * Math.cos(3 * a + 7 * axial));
  const bend = Math.sin(Math.PI * axial) * (.45 * spec.bend + .035 * Math.sin(time * .11 + axial * 4));
  return assign(out, (r * Math.cos(a) + bend) * scale, (1.25 - 2.5 * axial) * spec.height * scale,
    (r * Math.sin(a) + .18 * spec.bend * Math.sin(2 * Math.PI * axial)) * scale);
}

/** Area-CDF sampling keeps a narrow neck from receiving the same density as the
 * much wider belly. The table is constructed once per bounded scaffold. */
const profileTables = new Map<string, Float64Array>();
function areaCoordinate(spec: SkeletonSpec, q: number, part = 0): number {
  const key = `${spec.family}:${spec.height}:${spec.width}:${spec.neck}:${part}`;
  let table = profileTables.get(key);
  if (!table) {
    const n = 96;
    table = new Float64Array(n + 1);
    let last = 0;
    for (let i = 0; i <= n; i++) {
      const v = i / n, h = .0001;
      const profile = (value: number) => spec.family === 'vase'
        ? part === 1 ? innerVaseRadius(spec, value) : vaseRadius(value, spec.neck)
        : .03 + Math.sin(Math.PI * Math.max(0, Math.min(1, value)) / 2) ** .55;
      const r = profile(v), before = profile(v - h), after = profile(v + h);
      const height = (spec.family === 'vase' ? part === 1 ? 2.35 : 2.5 : 2.05) * spec.height;
      const area = r * Math.hypot(height, (after - before) / (2 * h) * spec.width * (spec.family === 'vase' ? 1 : .2));
      if (i) table[i] = table[i - 1] + (last + area) / (2 * n);
      last = area;
    }
    for (let i = 1; i <= n; i++) table[i] /= table[n];
    // This is an internal cache only; no saved model or user input is removed.
    if (profileTables.size >= 128) profileTables.clear();
    profileTables.set(key, table);
  }
  const value = clamp(q);
  let low = 0, high = table.length - 1;
  while (high - low > 1) { const mid = (low + high) >>> 1; if (table[mid] < value) low = mid; else high = mid; }
  return (low + (value - table[low]) / (table[high] - table[low])) / (table.length - 1);
}

/** Point coordinates: u is longitude (one turn, or two on a Möbius strip), v
 * spans the surface. Sword: blade/guard/hilt 0/1/2. Vase: outer/cavity/rim/base
 * 0/1/2/3. Each patch has its own material chart and outward-facing tangents. */
export function skeletonSurfacePoint(spec: SkeletonSpec, u: number, v: number, time: number, part = 0, out: Vec3 = [0, 0, 0]): Vec3 {
  const a = u * TAU, c = Math.cos(a), s = Math.sin(a), scale = fitScale(spec);
  if (spec.family === 'vase') {
    if (part === 1) return vasePoint(spec, -u, .94 * v, innerVaseRadius(spec, v), time, out);
    if (part === 2) return vasePoint(spec, u, 0, vaseRadius(0, spec.neck) - .055 * (1 - v), time, out);
    if (part === 3) return vasePoint(spec, u, 1, vaseRadius(1, spec.neck) * Math.sqrt(Math.max(0, 1 - v)), time, out);
    return vasePoint(spec, u, v, vaseRadius(v, spec.neck), time, out);
  }
  if (spec.family === 'sword') {
    let x: number, y: number, z: number;
    if (part === 0) {
      const r = .03 + Math.sin(Math.PI * clamp(v) / 2) ** .55;
      x = .20 * spec.width * c * r; y = (1.5 - 2.05 * v) * spec.height; z = .065 * s * r;
    } else if (part === 1) {
      x = (-.72 + 1.44 * v) * spec.width; y = (-.59 + .095 * c) * spec.height; z = .095 * s;
    } else {
      const r = .065 + .10 * spec.neck;
      x = r * c; y = (-.66 - .76 * v) * spec.height; z = r * s;
    }
    const h = (y / spec.height + 1.42) / 2.92;
    const angle = .65 * spec.twist * h + .018 * Math.sin(time * .08 + h * 2);
    const nx = x * Math.cos(angle) - z * Math.sin(angle), nz = x * Math.sin(angle) + z * Math.cos(angle);
    return assign(out, (nx + .26 * spec.bend * h * h) * scale, y * scale, nz * scale);
  }
  if (spec.family === 'mobius') {
    // The extra local twist is 2π-periodic, so (u + 1, v -> 1-v) remains
    // the same point and u + 2 returns the same oriented material patch.
    const w = (2 * v - 1) * (.2 + .5 * spec.neck);
    const theta = a + .18 * Math.sin(2 * a - .09 * time) + .07 * Math.sin(3 * a + .071 * time);
    const radius = 1 + .18 * Math.cos(2 * a + .11 * time) + .10 * Math.sin(3 * a - .073 * time);
    const twist = a / 2 + (.55 + .7 * spec.twist) * Math.sin(a - .13 * time) + .20 * Math.sin(3 * a + .071 * time);
    const width = 1 + .18 * Math.sin(2 * a - .1 * time);
    const radial = radius + w * width * Math.cos(twist);
    return assign(out, radial * Math.cos(theta) * spec.width * scale,
      radial * Math.sin(theta) * (.84 + .07 * Math.sin(.069 * time)) * spec.height * scale,
      (w * width * Math.sin(twist) + .20 * Math.sin(2 * a + .083 * time) + .12 * Math.cos(3 * a - .097 * time) + .18 * spec.bend * Math.sin(a)) * scale);
  }
  if (spec.family === 'ring') {
    const minor = .12 + .25 * spec.neck, b = v * TAU;
    const theta = a + .06 * Math.sin(2 * a + .07 * time), radius = 1 + minor * Math.cos(b);
    return assign(out, (radius * Math.cos(theta) * spec.width + .08 * spec.bend * Math.sin(2 * a)) * scale,
      radius * Math.sin(theta) * .85 * spec.height * scale,
      (minor * Math.sin(b) + (.04 + .08 * Math.abs(spec.twist)) * Math.sin(2 * a + time * .09) + .12 * spec.bend * Math.sin(a)) * scale);
  }
  // Direct coordinate form is useful for seam/differential diagnostics. Runtime
  // sphere/cube sampling below uses the existing area-preserving material flow.
  const y = 1 - 2 * v, radius = Math.sqrt(Math.max(0, 1 - y * y));
  assign(out, radius * c, y, radius * s);
  if (spec.family === 'cube') {
    const norm = out.reduce((sum, x) => sum + x ** 12, 0) ** (1 / 12);
    for (let k = 0; k < 3; k++) out[k] /= norm || 1;
  }
  transformSolid(spec, out, undefined, undefined);
  return out;
}

/** Bend and axial twist act on both point and tangent, keeping glyph planes
 * attached to the same deformed surface. */
function transformSolid(spec: SkeletonSpec, p: Vec3, du?: Vec3, dv?: Vec3): void {
  const scale = fitScale(spec), extents = [spec.width, spec.height, .7 + .6 * spec.neck];
  for (let k = 0; k < 3; k++) { p[k] *= extents[k]; if (du) du[k] *= extents[k]; if (dv) dv[k] *= extents[k]; }
  const angle = .65 * spec.twist * p[1] / spec.height, derivative = .65 * spec.twist / spec.height;
  const c = Math.cos(angle), s = Math.sin(angle), x = c * p[0] - s * p[2], z = s * p[0] + c * p[2];
  for (const tangent of [du, dv]) if (tangent) {
    const tx = c * tangent[0] - s * tangent[2] - z * derivative * tangent[1];
    const tz = s * tangent[0] + c * tangent[2] + x * derivative * tangent[1];
    tangent[0] = tx + .44 * spec.bend * p[1] / (spec.height * spec.height) * tangent[1]; tangent[2] = tz;
  }
  p[0] = x + .22 * spec.bend * (p[1] / spec.height) ** 2; p[2] = z;
  for (let k = 0; k < 3; k++) { p[k] *= scale; if (du) du[k] *= scale; if (dv) dv[k] *= scale; }
}

const before: Vec3 = [0, 0, 0], after: Vec3 = [0, 0, 0];

/** Stable low-discrepancy samples cover two surface dimensions, then circulate
 * in a smooth seeded material flow. This is not a physical fluid simulation. */
export function skeletonSurface(spec: SkeletonSpec, id: number, time: number, seed: number,
  out: Vec3 = [0, 0, 0], du?: Vec3, dv?: Vec3): Vec3 {
  if (spec.family === 'sphere' || spec.family === 'cube') {
    if (spec.family === 'cube') cubeSurface(id, time, seed, false, out, du, dv);
    else sphereSurface(id, time, seed, out, du, dv);
    transformSolid(spec, out, du, dv);
    return out;
  }
  const aa = fract((id + seed * .13) * .618033988749895), bb = fract((id + seed * .27) * .754877666246693);
  let u = aa + time * .014 + .035 * Math.sin(bb * TAU + time * .073 + seed);
  let v = clamp(bb + .05 * Math.sin(Math.PI * bb) * Math.sin(aa * TAU + time * .095 + seed * .3));
  let part = 0;
  if (spec.family === 'mobius') {
    // Traversing 4π with a transverse coordinate allows a glyph to complete
    // both sides of the non-orientable strip without a discontinuous flip.
    const q = 2 * bb - 1, base = aa * TAU * 2 + time * .09;
    const a = base + .35 * q * Math.sin(base / 2 + time * .061 + seed) + .15 * Math.sin(2 * base - time * .071 + seed);
    const drift = .28 * Math.sin(a / 2 + time * .09 + seed) + .10 * Math.sin(1.5 * a - time * .057 + seed);
    u = a / TAU; v = (1 + (q + drift) / (1 + q * drift)) / 2;
  } else if (spec.family === 'vase') {
    const q = fract((id + seed * .41) * .569840290998053);
    part = q < .67 ? 0 : q < .92 ? 1 : q < .97 ? 2 : 3;
    if (part < 2) v = areaCoordinate(spec, v, part);
    else if (part === 2) {
      const outside = vaseRadius(0, spec.neck), inside = outside - .055;
      v = (Math.sqrt(inside * inside + v * (outside * outside - inside * inside)) - inside) / (outside - inside);
    }
  }
  else if (spec.family === 'sword') {
    // Allocation approximates visible surface area rather than fixing each
    // glyph to one of a handful of outline strands.
    const q = fract((id + seed * .41) * .569840290998053);
    const bladeArea = .30 * spec.width * spec.height, guardArea = .11 * spec.width, hiltArea = (.065 + .10 * spec.neck) * .76 * spec.height;
    const total = bladeArea + guardArea + hiltArea;
    part = q * total < bladeArea ? 0 : q * total < bladeArea + guardArea ? 1 : 2;
    if (part === 0) v = areaCoordinate(spec, v);
  } else if (spec.family === 'ring') {
    // Torus area density is proportional to R + r cos(v). Invert its CDF.
    const minor = .12 + .25 * spec.neck, target = v * TAU;
    let b = target;
    for (let i = 0; i < 4; i++) b -= (b + minor * Math.sin(b) - target) / (1 + minor * Math.cos(b));
    v = b / TAU;
  }
  skeletonSurfacePoint(spec, u, v, time, part, out);
  if (du || dv) {
    const h = .00001;
    if (du) {
      skeletonSurfacePoint(spec, u + h, v, time, part, after); skeletonSurfacePoint(spec, u - h, v, time, part, before);
      for (let k = 0; k < 3; k++) du[k] = (after[k] - before[k]) / (2 * h);
    }
    if (dv) {
      skeletonSurfacePoint(spec, u, v + h, time, part, after); skeletonSurfacePoint(spec, u, v - h, time, part, before);
      for (let k = 0; k < 3; k++) dv[k] = (after[k] - before[k]) / (2 * h);
    }
  }
  return out;
}
