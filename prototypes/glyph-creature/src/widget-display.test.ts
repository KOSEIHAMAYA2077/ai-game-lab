import { describe, it, expect } from 'vitest';
import { displayGlyphs } from './widget-display';
import { Matter } from './model';
describe('widget display budget without losing stored letters', () => {
  it('keeps the seed, earlier letters/colors and recent letters within the draw budget', () => {
    const body = new Matter(); body.add('過去の白い文', 256, { ink: 'white', seed: 1 }); body.add('青い新しい文', 128, { ink: 'blue', seed: 2 });
    const before = JSON.stringify(body.inspect());
    const shown = displayGlyphs(body.glyphs, 1536);
    expect(shown).toHaveLength(1536); expect(shown[0]).toBe(body.glyphs[0]);
    expect(new Set(shown.map(g => g.id)).size).toBe(1536);
    expect(shown.some(g => g.ink === 'white')).toBe(true); expect(shown.some(g => g.ink === 'blue')).toBe(true);
    expect(shown.at(-1)).toBe(body.glyphs.at(-1)); expect(JSON.stringify(body.inspect())).toBe(before);
  });
  it('does not allocate a sampled copy below budget', () => { const m = new Matter(); expect(displayGlyphs(m.glyphs, 1536)).toBe(m.glyphs); });
});
