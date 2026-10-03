/**
 * Standalone CPU StaticEmbedding encoder. No ONNX, tensors, WASM, or dependencies.
 * Algorithm adapted from NativeStaticR5.swift (see NOTICE.md).
 */
export const MAX_INPUT_SCALARS = 512;
export const TABLE_ROWS = 32768;
export const EMBEDDING_DIMENSIONS = 128;
export const TABLE_BYTES = TABLE_ROWS * EMBEDDING_DIMENSIONS * 2;
export const TOKENIZER_SHA256 = '833add01c9eb44e78ffb2d9195caace320de0fcf64d1f4d95bc541b6e30a9fc9';
export const TABLE_SHA256 = '65122d239d6c9fd804deee853736446415dc815134277c87adb9978f7b9e2201';
export const STATIC_ASSET_URLS = {
  tokenizer: new URL('../../../../../experiments/bonsai-task-student-v1/static-candidate/assets/tokenizer.json', import.meta.url).href,
  table: new URL('../../../../../experiments/bonsai-task-student-v1/static-candidate/assets/table-128-float16.bin', import.meta.url).href,
};
const utf8 = new TextEncoder(), decoder = new TextDecoder();
const nmtSpaces = new Set([9, 10, 12, 13, 0x1680, 0x2028, 0x2029, 0x2581, 0xfeff, 0xfffd]);

export function normalizeNmt(source) {
  let filtered = '';
  for (const character of source) {
    const n = character.codePointAt(0);
    if ((n >= 1 && n <= 8) || n === 11 || (n >= 14 && n <= 31) || n === 127 || n === 143 || n === 159) continue;
    filtered += nmtSpaces.has(n) || (n >= 0x200b && n <= 0x200f) ? ' ' : character;
  }
  // Rust tokenizers lowers each scalar separately, rather than using contextual
  // whole-string lowercase (Greek final sigma is a visible counterexample).
  return Array.from(filtered.normalize('NFKC').normalize('NFC'), c => c.toLowerCase()).join('');
}

export function metaspace(source) {
  if (!source) return [];
  let value = source.replaceAll(' ', '▁');
  if (!value.startsWith('▁')) value = '▁' + value;
  const pieces = []; let piece = '';
  for (const character of value) {
    if (character === '▁' && piece) { pieces.push(piece); piece = ''; }
    piece += character;
  }
  if (piece) pieces.push(piece);
  return pieces;
}

const scalarBytes = byte => byte < 0x80 ? 1 : byte < 0xe0 ? 2 : byte < 0xf0 ? 3 : 4;
function isWhitespace(c) {
  const n = c.codePointAt(0);
  return (n >= 9 && n <= 13) || [0x20, 0x85, 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000].includes(n) || (n >= 0x2000 && n <= 0x200a);
}

export class StaticTokenizer {
  constructor(spec) {
    const model = spec?.model, pre = spec?.pre_tokenizer, norms = spec?.normalizer;
    if (model?.type !== 'Unigram' || model.unk_id !== 3 || model.byte_fallback || model.vocab?.length !== 32702 ||
      norms?.type !== 'Sequence' || norms.normalizers?.map(x => x.type).join(',') !== 'Nmt,NFKC,Lowercase' ||
      pre?.type !== 'Metaspace' || pre.replacement !== '▁' || pre.prepend_scheme !== 'always' || !pre.split) throw new Error('Unsupported static tokenizer schema');
    if (spec.added_tokens?.length !== 71 || !spec.added_tokens.every(x => !x.single_word && !x.rstrip && !x.normalized && x.special &&
      (x.content === '<mask>' || !x.lstrip) && Number.isInteger(x.id) && x.id >= 0 && x.id < TABLE_ROWS && typeof x.content === 'string' && x.content)) throw new Error('Unsupported added-token schema');
    this.added = spec.added_tokens.map(x => ({ ...x })).sort((a, b) => b.content.length - a.content.length);
    this.scores = new Float64Array(model.vocab.length);
    // One temporary edge lookup avoids a Map allocation for every trie node.
    // Drop it after building; the retained trie is only packed typed arrays.
    const lookup = new Map(), heads = [-1], terminals = [-1], bytes = [], targets = [], next = [];
    let minimum = Infinity;
    for (const [id, [piece, score]] of model.vocab.entries()) {
      if (typeof piece !== 'string' || !piece || !Number.isFinite(score)) throw new Error('Invalid unigram vocabulary');
      this.scores[id] = score; minimum = Math.min(minimum, score);
      let node = 0;
      for (const byte of utf8.encode(piece)) {
        const key = node * 256 + byte;
        let child = lookup.get(key);
        if (child === undefined) {
          child = heads.length; heads.push(-1); terminals.push(-1);
          const edge = bytes.length; bytes.push(byte); targets.push(child); next.push(heads[node]); heads[node] = edge;
          lookup.set(key, child);
        }
        node = child;
      }
      terminals[node] = id;
    }
    this.heads = Int32Array.from(heads); this.terminals = Int32Array.from(terminals);
    this.edgeBytes = Uint8Array.from(bytes); this.targets = Uint32Array.from(targets); this.next = Int32Array.from(next);
    this.unknownScore = minimum - 10;
  }

