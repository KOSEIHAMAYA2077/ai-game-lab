import type { Vec3 } from './model';
import type { SceneSpec } from './language';
import { normalizeSurfaceFrame, type SurfaceFrame } from './surface-frame';
import { sphereSurface } from './surface-flow';

export const DANGO_RADIUS = .46;
export const DANGO_SPACING = .88;
type Mode = SceneSpec['mode'];

/** Three touching spheres. Flow moves their material without reducing it to an orbit.
 * The mode argument remains compatible with saved scenes from earlier versions. */
export function dangoPosition(id: number, time: number, seed = 1, _mode: Mode = 'surface',
  out: Vec3 = [0, 0, 0], du?: Vec3, dv?: Vec3): Vec3 {
  const group = id % 3, local = Math.floor(id / 3);
  sphereSurface(local, time, seed + group * 37, out, du, dv);
  for (let axis = 0; axis < 3; axis++) {
    out[axis] *= DANGO_RADIUS;
    if (du) du[axis] *= DANGO_RADIUS;
    if (dv) dv[axis] *= DANGO_RADIUS;
  }
  out[1] += (group - 1) * DANGO_SPACING;
  return out;
}

/** Material tangents and outward normal at exactly the same point as dangoPosition. */
export function dangoFrame(id: number, time: number, seed = 1, mode: Mode = 'surface',
  out: SurfaceFrame = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }): SurfaceFrame {
  dangoPosition(id, time, seed, mode, out.z, out.x, out.y);
  return normalizeSurfaceFrame(out);
}
