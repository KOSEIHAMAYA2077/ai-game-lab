import type { SceneSpec } from './language';
import { TAU, type Vec3 } from './model';

/** Local glyph axes: x follows the flow, y spans the surface, z = x × y. */
export type SurfaceFrame = { x: Vec3; y: Vec3; z: Vec3 };
export const createSurfaceFrame = (): SurfaceFrame => ({ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] });
const fract = (value: number) => value - Math.floor(value);

/** Gram–Schmidt without temporary vectors. The caller may reuse one output. */
function basis(xx: number, xy: number, xz: number, yx: number, yy: number, yz: number, out: SurfaceFrame): SurfaceFrame {
  const lengthX = Math.hypot(xx, xy, xz);
  xx /= lengthX; xy /= lengthX; xz /= lengthX;
  const projection = xx * yx + xy * yy + xz * yz;
  yx -= xx * projection; yy -= xy * projection; yz -= xz * projection;
  let lengthY = Math.hypot(yx, yy, yz);
  if (lengthY < 1e-10) {
    // A singular parameter point has no unique normal. Choose a stable perpendicular.
    const ax = Math.abs(xx) < .8 ? 1 : 0, ay = ax === 0 ? 1 : 0;
    const dot = ax * xx + ay * xy;
    yx = ax - xx * dot; yy = ay - xy * dot; yz = -xz * dot;
    lengthY = Math.hypot(yx, yy, yz);
  }
  yx /= lengthY; yy /= lengthY; yz /= lengthY;
  out.x[0] = xx; out.x[1] = xy; out.x[2] = xz;
  out.y[0] = yx; out.y[1] = yy; out.y[2] = yz;
  out.z[0] = xy * yz - xz * yy; out.z[1] = xz * yx - xx * yz; out.z[2] = xx * yy - xy * yx;
  return out;
}

/** Analytic ∂position/∂u and ∂position/∂w of shapes.ts animatedMobius.
 * Keep u unwrapped: the basis returns after 4π and reverses the width axis after 2π.
 * No position resampling or id differences are needed per glyph.
 */
export function mobiusFrame(u: number, w: number, time: number, omega = false, out = createSurfaceFrame()): SurfaceFrame {
  const theta = u + .16 * Math.sin(u * 2 - time * .14);
  const thetaU = 1 + .32 * Math.cos(u * 2 - time * .14);
  const r = 1.28 + .13 * Math.cos(u * 2 + time * .19) + (omega ? .36 * Math.cos(u) : 0);
  const rU = -.26 * Math.sin(u * 2 + time * .19) - (omega ? .36 * Math.sin(u) : 0);
  const twist = u / 2 + .35 * Math.sin(u - time * .24) + .2 * Math.sin(time * .17);
  const twistU = .5 + .35 * Math.cos(u - time * .24);
  const ct = Math.cos(theta), st = Math.sin(theta), cw = Math.cos(twist), sw = Math.sin(twist);
  const radius = r + w * cw, radiusU = rU - w * sw * twistU;
  const stretchY = omega ? .69 : .87;
  return basis(radiusU * ct - radius * st * thetaU,
    (radiusU * st + radius * ct * thetaU) * stretchY,
    w * cw * twistU + .24 * Math.cos(u * 2 + time * .2),
    cw * ct, cw * st * stretchY, sw, out);
}

function condenseSurface(theta: number, latitude: number, time: number, out: SurfaceFrame): SurfaceFrame {
  // Exact derivatives of model.ts shapePosition('condense') in theta/latitude.
  // Differentiating latitude at fixed theta spans the same tangent plane as at fixed a.
  const base = 1.05 + .1 * Math.sin(time * .38);
  const phase = theta * 3 + latitude * 2 + time * .16;
  const radius = base * (1 + .13 * Math.sin(phase));
  const radiusTheta = base * .39 * Math.cos(phase), radiusLatitude = base * .26 * Math.cos(phase);
  const st = Math.sin(theta), ct = Math.cos(theta), sl = Math.sin(latitude), cl = Math.cos(latitude);
  let xx = sl * (radiusTheta * ct - radius * st), xy = radiusTheta * cl * 1.05;
  let xz = sl * (radiusTheta * st + radius * ct);
  if (Math.hypot(xx, xy, xz) < 1e-10) { xx = -st; xy = 0; xz = ct; }
  return basis(xx, xy, xz, (radiusLatitude * sl + radius * cl) * ct,
    (radiusLatitude * cl - radius * sl) * 1.05, (radiusLatitude * sl + radius * cl) * st, out);
}

function condenseFlow(u: number, out: SurfaceFrame): SurfaceFrame {
  const latitude = .92 * Math.sin(u * 3), latitudeU = 2.76 * Math.cos(u * 3);
  const sl = Math.sin(latitude), cl = Math.cos(latitude), su = Math.sin(u), cu = Math.cos(u);
  const xx = -sl * latitudeU * cu - cl * su, xy = cl * latitudeU, xz = -sl * latitudeU * su + cl * cu;
  // The flow lies on the radius-1.2 sphere. normal × tangent supplies the width axis.
  const nx = cl * cu, ny = sl, nz = cl * su;
  return basis(xx, xy, xz, ny * xz - nz * xy, nz * xx - nx * xz, nx * xy - ny * xx, out);
}

/** Frame at the same parameters used by composedPosition for an integer glyph id.
 * Unsupported forms/arrangements return null, leaving the optional output unchanged.
 * Supply `out` in render loops to avoid per-frame object/array allocation.
 * This function only supplies orientation; it does not change position or apply scene rotation.
 */
export function surfaceFrame(spec: SceneSpec, id: number, time: number, seed = 1, out?: SurfaceFrame): SurfaceFrame | null {
  if (spec.count !== 1 || spec.arrangement !== 'single' || spec.deformation === 'double'
      || (spec.shape !== 'condense' && spec.shape !== 'mobius')) return null;
  const a = fract((id + seed * .13) * .618033988749895);
  const target = out ?? createSurfaceFrame();
  if (spec.shape === 'condense' && spec.mode === 'flow') return condenseFlow(a * TAU + time * .25, target);
  const b = fract((id + seed * .27) * .754877666246693);
  if (spec.shape === 'mobius') return mobiusFrame(a * TAU * 2 + time * .33,
    spec.mode === 'surface' ? (b - .5) * .94 : .37 + (b - .5) * .025, time, spec.deformation === 'omega', target);
  const latitude = Math.acos(2 * b - 1);
  const theta = a * TAU + time * (.11 + .075 * Math.sin(latitude * 3));
  return condenseSurface(theta, latitude, time, target);
}