  child(node, byte) {
    for (let edge = this.heads[node]; edge >= 0; edge = this.next[edge]) if (this.edgeBytes[edge] === byte) return this.targets[edge];
    return -1;
  }

  exactId(piece) {
    let node = 0;
    for (const byte of utf8.encode(piece)) { node = this.child(node, byte); if (node < 0) return 3; }
    return this.terminals[node] < 0 ? 3 : this.terminals[node];
  }

  unigram(sentence) {
    const bytes = utf8.encode(sentence), size = bytes.length;
    if (!size) return { ids: [], pieces: [] };
    const bestScore = new Float64Array(size + 1), starts = new Int32Array(size + 1).fill(-1), bestId = new Int32Array(size + 1);
    for (let at = 0; at < size; at += scalarBytes(bytes[at])) {
      const width = scalarBytes(bytes[at]); let node = 0, end = at, single = false;
      while (end < size) {
        node = this.child(node, bytes[end]); if (node < 0) break;
        end++; const id = this.terminals[node];
        if (id >= 0) {
          const score = bestScore[at] + this.scores[id];
          if (starts[end] < 0 || score > bestScore[end]) { bestScore[end] = score; starts[end] = at; bestId[end] = id; }
          if (end - at === width) single = true;
        }
      }
      if (!single) {
        const to = at + width, score = bestScore[at] + this.unknownScore;
        if (starts[to] < 0 || score > bestScore[to]) { bestScore[to] = score; starts[to] = at; bestId[to] = 3; }
      }
    }
    const paths = [];
    for (let end = size; end > 0;) {
      const start = starts[end]; if (start < 0 || start >= end) throw new Error('Invalid unigram path');
      paths.push([bestId[end], start, end]); end = start;
    }
    paths.reverse();
    const ids = [], pieces = [];
    for (let i = 0; i < paths.length;) {
      const first = paths[i++]; let end = first[2];
      if (first[0] === 3) while (i < paths.length && paths[i][0] === 3) end = paths[i++][2];
      const piece = decoder.decode(bytes.subarray(first[1], end));
      pieces.push(piece); ids.push(first[0] === 3 ? this.exactId(piece) : first[0]);
    }
    return { ids, pieces };
  }

  tokenize(source) {
    if (typeof source !== 'string') return { ids: null, pieces: null, hold: 'invalid_input' };
    const chars = Array.from(source);
    if (chars.length > MAX_INPUT_SCALARS) return { ids: null, pieces: null, hold: 'input_limit' };
    if (chars.some(c => { const n = c.codePointAt(0); return n >= 0xd800 && n <= 0xdfff; })) return { ids: null, pieces: null, hold: 'invalid_unicode' };
    const normalization = normalizeNmt(source), ids = [], pieces = [];
    if (utf8.encode(normalization).length > 262144) return { ids: null, pieces: null, hold: 'normalization_byte_limit' };
    const ordinary = text => {
      for (const piece of metaspace(normalizeNmt(text))) {
        const result = this.unigram(piece); ids.push(...result.ids); pieces.push(...result.pieces);
      }
    };
    let cursor = 0, at = 0;
    while (at < source.length) {
      const match = (source[at] === '<' || source[at] === '[') ? this.added.find(token => source.startsWith(token.content, at)) : undefined;
      if (match) {
        let start = at;
        if (match.lstrip) while (start > cursor) {
          const previous = start - (source.charCodeAt(start - 1) >= 0xdc00 && source.charCodeAt(start - 1) <= 0xdfff ? 2 : 1);
          if (!isWhitespace(source.slice(previous, start))) break;
          start = previous;
        }
        ordinary(source.slice(cursor, start));
        const end = at + match.content.length;
        ids.push(match.id); pieces.push(source.slice(start, end)); cursor = at = end;
      } else at += source.codePointAt(at) > 0xffff ? 2 : 1;
    }
    ordinary(source.slice(cursor));
    return { ids, pieces, normalization, pretokenizedWholeNormalization: metaspace(normalization), hold: ids.length > 4000 ? 'token_limit' : null };
  }

  inspect() {
    return { kind: 'standalone-unigram', baseVocab: this.scores.length, addedTokens: this.added.length, trieNodes: this.heads.length,
      packedTrieBytes: this.heads.byteLength + this.terminals.byteLength + this.edgeBytes.byteLength + this.targets.byteLength + this.next.byteLength + this.scores.byteLength,
      inputScalarLimit: MAX_INPUT_SCALARS, automaticSpecialTokens: false, dependencies: [] };
  }
}

