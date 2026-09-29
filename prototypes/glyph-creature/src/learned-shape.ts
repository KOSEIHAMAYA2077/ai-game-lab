import rawModel from '../../../experiments/word-shape/artifacts/model.json';
import { interpret, type SceneSpec, type Shape } from './language';

type Label = Shape | 'none';
type Model = { format: string; version: string; labels: Label[]; maxChars: number; vocabulary: string[]; idf: number[]; weights: number[][]; bias: number[]; thresholds: { score: number; margin: number; coverage: number } };
const model = rawModel as Model;
const vocab = new Map(model.vocabulary.map((g, i) => [g, i]));
const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
export type ShapePrediction = { label: Label; candidate: Label; score: number; margin: number; coverage: number; reason: 'length' | 'none' | 'accepted' | 'uncertain' };

/** Learned weights only: no synonym dictionary in this inference function. */
export function predictShape(text: string): ShapePrediction {
  const normalized = normalize(text), chars = [...normalized];
  if (!chars.length || chars.length > model.maxChars) return { label: 'none', candidate: 'none', score: 0, margin: 0, coverage: 0, reason: 'length' };
  const sequence = ['^', ...chars, '$'], grams = new Set<string>();
  for (let n = 1; n <= 3; n++) for (let i = 0; i + n <= sequence.length; i++) grams.add(sequence.slice(i, i + n).join(''));
  const features = [...grams].flatMap(g => { const id = vocab.get(g); return id === undefined ? [] : [{ id, value: model.idf[id] }]; });
  const norm = Math.sqrt(features.reduce((sum, f) => sum + f.value ** 2, 0)) || 1;
  const scores = [...model.bias];
  for (const f of features) for (let j = 0; j < scores.length; j++) scores[j] += f.value / norm * model.weights[f.id][j];
  const maximum = Math.max(...scores), exps = scores.map(v => Math.exp(v - maximum)), sum = exps.reduce((a, b) => a + b, 0);
  const order = exps.map((v, index) => ({ score: v / sum, index })).sort((a, b) => b.score - a.score);
  const candidate = model.labels[order[0].index], score = order[0].score, margin = score - order[1].score;
  const unique = new Set(chars), coverage = [...unique].filter(c => vocab.has(c)).length / unique.size;
  const accepted = score >= model.thresholds.score && margin >= model.thresholds.margin && coverage >= model.thresholds.coverage;
  return { label: accepted ? candidate : 'none', candidate, score, margin, coverage, reason: candidate === 'none' ? 'none' : accepted ? 'accepted' : 'uncertain' };
}

/** In the optional model mode, the model owns the shape slot; modifiers remain explicit. */
export function interpretWithModel(text: string, current: SceneSpec, enabled: boolean, choose?: () => number) {
  const original = interpret(text, current, undefined, choose);
  if (!enabled) return { ...original, learned: false };
  // New authored phenomena are outside the frozen model's label set.
  if (original.spec.shape === 'fireworks' && /花火|はなび|fireworks?/iu.test(text)) return { ...original, learned: false };
  const prediction = predictShape(text);
  if (prediction.label === 'none') return { ...interpret(text, current, null, choose), learned: false, prediction };
  const composed = interpret(text, current, prediction.label, choose);
  return { ...composed, learned: true, prediction };
}
