export const MAX_GLYPHS = 32_000;
export const MAX_KINDS = 1_024;
export const MAX_INPUT_LENGTH = 16_384;
export const FORMS = ['condense', 'vortex', 'orbit', 'mobius'] as const;
export type Form = (typeof FORMS)[number];
export type Vec3 = [number, number, number];
export type Glyph = { text: string; born: number; id: number };
export const TAU = Math.PI * 2;
const fract = (n: number) => n - Math.floor(n);
export const smooth = (n: number) => { const v = Math.max(0, Math.min(1, n)); return v * v * (3 - 2 * v); };
const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });

export function splitGlyphs(text: string): string[] {
  return Array.from(segmenter.segment(text.normalize('NFC')), part => part.segment)
    .filter(value => !/^\s+$/u.test(value) && !/^[\p{Cc}\p{Cf}]+$/u.test(value));
}

export function growth(count: number): number { return 1 + 0.22 * Math.log2(1 + (count - 1) / 64); }
export function cameraDistance(count: number): number { return 6.3 + (growth(count) - 1) * 4.1; }
export function newness(born: number, time: number): number { return 1 - smooth((time - born - 0.6) / 7); }

export function mobius(u: number, width: number): Vec3 {
  const r = 1.32 + width * Math.cos(u / 2);
  return [r * Math.cos(u), r * Math.sin(u) * 0.84, width * Math.sin(u / 2)];
}

/** Stable particle identities follow continuous fields; changing form never changes their text. */
export function shapePosition(form: Form, id: number, time: number, seed = 1): Vec3 {
  const a = fract((id + seed * 0.13) * 0.618033988749895);
  const b = fract((id + seed * 0.27) * 0.754877666246693);
  const c = fract((id + seed * 0.41) * 0.569840290998053);
  if (form === 'mobius') {
    return mobius(a * TAU * 2 + time * 0.23, (b - 0.5) * 0.97);
  }
  if (form === 'condense') {
    const latitude = Math.acos(2 * b - 1);
    const theta = a * TAU + time * (0.11 + 0.075 * Math.sin(latitude * 3));
    const lobe = 1 + 0.13 * Math.sin(theta * 3 + latitude * 2 + time * 0.16);
    const r = (1.05 + 0.1 * Math.sin(time * 0.38)) * lobe;
    return [r * Math.sin(latitude) * Math.cos(theta), r * Math.cos(latitude) * 1.05, r * Math.sin(latitude) * Math.sin(theta)];
  }
  if (form === 'vortex') {
    const stream = id % 9;
    const phase = a * TAU + time * 0.11;
    const v = (1 + Math.sin(phase)) / 2;
    const theta = stream * TAU / 9 + v * TAU * 1.55 + time * 0.25;
    const r = 0.18 + Math.pow(v, 0.85) * 1.42 + (b - 0.5) * 0.13;
    return [r * Math.cos(theta), (v - 0.5) * 1.45 + Math.sin(theta) * 0.25, r * Math.sin(theta) * 0.65];
  }
  if (id % 11 === 0) {
    const theta = a * TAU + time * 0.4;
    return [0.27 * Math.cos(theta) * Math.sin(b * Math.PI), 0.27 * Math.cos(b * Math.PI), 0.27 * Math.sin(theta) * Math.sin(b * Math.PI)];
  }
  const band = id % 3;
  const theta = a * TAU + time * (0.29 + band * 0.055);
  const radius = 1.55 + (c - 0.5) * 0.16;
  const x = radius * Math.cos(theta);
  const y = radius * 0.28 * Math.sin(theta) + (b - 0.5) * 0.09;
  const turn = band * Math.PI / 3;
  return [x * Math.cos(turn) - y * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(turn), radius * 0.76 * Math.sin(theta)];
}

export class Matter {
  glyphs: Glyph[] = [];
  kinds = new Set<string>();
  time = 0;
  seed = 1;
  form: Form = 'condense';
  batches: { text: string; repeat: number; added: number; at: number }[] = [];
  constructor() { this.reset(); }
  reset(seed = 1) {
    this.seed = seed; this.time = 0; this.form = 'condense';
    this.glyphs = [{ text: '@', born: -20, id: 0 }]; this.kinds = new Set(['@']); this.batches = [];
  }
  add(text: string, repeat = 1): { added: number; limited: boolean; empty: boolean; reason?: 'input' | 'capacity' | 'kinds' } {
    // Reject oversized input intact: slicing UTF-16 can split a glyph or surrogate pair.
    if (text.length > MAX_INPUT_LENGTH) return { added: 0, limited: true, empty: false, reason: 'input' };
    const chars = splitGlyphs(text);
    if (!chars.length) return { added: 0, limited: false, empty: true };
    const repetitions = Math.max(1, Math.min(256, Math.floor(repeat) || 1));
    let added = 0;
    let limited = false;
    let reason: 'capacity' | 'kinds' | undefined;
    outer: for (let r = 0; r < repetitions; r++) {
      for (const char of chars) {
        if (this.glyphs.length >= MAX_GLYPHS) { limited = true; reason = 'capacity'; break outer; }
        if (!this.kinds.has(char) && this.kinds.size >= MAX_KINDS) { limited = true; reason = 'kinds'; break outer; }
        this.kinds.add(char);
        this.glyphs.push({ text: char, born: this.time, id: this.glyphs.length });
        added++;
      }
    }
    if (added) this.batches.push({ text, repeat: repetitions, added, at: this.time });
    return { added, limited, empty: false, reason };
  }
  step(seconds: number) { this.time += Math.max(0, Math.min(seconds, 60)); }
  inspect() {
    return {
      count: this.glyphs.length, kinds: this.kinds.size, form: this.form, time: this.time,
      scale: growth(this.glyphs.length), targetCamera: cameraDistance(this.glyphs.length),
      redCount: this.glyphs.filter(g => newness(g.born, this.time) > 0.05).length,
      characters: [...this.kinds], batches: this.batches.map(b => ({ ...b })),
      seed: this.seed, limit: MAX_GLYPHS,
    };
  }
}
