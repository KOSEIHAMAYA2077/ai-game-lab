import { composedPosition } from '../../prototypes/glyph-creature/src/shapes';
import { surfaceFrame } from '../../prototypes/glyph-creature/src/surface-frame';
import type { SceneSpec } from '../../prototypes/glyph-creature/src/language';
export type Shape = 'sphere' | 'box' | 'ring';
export const MAPPING = Object.freeze({ sphere: 'condense', box: 'cube', ring: 'mobius' } as const);
export function sceneSpec(shape: Shape): SceneSpec {
  if (!(shape in MAPPING)) throw new Error('unsupported three-view label');
  return { shape: MAPPING[shape], mode: 'surface', count: 1, arrangement: 'single', deformation: 'gentle', motion: 'calm' };
}
export function sampleSurface(shape: Shape, receiverId: number, time: number) {
  if (!Number.isSafeInteger(receiverId) || receiverId < 1 || receiverId > 256) throw new Error('receiver id required');
  const spec = sceneSpec(shape);
  return { receiverId, position: composedPosition(spec, receiverId, time, 1), frame: surfaceFrame(spec, receiverId, time, 1)! };
}
