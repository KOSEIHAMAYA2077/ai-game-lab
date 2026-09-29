import { TAU, type Vec3 } from './model';
import type { SceneSpec } from './language';
import type { SurfaceFrame } from './surface-frame';

export const DANGO_RADIUS = .46;
export const DANGO_SPACING = .88;
const fract = (value: number) => value - Math.floor(value);
type Mode = SceneSpec['mode'];

/** Three touching spheres, filled evenly by stable glyph identities (id mod 3).
 * surface: longitude circulation on the whole sphere.
 * flow: one closed, latitude-varying path around each sphere.
 * Supply out in a render loop to reuse the same tuple.
 */
export function dangoPosition(id: number, time: number, seed = 1, mode: Mode = 'surface', out: Vec3 = [0, 0, 0]): Vec3 {
  const group = id % 3, local = Math.floor(id / 3);
  const a = fract((local + seed * .13) * .618033988749895 + group * .23);
  const u = a * TAU + time * (mode === 'flow' ? .30 : .22);
  const b = fract((local + seed * .27) * .754877666246693 + group * .17);
  const latitude = mode === 'flow' ? .92 * Math.sin(u * 3) : Math.asin(2 * b - 1);
  const cosLatitude = Math.cos(latitude);
  out[0] = DANGO_RADIUS * cosLatitude * Math.cos(u);
  out[1] = (group - 1) * DANGO_SPACING + DANGO_RADIUS * Math.sin(latitude);
  out[2] = DANGO_RADIUS * cosLatitude * Math.sin(u);
  return out;
}

/** Orthonormal axes at exactly the same point as dangoPosition.
 * x follows circulation, y is a perpendicular surface tangent, z points outward.
 * At a surface pole the flow speed is zero, so x uses its continuous longitude limit.
 */
export function dangoFrame(id: number, time: number, seed = 1, mode: Mode = 'surface', out: SurfaceFrame = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }): SurfaceFrame {
  const group = id % 3, local = Math.floor(id / 3);
  const a = fract((local + seed * .13) * .618033988749895 + group * .23);
  const u = a * TAU + time * (mode === 'flow' ? .30 : .22);
  const b = fract((local + seed * .27) * .754877666246693 + group * .17);
  const latitude = mode === 'flow' ? .92 * Math.sin(u * 3) : Math.asin(2 * b - 1);
  const su = Math.sin(u), cu = Math.cos(u), sl = Math.sin(latitude), cl = Math.cos(latitude);
  const nx = cl * cu, ny = sl, nz = cl * su;
  let tx = -su, ty = 0, tz = cu;
  if (mode === 'flow') {
    const latitudeU = 2.76 * Math.cos(u * 3);
    tx = -sl * latitudeU * cu - cl * su; ty = cl * latitudeU; tz = -sl * latitudeU * su + cl * cu;
    const length = Math.hypot(tx, ty, tz);
    tx /= length; ty /= length; tz /= length;
  }
  out.x[0] = tx; out.x[1] = ty; out.x[2] = tz;
  out.y[0] = ny * tz - nz * ty; out.y[1] = nz * tx - nx * tz; out.y[2] = nx * ty - ny * tx;
  out.z[0] = nx; out.z[1] = ny; out.z[2] = nz;
  return out;
}
