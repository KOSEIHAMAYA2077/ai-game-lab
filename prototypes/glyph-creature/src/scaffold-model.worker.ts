import { PreTrainedTokenizer } from '@huggingface/transformers';
import * as ort from 'onnxruntime-web/wasm';
import ortWasm from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import ortWasmModule from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';
import config from './data/scaffold-language.json';
import { validateProgram, type Program, type Part, type Primitive } from './scaffold-program';
import type { ProgramModelInfo, ModelProgress } from './scaffold-model-client';

type Vector = Float32Array;
type Candidate = { primitive: Primitive; score: number };
type Evidence = Record<string, string | number>;
type Result = { program: Program | null; source: 'semantic-model' | 'unchanged'; modelMs: number; reason: string; evidence: Evidence[]; relationCandidates?: {kind: string; score: number}[] };
type FileEntry = { file: string; url: string; bytes: number; sha256: string };
type Scope = { postMessage: (message: unknown) => void; onmessage: ((event: MessageEvent) => void) | null };
const scope = self as unknown as Scope;
const families = Object.keys(config.captions) as Primitive[];
let tokenizer: PreTrainedTokenizer;
let session: ort.InferenceSession;
let familyRows: { family: Primitive; vector: Vector }[] = [];
let descriptorRows: { key: keyof Omit<Part, 'id' | 'primitive'>; value: number; vector: Vector }[] = [];
let background: Vector[] = [];
let loading: Promise<ProgramModelInfo> | null = null;
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
  const suffix = '\\s*(?:ではなく|ではない|じゃなく|じゃない|以外|でなく|を除く|は不要|は要らない|はいらない|は作らない|を作らない|にしない)';
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

function load(): Promise<ProgramModelInfo> {
  if (loading) return loading;
  loading = (async (): Promise<ProgramModelInfo> => {
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
    const captionFamilies: Primitive[] = [];
    for (const family of families) {
      for (const description of [...config.captions[family], ...config.aliases[family]]) {
        captions.push(description);
        captionFamilies.push(family);
      }
    }
    familyRows = (await batchEncode(captions)).map((vector, i) => ({ family: captionFamilies[i], vector }));
    const descriptorCaptions: string[] = [];
    const descriptorSpecs: { key: keyof Omit<Part, 'id' | 'primitive'>; value: number }[] = [];
    for (const [key, values] of Object.entries(config.descriptors)) {
      for (const [value, description] of values) {
        descriptorCaptions.push(description as string);
        descriptorSpecs.push({ key: key as keyof Omit<Part, 'id' | 'primitive'>, value: value as number });
      }
    }
    descriptorRows = (await batchEncode(descriptorCaptions)).map((vector, i) => ({ ...descriptorSpecs[i], vector }));
    background = await batchEncode(config.background);
    progress({ stage: 'ready' });
    return { model: config.model, revision: config.revision, provider: 'wasm', modelLoadMs: performance.now() - started, downloadedBytes, cacheUsed: usedCache, maxTokens: 128 };
  })().catch(error => { loading = null; throw error; });
  return loading;
}

type Attribute = keyof Omit<Part, 'id' | 'primitive'>;
type Span = { start: number; end: number; primitive: Primitive };

function nounSpans(text: string): Span[] {
  const spans: Span[] = [];
  for (const [primitive, aliases] of Object.entries(config.aliases)) {
    for (const alias of aliases) for (const match of text.matchAll(new RegExp(aliasPattern(alias), 'g'))) spans.push({ start: match.index!, end: match.index! + match[0].length, primitive: primitive as Primitive });
  }
  return spans.filter(span => !spans.some(other => other.start <= span.start && other.end >= span.end && other.end-other.start > span.end-span.start));
}

function primitiveCandidates(vector: Vector): Candidate[] {
  const scores = new Map<Primitive, number>();
  for (const row of familyRows) scores.set(row.family, Math.max(scores.get(row.family) ?? -1, dot(row.vector, vector)));
  return Array.from(scores, ([primitive, score]) => ({ primitive, score: rounded(score) })).sort((a, b) => b.score-a.score);
}

