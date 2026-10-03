import { GlyphScene } from '../scene';
import { smooth, type Vec3 } from '../model';

export type TaskAttributes = {
  length: 'short' | 'neutral' | 'long';
  width: 'narrow' | 'neutral' | 'wide';
  bend: 'straight' | 'curved';
};
export type DeformationParams = { length: number; width: number; bend: number };
export const NEUTRAL_PARAMS: DeformationParams = { length: 1, width: 1, bend: 0 };

export function deformationParams(attributes: Partial<TaskAttributes>): DeformationParams {
  return {
    length: attributes.length === 'short' ? .7 : attributes.length === 'long' ? 1.65 : 1,
    width: attributes.width === 'narrow' ? .65 : attributes.width === 'wide' ? 1.5 : 1,
    bend: attributes.bend === 'curved' ? .35 : 0,
  };
}

export function boundedParams(value: DeformationParams): DeformationParams {
  const bound = (n: number, low: number, high: number, fallback: number) => Number.isFinite(n) ? Math.max(low, Math.min(high, n)) : fallback;
  return { length: bound(value.length, .7, 1.65, 1), width: bound(value.width, .65, 1.5, 1), bend: bound(value.bend, 0, .35, 0) };
}

/** The bow is bounded by 2*bend, even for a long intake path. */
export function deformPoint(point: ArrayLike<number>, params: DeformationParams): Vec3 {
  const y = point[1] * params.length;
  return [point[0] * params.width + params.bend * (1 - Math.cos(y)), y, point[2] * params.width];
}

/** Analytic derivative of deformPoint: use the same map for surface tangents. */
export function deformVector(vector: ArrayLike<number>, point: ArrayLike<number>, params: DeformationParams): Vec3 {
  return [params.width * vector[0] + params.bend * params.length * Math.sin(point[1] * params.length) * vector[1], params.length * vector[1], params.width * vector[2]];
}

const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (p: Vec3): Vec3 => { const norm = Math.hypot(...p); return p.map(value => value / norm) as Vec3; };
export function deformBasis(x: ArrayLike<number>, y: ArrayLike<number>, point: ArrayLike<number>, params: DeformationParams) {
  const tx = unit(deformVector(x, point, params));
  const rawY = deformVector(y, point, params), projection = dot(tx, rawY);
  const ty = unit(rawY.map((value, axis) => value - projection * tx[axis]) as Vec3);
  const tz: Vec3 = [tx[1] * ty[2] - tx[2] * ty[1], tx[2] * ty[0] - tx[0] * ty[2], tx[0] * ty[1] - tx[1] * ty[0]];
  return { x: tx, y: ty, z: tz };
}

const shaderHelpers = `
  uniform float studentLength, studentWidth, studentBend;
  vec3 taskDeformPosition(vec3 p) {
    float y = p.y * studentLength;
    return vec3(p.x * studentWidth + studentBend * (1.0 - cos(y)), y, p.z * studentWidth);
  }
  vec3 taskDeformVector(vec3 v, vec3 p) {
    return vec3(studentWidth * v.x + studentBend * studentLength * sin(p.y * studentLength) * v.y,
      studentLength * v.y, studentWidth * v.z);
  }
`;

/** Only this independent page patches its own material; existing scenes are intact. */
export class TaskStudentScene extends GlyphScene {
  params = { ...NEUTRAL_PARAMS };
  targetParams = { ...NEUTRAL_PARAMS };

