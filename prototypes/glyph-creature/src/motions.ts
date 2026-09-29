import type { Vec3 } from './model';

export const MOTIONS = ['calm', 'breathe', 'wave'] as const;
export type Motion = typeof MOTIONS[number];
export const MOTION_NAMES: Record<Motion, string> = { calm: '通常', breathe: '呼吸', wave: '波打つ' };
const BREATH_AMPLITUDE = .12;
export const MOTION_EXTENT: Record<Motion, number> = { calm: 1, breathe: Math.exp(BREATH_AMPLITUDE), wave: 1 };

/** Prepare once per frame. Pass an existing object to avoid frame allocations. */
export type MotionTransform = { kind: Motion; scale: number; phase: number };
export function prepareMotion(kind: Motion, time: number, out: MotionTransform = { kind: 'calm', scale: 1, phase: 0 }): MotionTransform {
  out.kind = kind;
  out.scale = kind === 'breathe' ? Math.exp(BREATH_AMPLITUDE * Math.sin(.75 * time)) : 1;
  out.phase = -.8 * time;
  return out;
}

/** Out may alias point. Coordinates are in the individual shape's local frame. */
export function applyMotionPosition(motion: MotionTransform, point: Readonly<Vec3>, out: Vec3 = [0, 0, 0]): Vec3 {
  const [x, y, z] = point;
  if (motion.kind === 'wave') {
    const angle = .20 * Math.sin(1.7 * y + motion.phase), c = Math.cos(angle), s = Math.sin(angle);
    out[0] = c * x - s * z; out[1] = y; out[2] = s * x + c * z;
  } else {
    out[0] = motion.scale * x; out[1] = motion.scale * y; out[2] = motion.scale * z;
  }
  return out;
}

/** Exact inverse at a fixed time, useful for coordinates and numerical checking. */
export function invertMotionPosition(motion: MotionTransform, point: Readonly<Vec3>, out: Vec3 = [0, 0, 0]): Vec3 {
  const [x, y, z] = point;
  if (motion.kind === 'wave') {
    const angle = -.20 * Math.sin(1.7 * y + motion.phase), c = Math.cos(angle), s = Math.sin(angle);
    out[0] = c * x - s * z; out[1] = y; out[2] = s * x + c * z;
  } else {
    out[0] = x / motion.scale; out[1] = y / motion.scale; out[2] = z / motion.scale;
  }
  return out;
}

/**
 * Differential of the position map at the UNTRANSFORMED point, applied to a tangent.
 * A simple rotation is insufficient: the wave's angle changes with height.
 * The result is not normalized. Rebuild the normal from two transformed tangents;
 * do not pass a surface normal as if it were a tangent.
 */
export function applyMotionTangent(motion: MotionTransform, point: Readonly<Vec3>, tangent: Readonly<Vec3>, out: Vec3 = [0, 0, 0]): Vec3 {
  const [x, y, z] = point, [vx, vy, vz] = tangent;
  if (motion.kind === 'wave') {
    const phase = 1.7 * y + motion.phase;
    const angle = .20 * Math.sin(phase), derivative = .34 * Math.cos(phase);
    const c = Math.cos(angle), s = Math.sin(angle);
    const px = c * x - s * z, pz = s * x + c * z;
    out[0] = c * vx - s * vz - pz * derivative * vy;
    out[1] = vy;
    out[2] = s * vx + c * vz + px * derivative * vy;
  } else {
    out[0] = motion.scale * vx; out[1] = motion.scale * vy; out[2] = motion.scale * vz;
  }
  return out;
}

/**
 * Position + two tangents with one set of trigonometric evaluations per glyph.
 * All outputs are caller-owned and must be distinct. Each can alias its input.
 * Re-orthogonalize after this operation only if the renderer requires an orthonormal frame.
 */
export function applyMotionFrame(
  motion: MotionTransform,
  point: Readonly<Vec3>, tangentU: Readonly<Vec3>, tangentV: Readonly<Vec3>,
  outPoint: Vec3, outU: Vec3, outV: Vec3,
): void {
  // Read before writing so an in-place position update cannot corrupt the tangents.
  const [x, y, z] = point, [ux, uy, uz] = tangentU, [vx, vy, vz] = tangentV;
  if (motion.kind === 'wave') {
    const phase = 1.7 * y + motion.phase;
    const angle = .20 * Math.sin(phase), derivative = .34 * Math.cos(phase);
    const c = Math.cos(angle), s = Math.sin(angle);
    const px = c * x - s * z, pz = s * x + c * z;
    outPoint[0] = px; outPoint[1] = y; outPoint[2] = pz;
    outU[0] = c * ux - s * uz - pz * derivative * uy;
    outU[1] = uy;
    outU[2] = s * ux + c * uz + px * derivative * uy;
    outV[0] = c * vx - s * vz - pz * derivative * vy;
    outV[1] = vy;
    outV[2] = s * vx + c * vz + px * derivative * vy;
  } else {
    const a = motion.scale;
    outPoint[0] = a * x; outPoint[1] = a * y; outPoint[2] = a * z;
    outU[0] = a * ux; outU[1] = a * uy; outU[2] = a * uz;
    outV[0] = a * vx; outV[1] = a * vy; outV[2] = a * vz;
  }
}
