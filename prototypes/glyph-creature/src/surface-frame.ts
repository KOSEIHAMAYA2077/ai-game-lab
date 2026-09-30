import type { SceneSpec } from './language';
import type { Vec3 } from './model';
import { dangoFrame } from './dango';
import { mobiusMaterial, mobiusSurface, sphereSurface, cubeSurface } from './surface-flow';

/** Local glyph axes: x/y follow material tangents; z = x × y is the normal. */
export type SurfaceFrame = { x: Vec3; y: Vec3; z: Vec3 };
export const createSurfaceFrame = (): SurfaceFrame => ({ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] });

/** Rebuild the normal after transforming both tangents through a deformation. */
export function normalizeSurfaceFrame(frame: SurfaceFrame): SurfaceFrame {
  return basis(...frame.x, ...frame.y, frame);
}

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
  mobiusSurface(u, w, time, omega, out.z, out.x, out.y);
  return normalizeSurfaceFrame(out);
}

/** Frame at the same parameters used by composedPosition for an integer glyph id.
 * Unsupported forms/arrangements return null, leaving the optional output unchanged.
 * Supply `out` in render loops to avoid per-frame object/array allocation.
 * This function only supplies orientation; it does not change position or apply scene rotation.
 */
export function surfaceFrame(spec: SceneSpec, id: number, time: number, seed = 1, out?: SurfaceFrame): SurfaceFrame | null {
  if (spec.count !== 1 || spec.arrangement !== 'single' || spec.deformation === 'double'
      || (spec.shape !== 'condense' && spec.shape !== 'mobius' && spec.shape !== 'dango' && spec.shape !== 'cube' && spec.shape !== 'cuboid')) return null;
  const target = out ?? createSurfaceFrame();
  if (spec.shape === 'dango') return dangoFrame(id, time, seed, spec.mode, target);
  if (spec.shape === 'mobius') {
    const [u, w] = mobiusMaterial(id, time, seed, spec.mode === 'surface');
    return mobiusFrame(u, w, time, spec.deformation === 'omega', target);
  }
  if (spec.shape === 'cube' || spec.shape === 'cuboid') {
    cubeSurface(id, time, seed, spec.shape === 'cuboid', target.z, target.x, target.y);
    return normalizeSurfaceFrame(target);
  }
  sphereSurface(id, time, seed, target.z, target.x, target.y);
  return normalizeSurfaceFrame(target);
}