export function float16ToNumber(bits) {
  const sign = bits & 0x8000 ? -1 : 1, exponent = (bits >> 10) & 31, fraction = bits & 1023;
  return exponent === 0 ? sign * Math.pow(2, -14) * fraction / 1024 : exponent === 31 ? fraction ? NaN : sign * Infinity : sign * Math.pow(2, exponent - 15) * (1 + fraction / 1024);
}

export function createStaticEncoder(tokenizerJSON, tableBuffer) {
  const started = performance.now();
  if (!(tableBuffer instanceof ArrayBuffer) || tableBuffer.byteLength !== TABLE_BYTES) throw new Error('Invalid F16 table size');
  const tokenizer = new StaticTokenizer(tokenizerJSON), table = new DataView(tableBuffer), half = new Float32Array(65536);
  for (let i = 0; i < half.length; i++) half[i] = float16ToNumber(i);
  const initializationMs = performance.now() - started;
  function encode(text) {
    const start = performance.now(), tokenStart = start, tokens = tokenizer.tokenize(text), tokenizeMs = performance.now() - tokenStart;
    if (tokens.hold) return { tokens, unknownFraction: 0, mean: null, vector: null, hold: tokens.hold, tokenizeMs, encodeMs: performance.now() - start };
    const ids = tokens.ids, mean = new Float32Array(EMBEDDING_DIMENSIONS);
    const unknownFraction = ids.length ? ids.filter(id => id === 3).length / ids.length : 0;
    for (let blockStart = 0; blockStart < ids.length; blockStart += 64) {
      const block = new Float32Array(EMBEDDING_DIMENSIONS);
      for (let i = blockStart; i < Math.min(blockStart + 64, ids.length); i++) {
        const id = ids[i];
        if (!Number.isInteger(id) || id < 0 || id >= TABLE_ROWS) return { tokens, unknownFraction, mean: null, vector: null, hold: 'invalid_token_id', tokenizeMs, encodeMs: performance.now() - start };
        const row = id * EMBEDDING_DIMENSIONS * 2;
        for (let d = 0; d < EMBEDDING_DIMENSIONS; d++) block[d] += half[table.getUint16(row + d * 2, true)];
      }
      for (let d = 0; d < EMBEDDING_DIMENSIONS; d++) mean[d] += block[d];
    }
    if (ids.length) for (let d = 0; d < EMBEDDING_DIMENSIONS; d++) mean[d] /= ids.length;
    if (!mean.every(Number.isFinite)) return { tokens, unknownFraction, mean: null, vector: null, hold: 'nonfinite_vector', tokenizeMs, encodeMs: performance.now() - start };
    let square = 0;
    for (const x of mean) square = Math.fround(square + Math.fround(x * x));
    const norm = Math.fround(Math.sqrt(square));
    const hold = norm <= 1e-12 ? 'empty_vector' : unknownFraction > .8 ? 'unknown_tokens' : null;
    const vector = hold ? null : Float32Array.from(mean, x => x / norm);
    return { tokens, unknownFraction, mean, vector, hold, tokenizeMs, encodeMs: performance.now() - start };
  }
  return { encode, tokenize: text => tokenizer.tokenize(text), inspect: () => ({ ...tokenizer.inspect(), tableBytes: TABLE_BYTES, halfLookupBytes: half.byteLength, dimensions: EMBEDDING_DIMENSIONS, initializationMs, format: 'first128-float16-little-endian', cpuOnly: true }) };
}

async function hash(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function loadStaticEncoder({ tokenizerUrl = STATIC_ASSET_URLS.tokenizer, tableUrl = STATIC_ASSET_URLS.table, signal } = {}) {
  const began = performance.now();
  const buffers = await Promise.all([tokenizerUrl, tableUrl].map(async url => {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Static asset HTTP ${response.status}`);
    return response.arrayBuffer();
  }));
  signal?.throwIfAborted();
  const [tokenizerBuffer, tableBuffer] = buffers;
  if (tokenizerBuffer.byteLength !== 2127941 || tableBuffer.byteLength !== TABLE_BYTES) throw new Error('Static asset byte size mismatch');
  const checks = await Promise.all(buffers.map(hash));
  if (checks[0] !== TOKENIZER_SHA256 || checks[1] !== TABLE_SHA256) throw new Error('Static asset hash mismatch');
  signal?.throwIfAborted();
  const encoder = createStaticEncoder(JSON.parse(decoder.decode(tokenizerBuffer)), tableBuffer);
  encoder.assetLoadMs = performance.now() - began;
  return encoder;
}
