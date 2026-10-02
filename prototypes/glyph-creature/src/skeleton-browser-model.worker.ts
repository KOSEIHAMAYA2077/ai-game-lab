import { PreTrainedTokenizer } from '@huggingface/transformers';
import * as ort from 'onnxruntime-web/wasm';
import ortWasm from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import ortWasmModule from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';
import config from './data/skeleton-language.json';
import { validateSkeletonSpec, type SkeletonSpec } from './skeleton-surface';
import type { BrowserModelInfo, ModelProgress } from './skeleton-browser-client';

type Vector = Float32Array;
type Candidate = { family: SkeletonSpec['family']; score: number };
type Evidence = Record<string, string | number>;
type Result = { spec: SkeletonSpec | null; source: 'semantic-model' | 'unchanged'; modelMs: number; reason: string; confidence: number; candidates: Candidate[]; evidence: Evidence[] };
type FileEntry = { file: string; url: string; bytes: number; sha256: string };
type Scope = { postMessage: (message: unknown) => void; onmessage: ((event: MessageEvent) => void) | null };
const scope = self as unknown as Scope;
const families = Object.keys(config.captions) as SkeletonSpec['family'][];
let tokenizer: PreTrainedTokenizer;
let session: ort.InferenceSession;
let familyRows: { family: SkeletonSpec['family']; vector: Vector }[] = [];
let descriptorRows: { key: keyof Omit<SkeletonSpec, 'family'>; value: number; vector: Vector }[] = [];
let background: Vector[] = [];
let loading: Promise<BrowserModelInfo> | null = null;
let progressId = 0;
let downloadedBytes = 0;
let usedCache = false;

function progress(value: ModelProgress) { scope.postMessage({ id: progressId, kind: 'progress', progress: value }); }
function rounded(value: number) { return Math.round(value * 100000) / 100000; }
function dot(a: Vector, b: Vector) { let sum = 0; for (let i = 0; i < a.length; i++) sum += a[i] * b[i]; return sum; }
function normalize(text: string) { return text.normalize('NFKC').trim().toLowerCase(); }
function escape(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function aliasPattern(alias: string) {
  if (/^[a-z ]+$/.test(alias)) return `(?<![a-z])${escape(alias)}(?![a-z])`;
  if (alias.length === 1) return `(?<![\u3400-\u9fff])${escape(alias)}(?![\u3400-\u9fff])`;
  return escape(alias);
}

function cleanNegation(input: string): { text: string; rejected: boolean } {
  let text = input;
  let rejected = false;
  const suffix = '\\s*(?:ではなく|ではない|じゃない|以外|でなく|を除く|は不要|は作らない|を作らない|にしない)';
  for (const aliases of Object.values(config.aliases)) {
    for (const alias of [...aliases].sort((a, b) => b.length - a.length)) {
      for (const expression of [aliasPattern(alias) + suffix, '\\b(?:not|without|no)\\s+(?:a\\s+)?' + aliasPattern(alias)]) {
        const regex = new RegExp(expression, 'g');
        if (regex.test(text)) {
          rejected = true;
          text = text.replace(new RegExp(expression, 'g'), ' ');
        }
      }
    }
  }
  return { text: text.trim(), rejected };
}

async function verifiedData(entry: FileEntry): Promise<ArrayBuffer> {
  // Only fixed original-publisher assets are fetched. Input text never forms a URL.
  if (!entry.url.startsWith(`https://huggingface.co/${config.model}/resolve/${config.revision}/`)) throw new Error('モデルの取得元を確認できませんでした。');
  const cache = 'caches' in self ? await caches.open(`glyph-model-${config.revision}`) : null;
  const existing = cache ? await cache.match(entry.url) : null;
  let buffer: ArrayBuffer;
  if (existing) {
    buffer = await existing.arrayBuffer();
    usedCache = true;
  } else {
    progress({ stage: 'download', file: entry.file, loaded: 0, total: entry.bytes });
    const response = await fetch(entry.url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error('無料モデルを取得できませんでした。通信を確認してください。');
    if (response.body) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        progress({ stage: 'download', file: entry.file, loaded: received, total: entry.bytes });
      }
      const joined = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
      buffer = joined.buffer;
    } else buffer = await response.arrayBuffer();
    downloadedBytes += buffer.byteLength;
  }
  progress({ stage: 'verify', file: entry.file });
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), byte => byte.toString(16).padStart(2, '0')).join('');
  if (buffer.byteLength !== entry.bytes || hash !== entry.sha256) throw new Error('モデルの検査に失敗しました。既存のデータは保ちます。');
  if (cache && !existing) await cache.put(entry.url, new Response(buffer, { headers: { 'Content-Type': entry.file.endsWith('.json') ? 'application/json' : 'application/octet-stream' } }));
  return buffer;
}