function descriptors(vector: Vector): Map<Attribute, number> {
  const groups = new Map<Attribute, Map<number, number>>();
  let globalBest = -1;
  for (const row of descriptorRows) {
    const score = dot(row.vector, vector);
    globalBest = Math.max(globalBest, score);
    const group = groups.get(row.key) ?? new Map();
    group.set(row.value, Math.max(group.get(row.value) ?? -1, score));
    groups.set(row.key, group);
  }
  const result = new Map<Attribute, number>();
  for (const [key, group] of groups) {
    const pairs = Array.from(group, ([value, score]) => ({ value, score })).sort((a, b) => b.score-a.score);
    if (pairs[0].score > .68 && pairs[0].score-pairs[1].score > .15 && pairs[0].score >= globalBest-.035) result.set(key, pairs[0].value);
  }
  return result;
}

function extractPhrases(text: string): { phrases: string[]; pattern: string | null } {
  for (const pattern of config.patterns) {
    const match = new RegExp(pattern.regex, 'i').exec(text);
    if (!match) continue;
    const first = match[1].trim(), second = match[2].trim();
    return { phrases: pattern.reverse ? [second, first] : [first, second], pattern: pattern.name };
  }
  return { phrases: [text], pattern: null };
}

function relationScope(text: string): string {
  for (const pattern of config.patterns) {
    const match = new RegExp(pattern.regex, 'i').exec(text);
    if (!match) continue;
    const start = match.index, end = start+match[0].length;
    const stop = /[。.!?！？;；、,]/.exec(text.slice(end));
    return text.slice(start, stop ? end+stop.index : text.length);
  }
  return text;
}

function relationQuery(text: string): string {
  const placeholder = /^[\x00-\x7f]*$/.test(text) ? 'object' : '物体';
  for (const [expression] of config.anchors) text = text.replace(new RegExp(expression as string, 'gi'), ' ');
  const spans: { start: number; end: number }[] = [];
  for (const alias of new Set(Object.values(config.aliases).flat())) {
    for (const match of text.matchAll(new RegExp(aliasPattern(alias), 'gi'))) spans.push({ start: match.index!, end: match.index!+match[0].length });
  }
  const filtered = spans.filter(span => !spans.some(other => other.start <= span.start && other.end >= span.end && other.end-other.start > span.end-span.start));
  for (const span of [...new Map(filtered.map(span => [`${span.start}:${span.end}`, span])).values()].sort((a, b) => b.start-a.start)) text = text.slice(0, span.start)+placeholder+text.slice(span.end);
  return text.replace(/物体\s*(?:の\s*)?物体/g, '物体').replace(/\ba\s+object\b/g, 'object').replace(/\s+/g, ' ').trim();
}

async function relation(text: string): Promise<{ kind: string; score: number }[]> {
  const vector = (await encode([relationQuery(text)]))[0];
  const head = config.head;
  const logits = head.bias.slice();
  for (let feature = 0; feature < vector.length; feature++) {
    const scaled = (vector[feature]-head.mean[feature])/head.scale[feature];
    for (let label = 0; label < logits.length; label++) logits[label] += scaled*head.weights[feature][label];
  }
  const maximum = Math.max(...logits);
  const exponents = logits.map(value => Math.exp(value-maximum));
  const sum = exponents.reduce((a, b) => a+b, 0);
  return head.labels.map((kind, index) => ({ kind, score: Math.round(exponents[index]/sum*1e6)/1e6 })).sort((a, b) => b.score-a.score);
}

