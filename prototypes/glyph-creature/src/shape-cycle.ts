import { EXPANDED_SHAPES } from './shape-catalog';
import { DEFAULT_SPEC, shapeChoices, type SceneSpec, type Shape } from './language';

export const CYCLE_SECONDS = 30;
export const PHRASE_SECONDS = 60;
const sequence: Shape[] = ['condense', 'cube', 'mobius', 'ring', 'cuboid', 'dango', 'orbit', 'vortex', 'flower', 'butterfly', 'jellyfish', 'tree', 'star', 'helix', 'hourglass', 'saturn', 'sword', 'vase', ...EXPANDED_SHAPES];

/** Only active viewing time counts; the caller excludes pause, archives and followers. */
export class ShapeCycle {
  enabled = true;
  remaining = CYCLE_SECONDS;
  reset() { this.remaining = CYCLE_SECONDS; }
  hold() { this.remaining = PHRASE_SECONDS; }
  setEnabled(enabled: boolean) { this.enabled = enabled; this.reset(); }
  advance(seconds: number, spec: SceneSpec): SceneSpec | null {
    if (!this.enabled || !Number.isFinite(seconds) || seconds <= 0) return null;
    this.remaining -= seconds;
    if (this.remaining > 1e-6) return null;
    // A long suspended frame produces one transition, never a catch-up burst.
    this.reset();
    const next = sequence[(sequence.indexOf(spec.shape) + 1) % sequence.length];
    return { ...spec, shape: next, mode: 'surface', count: 1, arrangement: 'single', deformation: 'gentle' };
  }
}

export function hasShapeIntent(text: string, learned = false): boolean {
  const plain = text.normalize('NFKC');
  return learned || shapeChoices(plain).length > 0 || /鎖|くさり|大小|二つの輪|2つの輪|大きい.*小さい|小さい.*大きい|オメガ|Ω|\b(?:chain|omega)\b|\d+\s*(?:個|つ|本|枚|輪|rings?)/iu.test(plain);
}

/** A stable cue ignores ordinary prose and ink, so typing after a phrase does not
 * keep re-selecting an old shape or restart its hold on every keystroke. */
export function writingCue(text: string, parsed: { spec: SceneSpec; learned: boolean; recognized: boolean }): string {
  const spec = parsed.spec;
  const explicit = hasShapeIntent(text, parsed.learned);
  const modifier = spec.mode !== DEFAULT_SPEC.mode || spec.motion !== DEFAULT_SPEC.motion
    || /表面|通常|変形なし|\bsurface\b/iu.test(text);
  return parsed.recognized && (explicit || modifier)
    ? JSON.stringify([shapeChoices(text), spec.shape, spec.mode, spec.count, spec.arrangement, spec.deformation, spec.motion]) : '';
}
