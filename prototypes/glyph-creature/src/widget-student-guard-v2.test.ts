import { describe, expect, it } from 'vitest';
import { widgetStudentGuardV2Resolution } from './widget-student-guard-v2';
import { widgetStudentResolution } from './widget-student';
import { compileScaffoldProgram } from './scaffold-program';

describe('fixed student with explicit guard v2', () => {
  it('holds whole families of cancellation and imperative absence', () => {
    for (const text of ['円環の追加をキャンセル', '球を描くな!', '輪がないもの', 'delete the vase', 'omit a rod']) {
      const result = widgetStudentGuardV2Resolution(text);
      expect(result.program, text).toBeNull();
      expect(result.evidence.some(item => item.kind === 'explicit-v2-global-guard')).toBe(true);
      expect(result.classifierMs).toBe(0);
    }
  });
  it('holds quoted words and code context instead of interpreting a literal as a shape', () => {
    for (const text of ['「輪」という単語を書く', 'quoted sphere', 'a box variable', '`vase`', "'ring'"]) expect(widgetStudentGuardV2Resolution(text).program, text).toBeNull();
  });
  it('holds opposing attributes inside one part but permits them on separate parts', () => {
    for (const text of ['幅の広い細い花瓶', 'big small ball', 'curved straight tube', 'twisted untwisted ring']) expect(widgetStudentGuardV2Resolution(text).program, text).toBeNull();
    const distinct = widgetStudentGuardV2Resolution('長い棒の上に短い箱');
    expect(distinct.program?.parts.map(part => part.primitive)).toEqual(['tube', 'box']);
    expect(distinct.program!.parts[0].height).toBeGreaterThan(distinct.program!.parts[1].height);
  });
  it('applies axis-specific attribute rules only to the local noun phrase', () => {
    const horizontal = widgetStudentGuardV2Resolution('横方向に伸ばす箱').program!.parts[0];
    expect(horizontal.width).toBeGreaterThan(horizontal.height);
    const vertical = widgetStudentGuardV2Resolution('縦長の花瓶').program!.parts[0];
    expect(vertical.height).toBeGreaterThan(vertical.width);
    const flattened = widgetStudentGuardV2Resolution('ぺちゃんこに潰れた球').program!.parts[0];
    expect(flattened.height).toBeLessThan(flattened.width);
  });
  it('corrects explicit English on-the-end direction without changing relation weights', () => {
    const input = 'a sphere on the end of a rod';
    const original = widgetStudentResolution(input);
    const guarded = widgetStudentGuardV2Resolution(input);
    expect(guarded.program?.parts.map(part => part.primitive)).toEqual(['tube', 'sphere']);
    expect(guarded.program?.relation?.kind).toBe('end');
    expect(guarded.relationCandidates).toEqual(original.relationCandidates);
    expect(guarded.evidence.some(item => item.kind === 'explicit-v2-parent-order')).toBe(true);
  });
  it('holds through children the procedural compiler cannot build, keeping the original immutable', () => {
    const input = 'a vase through a tube';
    const original = widgetStudentResolution(input);
    expect(original.program).not.toBeNull();
    expect(compileScaffoldProgram(original.program)).toBeNull();
    const guarded = widgetStudentGuardV2Resolution(input);
    expect(guarded.program).toBeNull();
    expect(guarded.reason).toBe('geometry-unsupported');
    expect(widgetStudentResolution(input).program).toEqual(original.program);
    const supported = widgetStudentGuardV2Resolution('a rod through a box');
    expect(supported.program).not.toBeNull();
    expect(compileScaffoldProgram(supported.program)).not.toBeNull();
  });
  it('keeps uncertain words uncertain rather than lowering the frozen threshold', () => {
    const input = 'a silver dagger';
    const original = widgetStudentResolution(input), guarded = widgetStudentGuardV2Resolution(input);
    expect(original.program).toBeNull();
    expect(guarded.program).toBeNull();
    expect(guarded.primitiveCandidates).toEqual(original.primitiveCandidates);
  });
});
