import type { Glyph } from './model';

/** Rendering samples the body; the original glyphs and input batches stay intact. */
export function displayGlyphs(glyphs: Glyph[], limit: number): Glyph[] {
  const cap = Math.max(1, Math.floor(limit));
  if (glyphs.length <= cap) return glyphs;
  if (cap === 1) return glyphs.slice(0, 1);
  const recent = Math.min(glyphs.length - 1, Math.floor(cap / 4));
  const olderEnd = glyphs.length - recent;
  const budget = cap - recent - 1;
  const sampled = [glyphs[0]];
  for (let i = 0; i < budget; i++) sampled.push(glyphs[1 + Math.floor((i + .5) * (olderEnd - 1) / budget)]);
  return sampled.concat(glyphs.slice(olderEnd));
}