  installDeformation() {
    this.material.uniforms.studentLength = { value: 1 };
    this.material.uniforms.studentWidth = { value: 1 };
    this.material.uniforms.studentBend = { value: 0 };
    const shader = this.material.vertexShader;
    const surface = `vec3 onSurface = materialPlane + 2.0 * cross(surfaceRotation.xyz,
            cross(surfaceRotation.xyz, materialPlane) + surfaceRotation.w * materialPlane);`;
    const normal = `vec3 outward = vec3(0.0, 0.0, 1.0);
          outward += 2.0 * cross(surfaceRotation.xyz,
            cross(surfaceRotation.xyz, outward) + surfaceRotation.w * outward);`;
    if (!shader.includes(surface) || !shader.includes(normal)) throw new Error('Surface shader contract changed');
    this.material.vertexShader = shader.replace('void main() {', shaderHelpers + '\nvoid main() {')
      .replace(surface, `
          vec3 sourceX = vec3(1.0, 0.0, 0.0);
          sourceX += 2.0 * cross(surfaceRotation.xyz, cross(surfaceRotation.xyz, sourceX) + surfaceRotation.w * sourceX);
          vec3 sourceY = vec3(0.0, 1.0, 0.0);
          sourceY += 2.0 * cross(surfaceRotation.xyz, cross(surfaceRotation.xyz, sourceY) + surfaceRotation.w * sourceY);
          vec3 taskSurfaceX = normalize(taskDeformVector(sourceX, center));
          vec3 rawSurfaceY = taskDeformVector(sourceY, center);
          vec3 taskSurfaceY = normalize(rawSurfaceY - taskSurfaceX * dot(taskSurfaceX, rawSurfaceY));
          vec3 taskSurfaceZ = cross(taskSurfaceX, taskSurfaceY);
          vec3 onSurface = taskSurfaceX * materialPlane.x + taskSurfaceY * materialPlane.y + taskSurfaceZ * materialPlane.z;`)
      .replace('vec4 mv = modelViewMatrix * vec4(center, 1.0)', 'vec3 bodyCenter = mix(center, taskDeformPosition(center), settled);\n          vec4 mv = modelViewMatrix * vec4(bodyCenter, 1.0)')
      .replace(normal, 'vec3 outward = taskSurfaceZ;')
      .replace('vec3 viewCenter = (modelViewMatrix * vec4(center, 1.0)).xyz;', 'vec3 viewCenter = (modelViewMatrix * vec4(bodyCenter, 1.0)).xyz;');
    this.material.needsUpdate = true;
  }

  setDeformation(value: DeformationParams) { this.targetParams = boundedParams(value); }

  override reset() {
    this.params = { ...NEUTRAL_PARAMS }; this.targetParams = { ...NEUTRAL_PARAMS };
    super.reset();
  }

  override render(dt: number) {
    const blend = dt === 0 ? 0 : 1 - Math.exp(-dt * 4);
    for (const key of ['length', 'width', 'bend'] as const) this.params[key] += (this.targetParams[key] - this.params[key]) * blend;
    this.material.uniforms.studentLength.value = this.params.length;
    this.material.uniforms.studentWidth.value = this.params.width;
    this.material.uniforms.studentBend.value = this.params.bend;
    // The original framing already fits the authored surface; expand it for the
    // largest scaled axis and bounded bow without following each animated breath.
    const userZoom = this.zoom;
    this.zoom = userZoom * Math.max(1, this.params.length, this.params.width) * (1 + this.params.bend * .35);
    try { super.render(dt); } finally { this.zoom = userZoom; }
  }

  deformationBounds() {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    let finite = true, radius = 0;
    for (let i = 0; i < this.count; i++) {
      const source = this.positions.subarray(i * 3, i * 3 + 3);
      const warped = deformPoint(source, this.params);
      const settled = smooth((this.matter.time - this.displayedGlyphs[i].born) / 3.8);
      const point = warped.map((v, axis) => source[axis] + (v - source[axis]) * settled);
      finite &&= point.every(Number.isFinite);
      radius = Math.max(radius, Math.hypot(...point));
      for (let axis = 0; axis < 3; axis++) { min[axis] = Math.min(min[axis], point[axis]); max[axis] = Math.max(max[axis], point[axis]); }
    }
    return { min, max, radius, finite, samples: this.count, space: 'local-glyph-centers' };
  }
}