async function encode(texts: string[]): Promise<Vector[]> {
  // Transformers.js 3 does not implement left truncation. Keep the initial
  // special token plus the final content/end token, matching Python tokenizers.
  const rows = texts.map(text => {
    const result = tokenizer(text, { return_tensor: false, truncation: false, padding: false });
    const ids = result.input_ids as unknown as number[];
    return ids.length > 128 ? [ids[0], ...ids.slice(-127)] : ids;
  });
  const maxLength = Math.max(...rows.map(row => row.length));
  const ids = new BigInt64Array(texts.length * maxLength).fill(BigInt(tokenizer.pad_token_id));
  const mask = new BigInt64Array(texts.length * maxLength);
  for (let row = 0; row < rows.length; row++) for (let token = 0; token < rows[row].length; token++) {
    ids[row * maxLength + token] = BigInt(rows[row][token]);
    mask[row * maxLength + token] = 1n;
  }
  const dims = [texts.length, maxLength];
  const feed: Record<string, ort.Tensor> = {};
  for (const name of session.inputNames) {
    if (name === 'input_ids') feed[name] = new ort.Tensor('int64', ids, dims);
    else if (name === 'attention_mask') feed[name] = new ort.Tensor('int64', mask, dims);
    else if (name === 'token_type_ids') feed[name] = new ort.Tensor('int64', new BigInt64Array(ids.length), dims);
  }
  const output = await session.run(feed);
  const hidden = output[session.outputNames[0]];
  const data = hidden.data as Float32Array;
  const [batch, length, dimension] = hidden.dims;
  const masks = mask;
  const vectors: Vector[] = [];
  for (let row = 0; row < batch; row++) {
    const vector = new Float32Array(dimension);
    let count = 0;
    for (let token = 0; token < length; token++) {
      if (masks[row * length + token] === 0n) continue;
      count++;
      const offset = (row * length + token) * dimension;
      for (let component = 0; component < dimension; component++) vector[component] += data[offset + component];
    }
    let norm = 0;
    for (let component = 0; component < dimension; component++) { vector[component] /= Math.max(1, count); norm += vector[component] ** 2; }
    norm = Math.sqrt(norm) || 1;
    for (let component = 0; component < dimension; component++) vector[component] /= norm;
    vectors.push(vector);
  }
  return vectors;
}

async function batchEncode(texts: string[]): Promise<Vector[]> {
  const rows: Vector[] = [];
  for (let i = 0; i < texts.length; i += 8) rows.push(...await encode(texts.slice(i, i + 8)));
  return rows;
}

