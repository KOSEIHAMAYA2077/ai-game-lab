// Four learned linear heads over a frozen 128-dimensional local encoder.
// No teacher, transformer, HTTP prediction, or executable model content.
const defaults = { length: 'neutral', width: 'neutral', bend: 'straight' };
const allowed = { length: ['short', 'neutral', 'long'], width: ['narrow', 'neutral', 'wide'], bend: ['straight', 'curved'] };

export function loadDenseModel(json) {
  if (json?.format !== 'glyph-static-task-v1' || json.dimensions !== 128) throw new Error('unsupported-static-task-model');
  const heads = {};
  for (const key of ['shape', 'length', 'width', 'bend']) {
    const head = json.heads?.[key];
    if (!head || !Array.isArray(head.labels) || !Array.isArray(head.bias) || head.labels.length !== head.bias.length) throw new Error('invalid-task-head');
    if (key === 'shape' ? head.labels.length !== 61 || !head.labels.includes('hold') : JSON.stringify(head.labels) !== JSON.stringify(allowed[key])) throw new Error('invalid-task-labels');
    if (head.bias.some(v => !Number.isFinite(v))) throw new Error('invalid-task-bias');
    const binary = atob(head.weights), expected = 128 * head.labels.length * 4;
    if (binary.length !== expected) throw new Error('invalid-task-weights');
    const view = new DataView(Uint8Array.from(binary, c => c.charCodeAt(0)).buffer);
    const weights = new Float32Array(expected / 4);
    for (let i = 0; i < weights.length; i++) {
      weights[i] = view.getFloat32(i * 4, true);
      if (!Number.isFinite(weights[i])) throw new Error('nonfinite-task-weight');
    }
    heads[key] = { labels: [...head.labels], bias: [...head.bias], weights };
  }
  const gates = json.thresholds;
  if (!gates || ['score', 'margin'].some(k => !Number.isFinite(gates[k]) || gates[k] < 0 || gates[k] > 1)) throw new Error('invalid-task-threshold');
  return { kind: json.kind, heads, gates: { ...gates }, metadata: json.featureModel };
}

export function denseScores(head, vector) {
  const z = [...head.bias];
  for (let d = 0; d < 128; d++) for (let c = 0; c < z.length; c++) z[c] += vector[d] * head.weights[d * z.length + c];
  const maximum = Math.max(...z), p = z.map(v => Math.exp(v - maximum));
  const total = p.reduce((a, b) => a + b, 0);
  return p.map((v, i) => ({ label: head.labels[i], score: v / total })).sort((a, b) => b.score - a.score);
}

export function predictDense(model, encoder, text) {
  const started = performance.now();
  const held = reason => ({ shape: 'hold', ...defaults, score: 0, margin: 0, coverage: 0, candidates: [], reason, modelMs: performance.now() - started });
  if (typeof text !== 'string' || [...text].length > 512) return held('input_limit');
  const feature = encoder.encode(text);
  if (!feature.vector || feature.vector.length !== 128 || feature.vector.some(v => !Number.isFinite(v))) return held(feature.hold ?? 'invalid_vector');
  const shape = denseScores(model.heads.shape, feature.vector);
  const margin = shape[0].score - shape[1].score;
  const accepted = shape[0].score >= model.gates.score && margin >= model.gates.margin;
  const attrs = Object.fromEntries(Object.keys(defaults).map(key => [key, denseScores(model.heads[key], feature.vector)[0].label]));
  return { shape: accepted ? shape[0].label : 'hold', ...attrs, score: shape[0].score, margin,
    coverage: 1 - (feature.unknownFraction ?? 0), candidates: shape.slice(0, 3),
    reason: accepted ? 'learned_static_head' : 'low_confidence', modelMs: performance.now() - started };
}
