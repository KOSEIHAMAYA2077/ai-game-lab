import { Matter, MAX_INPUT_LENGTH, MAX_GLYPHS } from './model';
import { COLORS, SHAPES, type SceneSpec, type Ink } from './language';
import { MOTIONS } from './motions';
import { validateProgram, type Program } from './scaffold-program';
const KEY = 'glyph-widget-state-v1';
type Store = Pick<Storage, 'getItem'|'setItem'>;
const finite = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

export function saveWidget(matter: Matter, program: Program | null, store: Store = localStorage): boolean {
  try {
    // Persist original input batches and shape parameters, not GPU buffers or model weights.
    store.setItem(KEY, JSON.stringify({ version: 1, seed: matter.seed, time: matter.time, spec: matter.spec, program, batches: matter.batches }));
    return true;
  } catch { return false; }
}
export function restoreWidget(matter: Matter, store: Store = localStorage): { spec: SceneSpec; program: Program | null } | null {
  try {
    const raw = store.getItem(KEY); if (!raw || raw.length > 4_000_000) return null;
    const state = JSON.parse(raw);
    if (state.version !== 1 || !finite(state.seed, 0, 0xffffffff) || !finite(state.time, 0, 1e9) || !Array.isArray(state.batches) || state.batches.length > MAX_GLYPHS) return null;
    const s = state.spec;
    if (!s || !SHAPES.includes(s.shape) || !['surface','flow'].includes(s.mode) || !['single','swarm','chain'].includes(s.arrangement) || !['gentle','omega','double'].includes(s.deformation) || !finite(s.count,1,16) || !Number.isInteger(s.count) || (s.motion !== undefined && !MOTIONS.includes(s.motion))) return null;
    const program = state.program === null ? null : validateProgram(state.program); if (state.program !== null && !program) return null;
    let expected = 1;
    for (const b of state.batches) {
      if (typeof b.text !== 'string' || b.text.length > MAX_INPUT_LENGTH || !finite(b.repeat,1,256) || !Number.isInteger(b.repeat) || !finite(b.added,1,MAX_GLYPHS) || !Number.isInteger(b.added) || !finite(b.seed,0,0xffffffff) || !finite(b.at,0,state.time) || (b.ink !== undefined && !Object.hasOwn(COLORS,b.ink))) return null;
      // A batch keeps its complete input even when kinds/capacity limit how many
      // glyphs are accepted. Budget the recorded body, then verify by rebuilding.
      expected += b.added;
      if (expected > MAX_GLYPHS) return null;
    }
    const restored = new Matter(); restored.reset(state.seed);
    for (const b of state.batches) {
      restored.time = b.at;
      const result = restored.add(b.text,b.repeat,{ink:b.ink as Ink|undefined,seed:b.seed});
      const rebuilt = restored.batches.at(-1);
      if (result.added !== b.added || !rebuilt || rebuilt.text !== b.text || rebuilt.repeat !== b.repeat || rebuilt.added !== b.added || rebuilt.at !== b.at || rebuilt.ink !== b.ink || rebuilt.seed !== b.seed) return null;
    }
    if (restored.glyphs.length !== expected || restored.batches.length !== state.batches.length) return null;
    restored.time = state.time; restored.spec = {shape:s.shape,mode:s.mode,count:s.count,arrangement:s.arrangement,deformation:s.deformation,motion:s.motion};
    matter.glyphs = restored.glyphs; matter.kinds = restored.kinds; matter.batches = restored.batches; matter.time = restored.time; matter.seed = restored.seed; matter.spec = restored.spec;
    return { spec: { ...restored.spec }, program };
  } catch { return null; }
}