function load(): Promise<BrowserModelInfo> {
  if (loading) return loading;
  loading = (async (): Promise<BrowserModelInfo> => {
    const started = performance.now();
    const files = config.files as FileEntry[];
    const [tokenizerBytes, tokenizerConfigBytes] = await Promise.all(['tokenizer.json', 'tokenizer_config.json'].map(name => verifiedData(files.find(file => file.file === name)!)));
    tokenizer = new PreTrainedTokenizer(JSON.parse(new TextDecoder().decode(tokenizerBytes)), JSON.parse(new TextDecoder().decode(tokenizerConfigBytes)));
    const weights = await verifiedData(files.find(file => file.file === 'onnx/model_qint8_arm64.onnx')!);
    progress({ stage: 'initialize' });
    // CPU SIMD WASM works without GPU support or cross-origin-isolated hosting.
    ort.env.wasm.numThreads = 1;
    ort.env.logLevel = 'error';
    ort.env.wasm.wasmPaths = { wasm: new URL(ortWasm, self.location.href).href, mjs: new URL(ortWasmModule, self.location.href).href };
    session = await ort.InferenceSession.create(weights, { executionProviders: ['wasm'] });
    const captions: string[] = [];
    const captionFamilies: SkeletonSpec['family'][] = [];
    for (const family of families) {
      for (const description of [...config.captions[family], ...config.aliases[family]]) {
        captions.push(description);
        captionFamilies.push(family);
      }
    }
    familyRows = (await batchEncode(captions)).map((vector, i) => ({ family: captionFamilies[i], vector }));
    const descriptorCaptions: string[] = [];
    const descriptorSpecs: { key: keyof Omit<SkeletonSpec, 'family'>; value: number }[] = [];
    for (const [key, values] of Object.entries(config.descriptors)) {
      for (const [value, description] of values) {
        descriptorCaptions.push(description as string);
        descriptorSpecs.push({ key: key as keyof Omit<SkeletonSpec, 'family'>, value: value as number });
      }
    }
    descriptorRows = (await batchEncode(descriptorCaptions)).map((vector, i) => ({ ...descriptorSpecs[i], vector }));
    background = await batchEncode(config.background);
    progress({ stage: 'ready' });
    return { model: config.model, revision: config.revision, provider: 'wasm', modelLoadMs: performance.now() - started, downloadedBytes, cacheUsed: usedCache, maxTokens: 128 };
  })().catch(error => { loading = null; throw error; });
  return loading;
}

function candidateFamilies(vector: Vector): Candidate[] {
  const scores = new Map<SkeletonSpec['family'], number>();
  for (const row of familyRows) scores.set(row.family, Math.max(scores.get(row.family) ?? -1, dot(row.vector, vector)));
  return Array.from(scores, ([family, score]) => ({ family, score: rounded(score) })).sort((a, b) => b.score - a.score);
}

function descriptors(vector: Vector): Map<keyof Omit<SkeletonSpec, 'family'>, { value: number; score: number }> {
  const groups = new Map<keyof Omit<SkeletonSpec, 'family'>, Map<number, number>>();
  let globalBest = -1;
  for (const row of descriptorRows) {
    const score = dot(row.vector, vector);
    globalBest = Math.max(globalBest, score);
    const group = groups.get(row.key) ?? new Map();
    group.set(row.value, Math.max(group.get(row.value) ?? -1, score));
    groups.set(row.key, group);
  }
  const result = new Map<keyof Omit<SkeletonSpec, 'family'>, { value: number; score: number }>();
  for (const [key, group] of groups) {
    const pairs = Array.from(group, ([value, score]) => ({ value, score })).sort((a, b) => b.score - a.score);
    if (pairs[0].score > .68 && pairs[0].score - pairs[1].score > .15 && pairs[0].score >= globalBest - .035) result.set(key, { value: pairs[0].value, score: rounded(pairs[0].score) });
  }
  return result;
}