async function interpretPart(text: string, index: number): Promise<{ part: Part | null; evidence: Evidence[] }> {
  const spans = nounSpans(text);
  if (new Set(spans.map(span => span.primitive)).size > 1) return { part: null, evidence: [{ kind: 'ambiguous-part-guard', part: String(index) }] };
  const span = [...spans].sort((a, b) => b.start-a.start)[0];
  const familyText = span ? text.slice(span.start, span.end) : text;
  const vector = (await encode([familyText]))[0];
  const [top, runner] = primitiveCandidates(vector);
  const backgroundScore = Math.max(...background.map(row => dot(row, vector)));
  if (top.score < config.minScore || top.score-runner.score < config.minMargin || (!spans.length && top.score <= backgroundScore+.04)) return { part: null, evidence: [{ kind: 'primitive-uncertain', part: String(index) }] };
  const part: Part = { id: String(index), primitive: top.primitive, ...config.defaults[top.primitive] };
  const evidence: Evidence[] = [{ kind: 'embedding-primitive', part: String(index), primitive: top.primitive, score: top.score }];
  if (spans.length) evidence.push({ kind: 'noun-focus-rule', part: String(index) });
  let attributeText = text;
  for (const item of [...new Map(spans.map(span => [`${span.start}:${span.end}`, span])).values()].sort((a, b) => b.start-a.start)) attributeText = attributeText.slice(0, item.start)+' '+attributeText.slice(item.end);
  if (attributeText.trim()) {
    for (const [key, value] of descriptors((await encode([attributeText]))[0])) {
      part[key] = value;
      evidence.push({ kind: 'embedding-descriptor', part: String(index), attribute: key });
    }
  }
  const choices = new Map<Attribute, { start: number; end: number; value: number }>();
  for (const [expression, changes] of config.anchors) for (const match of text.matchAll(new RegExp(expression as string, 'gi'))) {
    for (const [key, value] of Object.entries(changes)) {
      const attribute = key as Attribute;
      const existing = choices.get(attribute);
      const start = match.index!, end = start+match[0].length;
      if (!existing || start >= existing.start || (start <= existing.start && end > existing.end)) choices.set(attribute, { start, end, value: value as number });
    }
  }
  for (const [attribute, choice] of choices) {
    part[attribute] = choice.value;
    evidence.push({ kind: 'explicit-attribute-rule', part: String(index), attribute });
  }
  return { part, evidence };
}

async function interpret(text: unknown, _previous: unknown): Promise<Result> {
  if (typeof text !== 'string' || text.length > config.maxText) throw new Error(`最大${config.maxText}文字で入力してください。`);
  await load();
  const started = performance.now();
  const cleaned = cleanNegation(normalize(text));
  const hold = (reason: string, evidence: Evidence[] = []): Result => ({ program: null, source: 'unchanged', modelMs: performance.now()-started, reason, evidence });
  if (!cleaned.text || !/[\w\u3040-\u9fff]/u.test(cleaned.text)) return hold(cleaned.rejected ? 'negated' : 'empty');
  const input = cleaned.text;
  const scoped = relationScope(input);
  if (new RegExp(config.negativeOperation, 'i').test(scoped)) return hold('negated-operation', [{ kind: 'negation-rule' }]);
  if (/(?:[3-9]|三|四|五|六|七|八|九)\s*(?:個|つ|本|部位|parts)/.test(input)) return hold('part-budget', [{ kind: 'part-count-rule' }]);
  const extracted = extractPhrases(input);
  const evidence: Evidence[] = extracted.pattern ? [{ kind: 'part-extraction-rule', pattern: extracted.pattern, parts: extracted.phrases.length }] : [];
  if (extracted.phrases.length === 2 && extracted.phrases.some(phrase => extractPhrases(phrase).pattern)) return hold('part-budget', evidence);
  const parts: Part[] = [];
  for (let index = 0; index < extracted.phrases.length; index++) {
    const result = await interpretPart(extracted.phrases[index], index);
    evidence.push(...result.evidence);
    if (!result.part) return hold('primitive-uncertain', evidence);
    parts.push(result.part);
  }
  const program: Program = { version: 1, parts };
  let relationCandidates: { kind: string; score: number }[] = [];
  if (parts.length === 2) {
    relationCandidates = await relation(scoped);
    const [top, runner] = relationCandidates;
    evidence.push({ kind: 'relation-input-mask-rule' }, { kind: 'learned-relation-head', label: top.kind, score: top.score });
    if (top.kind === 'none' || top.score < config.relationMinScore || top.score-runner.score < config.relationMinMargin) return hold('relation-uncertain', evidence);
    program.relation = { kind: top.kind as 'end' | 'above' | 'through', parent: '0', child: '1' };
  }
  const validated = validateProgram(program);
  if (!validated) return hold('invalid-program', evidence);
  return { program: validated, source: 'semantic-model', modelMs: performance.now()-started, reason: 'selected', evidence, relationCandidates };
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
      scope.postMessage({ id: message.id, kind: 'error', error: '端末内モデルを読み込めませんでした。通信・メモリ・ブラウザを確認してください。' });
    }
  });
};
