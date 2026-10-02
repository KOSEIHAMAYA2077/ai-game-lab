import { describe, expect, it } from 'vitest';
import { inspectWidgetStudent, widgetStudentResolution, widgetStudentScores } from './widget-student';
import { validateProgram } from './scaffold-program';

describe('tiny char student bounded interpreter', () => {
  it('returns only finite validated Programs across each known primitive', () => {
    for (const text of ['球体', '立方体', '棒', '剣', '輪っか', '花瓶']) {
      const result = widgetStudentResolution(text);
      expect(result.program, text + ': ' + result.reason).not.toBeNull();
      expect(validateProgram(result.program)).toEqual(result.program);
    }
  });
  it('learns masked relations, scopes attributes and uses rules for parent order', () => {
    const result = widgetStudentResolution('白い細い棒の先に青い大きな球');
    expect(result.program?.parts.map(part => part.primitive)).toEqual(['tube', 'sphere']);
    expect(result.program?.relation?.kind).toBe('end');
    expect(result.program!.parts[0].width).toBeLessThan(result.program!.parts[1].width);
    expect(result.evidence.map(value => value.kind)).toContain('learned-char-relation');
    const reverse = widgetStudentResolution('a sphere above a box');
    expect(reverse.program?.parts.map(part => part.primitive)).toEqual(['box', 'sphere']);
    expect(reverse.program?.relation?.kind).toBe('above');
  });
  it('never invents a Program for explicit negation or unsupported bounds', () => {
    for (const text of ['球を作らないで', 'do not attach a ball to a tube', '球の上に箱と棒', '宇宙船', '明日の予定について', 'x'.repeat(4001)]) {
      expect(widgetStudentResolution(text).program, text).toBeNull();
    }
  });
  it('does not use color as structural relation evidence', () => {
    for (const input of ['棒の先に球', '赤い棒の先に青い球', '白い棒の先に黄色い球']) {
      const result = widgetStudentResolution(input);
      expect(result.program?.relation?.kind).toBe('end');
      expect(result.relationCandidates).toEqual(widgetStudentResolution('棒の先に球').relationCandidates);
    }
  });
  it('uses fixed tiny arrays without a transformer or external request path', () => {
    widgetStudentScores('object above object', 'relation');
    const info = inspectWidgetStudent();
    expect(info.headCount).toBe(2);
    expect(info.decodedWeightBytes).toBeLessThan(100_000);
    expect(info.externalRequests).toBe(false);
    expect(info.transformer).toBe(false);
  });
});