async function interpret(text: unknown, previous: unknown): Promise<Result> {
  if (typeof text !== 'string' || text.length > config.maxText) throw new Error(`最大${config.maxText}文字で入力してください。`);
  await load();
  const started = performance.now();
  const cleaned = cleanNegation(normalize(text));
  const empty = (reason: string, candidates: Candidate[] = []): Result => ({ spec: null, source: 'unchanged', modelMs: performance.now() - started, reason, confidence: candidates[0]?.score ?? 0, candidates: candidates.slice(0, 3), evidence: [] });
  if (!cleaned.text || !/[\w\u3040-\u9fff]/u.test(cleaned.text)) return empty(cleaned.rejected ? 'negated' : 'empty');
  const input = cleaned.text;
  const choices = new Map<keyof Omit<SkeletonSpec, 'family'>, { start: number; end: number; value: number }>();
  for (const [expression, changes] of config.anchors) {
    for (const match of input.matchAll(new RegExp(expression as string, 'gi'))) {
      for (const [key, rawValue] of Object.entries(changes)) {
        const typedKey = key as keyof Omit<SkeletonSpec, 'family'>;
        const existing = choices.get(typedKey);
        const start = match.index!;
        const end = start + match[0].length;
        if (!existing || start >= existing.start || (start <= existing.start && end > existing.end)) choices.set(typedKey, { start, end, value: rawValue as number });
      }
    }
  }
  let spans: { start: number; end: number }[] = [];
  for (const aliases of Object.values(config.aliases)) for (const alias of aliases) {
    for (const match of input.matchAll(new RegExp(aliasPattern(alias), 'g'))) spans.push({ start: match.index!, end: match.index! + match[0].length });
  }
  spans = spans.filter(span => !spans.some(other => other.start <= span.start && other.end >= span.end && other.end - other.start > span.end - span.start));
  let residual = input;
  let familyText = input;
  for (const [expression] of config.anchors) {
    residual = residual.replace(new RegExp(expression as string, 'gi'), ' ');
    familyText = familyText.replace(new RegExp(expression as string, 'gi'), ' ');
  }
  residual = residual.replace(/もっと|少し|ちょっと|この|これ|それ|形|感じ|にして|して|する|ください|くれ|欲しい|ほしい|だけ|に|を|で|と|の|な|please|make|it|more|slightly|[\s。、,.!！?？]/g, '');
  familyText = familyText.replace(/もっと|少し|ちょっと|にして|ください|して|くれ|please|make/g, ' ');
  let modifierOnly = choices.size > 0 && spans.length === 0 && residual === '';
  const evidence: Evidence[] = [];
  if (spans.length) {
    const selectedSpan = [...spans].sort((a, b) => b.start - a.start)[0];
    familyText = input.slice(selectedSpan.start, selectedSpan.end);
    evidence.push({ kind: 'noun-focus-rule' });
  }
  let attributeText = input;
  for (const span of [...new Map(spans.map(span => [`${span.start}:${span.end}`, span])).values()].sort((a, b) => b.start - a.start)) attributeText = attributeText.slice(0, span.start) + ' ' + attributeText.slice(span.end);
  const texts = [input];
  const familyIndex = familyText.trim() && familyText.trim() !== input ? texts.push(familyText) - 1 : 0;
  const attributeIndex = attributeText.trim() && attributeText.trim() !== input ? texts.push(attributeText) - 1 : 0;
  // Batch encode related queries to avoid repeat tokenization/session overhead.
  const vectors = await encode(texts);
  const candidates = candidateFamilies(vectors[familyIndex]);
  const [top, runner] = candidates;
  const backgroundScore = Math.max(...background.map(vector => dot(vector, vectors[0])));
  let selected = top.score >= config.minScore && top.score - runner.score >= config.minMargin && (spans.length > 0 || top.score > backgroundScore + .04);
  const attributes = attributeText.trim() ? descriptors(vectors[attributeIndex]) : new Map<keyof Omit<SkeletonSpec, 'family'>, { value: number; score: number }>();
  if (!spans.length && attributes.size && Math.max(...Array.from(attributes.values(), value => value.score)) > .92) { modifierOnly = true; selected = false; }
  const old = validateSkeletonSpec(previous);
  let spec: SkeletonSpec;
  if (modifierOnly && old) {
    spec = { ...old };
    evidence.push({ kind: 'context', family: old.family });
  } else if (selected) {
    spec = { ...config.default, family: top.family } as SkeletonSpec;
    evidence.push({ kind: 'embedding-family', family: top.family, score: top.score });
  } else return empty('ambiguous', candidates);
  for (const [key, attribute] of attributes) if (!choices.has(key)) {
    spec[key] = attribute.value;
    evidence.push({ kind: 'embedding-descriptor', attribute: key, score: attribute.score });
  }
  for (const [key, choice] of choices) {
    spec[key] = choice.value;
    evidence.push({ kind: 'explicit-attribute-rule', attribute: key });
  }
  return { spec: validateSkeletonSpec(spec), source: 'semantic-model', modelMs: performance.now() - started, confidence: top.score, candidates: candidates.slice(0, 3), evidence, reason: modifierOnly && old ? 'context-edit' : 'selected' };
}

let queue = Promise.resolve();
scope.onmessage = (event: MessageEvent) => {
  const message = event.data;
  queue = queue.then(async () => {
    try {
      progressId = message.id;
      const result = message.kind === 'load' ? await load() : await interpret(message.text, message.previous);
      scope.postMessage({ id: message.id, kind: 'result', result });
    } catch {
      // No input body, tokenizer error, or inferred text is logged/echoed.
      scope.postMessage({ id: message.id, kind: 'error', error: '端末内モデルを読み込めませんでした。通信・メモリ・ブラウザを確認してください。' });
    }
  });
};
