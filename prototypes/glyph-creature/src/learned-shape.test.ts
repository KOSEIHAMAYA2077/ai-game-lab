import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import parity from '../../../experiments/word-shape/artifacts/parity.json';
import { predictShape, interpretWithModel } from './learned-shape';
import { DEFAULT_SPEC, explicitShape, interpret } from './language';

const root = new URL('../../../experiments/word-shape/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root), 'utf8');

describe('学習した重みをブラウザへ渡す', () => {
  it('PythonとJSで、Unicode前処理・スコア・棄却が一致する', () => {
    for (const { text, prediction } of parity) {
      const actual = predictShape(text);
      expect(actual.label).toBe(prediction.label); expect(actual.reason).toBe(prediction.reason);
      expect(actual.score).toBeCloseTo(prediction.score, 9); expect(actual.margin).toBeCloseTo(prediction.margin, 9);
      expect(actual.coverage).toBeCloseTo(prediction.coverage, 9);
    }
  });
  it('学習機能がオフなら既存動作を保ち、オンでは形だけを学習で選ぶ', () => {
    expect(interpretWithModel('サイコロを黄色に', DEFAULT_SPEC, false).spec.shape).toBe('cube');
    const result = interpretWithModel('サイコロを黄色に', DEFAULT_SPEC, true);
    expect(result).toMatchObject({ learned: true, spec: { shape: 'cube' }, ink: 'yellow' });
    expect(interpretWithModel('ドーナツ 8個', DEFAULT_SPEC, true).spec).toMatchObject({ shape: 'ring', count: 8 });
    expect(interpretWithModel('今日は眠い', DEFAULT_SPEC, true)).toMatchObject({ learned: false, recognized: false });
    expect(interpretWithModel('立方体にはしないで', DEFAULT_SPEC, true).spec.shape).toBe('condense');
    expect(interpretWithModel('円環 鎖', DEFAULT_SPEC, true).spec.arrangement).toBe('chain');
  });
  it('凍結した最終評価のモデル同一性とPython結果を確認し、既存語彙との比較を記録', () => {
    const frozen = JSON.parse(read('artifacts/evaluation.json'));
    expect(createHash('sha256').update(read('artifacts/model.json')).digest('hex')).toBe(frozen.model_sha256);
    const rows = frozen.results.filter((r: any) => !r.exact_overlap);
    const results = rows.map((r: any) => {
      const model = predictShape(r.text);
      expect(model.label).toBe(r.prediction.label);
      const grammar = explicitShape(r.text) ? interpret(r.text, DEFAULT_SPEC).spec.shape : 'none';
      const combined = interpretWithModel(r.text, DEFAULT_SPEC, true);
      const combinedShape = combined.learned ? combined.spec.shape : 'none';
      return { id: r.id, text: r.text, expected: r.label, model: model.label, grammar, combined: combinedShape };
    });
    const summarize = (key: 'model' | 'grammar' | 'combined') => {
      const accepted = results.filter((r: any) => r[key] !== 'none');
      const correct = accepted.filter((r: any) => r[key] === r.expected).length;
      const negatives = results.filter((r: any) => r.expected === 'none');
      return { n: results.length, correct: results.filter((r: any) => r[key] === r.expected).length, accepted: accepted.length,
        accepted_correct: correct, shape_recall: correct / (results.length - negatives.length),
        false_shape_on_none: negatives.filter((r: any) => r[key] !== 'none').length, negatives: negatives.length };
    };
    const report = { model_sha256: frozen.model_sha256, exact_overlap_excluded: frozen.overlap_count, model: summarize('model'), grammar: summarize('grammar'), combined: summarize('combined'), results };
    writeFileSync(new URL('../word-shapes-v2/evidence/legacy-model-comparison.json', root), JSON.stringify(report, null, 2) + '\n');
  });
});
