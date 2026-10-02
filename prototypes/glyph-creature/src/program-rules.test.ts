import { describe, expect, it } from 'vitest';
import { ruleProgramResolution } from './program-rules';

describe('explicit program baseline', () => {
  it('keeps repeated primitives as distinct parts and scopes dimensions', () => {
    const program = ruleProgramResolution('大きな球の上に小さな球').program!;
    expect(program.parts.map(p => p.primitive)).toEqual(['sphere','sphere']);
    expect(program.parts[0].width).toBeGreaterThan(program.parts[1].width);
    expect(program.relation?.kind).toBe('above');
  });
  it('normalizes English direction to parent first', () => {
    const program = ruleProgramResolution('a sphere above a box').program!;
    expect(program.parts.map(p => p.primitive)).toEqual(['box','sphere']);
  });
  it('holds negation, ordinary words and excessive parts', () => {
    for (const text of ['球は作らないで', 'きょうの文章', '球の上に箱と棒']) expect(ruleProgramResolution(text).program).toBeNull();
  });
});
