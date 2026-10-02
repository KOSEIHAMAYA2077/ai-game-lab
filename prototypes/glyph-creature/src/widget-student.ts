import frozen from '../../../experiments/widget-student-v1/student-model.json';
import { validateProgram, type Part, type Primitive, type Program } from './scaffold-program';

export type StudentCandidate = { label: string; score: number; margin?: number; coverage?: number };
export type StudentResolution = {
  program: Program | null; source: 'tiny-student'; modelMs: number; reason: string;
  evidence: { kind: string; detail?: string; score?: number }[];
  primitiveCandidates: StudentCandidate[][]; relationCandidates: StudentCandidate[];
};
type Head = { labels: string[]; bias: number[]; scale: number; weights: Int16Array; known: Uint8Array };
const MODEL = frozen;
const DIM = MODEL.dimensions;
const heads = new Map<string, Head>();
const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
function decoded(value: string): Uint8Array {
  const binary = atob(value), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function head(name: 'primitive' | 'relation'): Head {
  const cached = heads.get(name);
  if (cached) return cached;
  const raw = MODEL.heads[name], bytes = decoded(raw.weights), view = new DataView(bytes.buffer);
  const weights = new Int16Array(bytes.length / 2);
  for (let i = 0; i < weights.length; i++) weights[i] = view.getInt16(i * 2, true);
  const result = { labels: raw.labels, bias: raw.bias, scale: raw.scale, weights, known: decoded(raw.known) };
  heads.set(name, result);
  return result;
}
function featureIds(raw: string): number[] {
  const chars = Array.from('^' + normalize(raw) + '$'), pieces = new Set<string>();
  for (let n = MODEL.ngramMin; n <= MODEL.ngramMax; n++) {
    for (let i = 0; i + n <= chars.length; i++) pieces.add(chars.slice(i, i + n).join(''));
  }
  for (const word of normalize(raw).match(/[a-z]+/gu) ?? []) pieces.add('w:' + word);
  const ids = new Set<number>();
  for (const piece of pieces) {
    let hash = 2166136261;
    for (const char of piece) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619) >>> 0;
    ids.add(hash % DIM);
  }
  return [...ids].sort((a, b) => a - b);
}
/** A sparse char-ngram linear classifier, not a transformer or mesh generator. */
export function widgetStudentScores(raw: string, name: 'primitive' | 'relation'): StudentCandidate[] {
  const model = head(name), ids = featureIds(raw), factor = 1 / Math.sqrt(Math.max(1, ids.length));
  const logits = model.bias.slice();
  let seen = 0;
  for (const id of ids) {
    if (model.known[id >>> 3] & (1 << (id & 7))) seen++;
    for (let label = 0; label < logits.length; label++) logits[label] += model.weights[id * logits.length + label] * model.scale * factor;
  }
  const maximum = Math.max(...logits), exponents = logits.map(x => Math.exp(x - maximum));
  const sum = exponents.reduce((a, b) => a + b, 0);
  return model.labels.map((label, i) => ({ label, score: exponents[i] / sum, coverage: seen / Math.max(1, ids.length) })).sort((a, b) => b.score - a.score);
}

// These phrases find noun boundaries for scope and parent/child order. They
// do not supply the learned relation label. Single-part descriptions without
// a noun anchor are sent to the primitive head as a complete phrase.
const aliases = ['メビウスの輪','メビウス','輪っか','円環','ドーナツ','花瓶','花入れ','一輪挿し','壺','つぼ','丸い玉','球体','球面','球状','球形','ボール','玉','球','四角い箱','立方体','直方体','四角い','四角','六面体','箱','円柱の棒','パイプ','円柱','円筒','棒','管','筒','刃物','ソード','剣','刀','刃','輪','sphere','ball','orb','box','cube','cuboid','block','tube','rod','pipe','cylinder','stick','sword','blade','saber','ring','torus','loop','donut','hoop','vase','urn'];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const aliasPattern = (s: string) => /^[a-z]+$/u.test(s) ? `(?<![a-z])${escape(s)}(?![a-z])` : s.length === 1 ? `(?<![\u3400-\u9fff])${escape(s)}(?![\u3400-\u9fff])` : escape(s);
type Span = { start: number; end: number; text: string };
function nounSpans(text: string): Span[] {
  const spans = aliases.flatMap(alias => [...text.matchAll(new RegExp(aliasPattern(alias), 'gu'))].map(match => ({ start: match.index!, end: match.index! + match[0].length, text: match[0] })));
  const chosen: Span[] = [];
  for (const span of spans.sort((a, b) => a.start - b.start || b.end - a.end)) {
    if (!chosen.some(other => span.start < other.end && span.end > other.start)) chosen.push(span);
  }
  return chosen;
}
function withoutColor(text: string): string {
  return text.replace(/赤(?:色)?(?:い|の)?|白(?:色)?(?:い|の)?|黒(?:色)?(?:い|の)?|黄(?:色)?(?:い|の)?|青(?:色)?(?:い|の)?|緑(?:色)?(?:い|の)?|紫(?:色)?(?:い|の)?|ピンク|橙(?:色)?(?:い|の)?|\b(?:red|white|black|yellow|blue|green|purple|pink|orange)\b/gu, '').replace(/\s+/gu, ' ').trim();
}
function relationText(text: string, spans: Span[]): string {
  const replacement = /^[\x00-\x7f]*$/u.test(text) ? 'object' : '物体';
  for (const span of [...spans].reverse()) text = text.slice(0, span.start) + replacement + text.slice(span.end);
  text = withoutColor(text);
  for (const pattern of attributePatterns) text = text.replace(pattern, '');
  text = text.replace(/\b(?:a|an|the)\s+object\b/gu, 'object').replace(/\s+/gu, ' ').trim();
  return /[\u3040-\u9fff]/u.test(text) ? text.replace(/\s+/gu, '') : text;
}
const attributePatterns = [
  /大き(?:い|な|く)|巨大|小さ(?:い|な|く)|小型|長(?:い|く)|高(?:い|く)|短(?:い|く)|平た(?:い|く)|細(?:い|く|身)|幅(?:が|の)?(?:狭|広)(?:い|く)?|ほっそり|太(?:い|く)|曲(?:がった|がる|げた|げて|げる)|湾曲|ねじ(?:れた|れる|れて|る|って|った)|ひね(?:った|る|って)/gu,
  /\b(?:large|big|huge|small|tiny|long|tall|elongated|short|squat|flat|thin|slim|slender|narrow|wide|broad|thick|fat|curved|bent|bend|twisted|twisting|spiral)\b/gu,
];
const defaultPart = (primitive: Primitive, id: string): Part => ({ id, primitive,
  height: primitive === 'tube' || primitive === 'blade' ? 1.4 : 1,
  width: primitive === 'tube' ? .4 : primitive === 'blade' ? .5 : 1,
  depth: primitive === 'tube' || primitive === 'blade' ? .4 : 1, bend: 0, twist: 0 });
function attributes(primitive: Primitive, id: string, phrase: string): Part {
  const part = defaultPart(primitive, id);
  // Explicit scoped attribute rules are intentionally not reported as learned.
  const anchors: [RegExp, Partial<Part>][] = [
    [/大き(?:い|な|く)|巨大|\b(?:large|big|huge)\b/gu, { height: 1.55, width: 1.55, depth: 1.55 }],
    [/小さ(?:い|な|く)|小型|\b(?:small|tiny)\b/gu, { height: .65, width: .65, depth: .65 }],
    [/長(?:い|く)|高(?:い|く)|\b(?:long|tall|elongated)\b/gu, { height: 1.65 }],
    [/短(?:い|く)|平た(?:い|く)|\b(?:short|squat|flat)\b/gu, { height: .65 }],
    [/細(?:い|く|身)|幅(?:が|の)?狭|ほっそり|\b(?:thin|slim|slender|narrow)\b/gu, { width: .4, depth: .4 }],
    [/太(?:い|く)|幅(?:が|の)?広|\b(?:wide|broad|thick|fat)\b/gu, { width: 1.55, depth: 1.55 }],
    [/曲(?:がった|がる|げた|げて|げる)|湾曲|\b(?:curved|bent|bend)\b/gu, { bend: .65 }],
    [/ねじ(?:れた|れる|れて|る|って|った)|ひね(?:った|る|って)|\b(?:twisted|twisting|spiral)\b/gu, { twist: .65 }],
  ];
  const selected = new Map<keyof Part, { at: number; value: number }>();
  for (const [pattern, changes] of anchors) for (const match of phrase.matchAll(pattern)) {
    for (const [key, value] of Object.entries(changes)) {
      const previous = selected.get(key as keyof Part);
      if (!previous || match.index! >= previous.at) selected.set(key as keyof Part, { at: match.index!, value: value as number });
    }
  }
  for (const [key, { value }] of selected) (part as unknown as Record<string, unknown>)[key] = value;
  return part;
}
export function inspectWidgetStudent() {
  return { format: MODEL.format, dimensions: DIM, headCount: heads.size, decodedWeightBytes: [...heads.values()].reduce((n, h) => n + h.weights.byteLength + h.known.byteLength, 0), maxInputCodeUnits: 4000, transformer: false, externalRequests: false, thresholds: { ...MODEL.thresholds } };
}

/** Returns a validated <=2-part Program, or holds the existing body. Ink is
 * interpreted by the renderer; this interpreter removes it before structure. */
export function widgetStudentResolution(raw: string): StudentResolution {
  const start = performance.now(), evidence: StudentResolution['evidence'] = [];
  const primitiveCandidates: StudentCandidate[][] = [], relationCandidates: StudentCandidate[] = [];
  const result = (program: Program | null, reason: string): StudentResolution => ({ program, reason, source: 'tiny-student', modelMs: performance.now() - start, evidence, primitiveCandidates, relationCandidates });
  if (typeof raw !== 'string' || raw.length > 4000) return result(null, 'input-budget');
  const text = normalize(raw);
  if (!text || !/[\w\u3040-\u9fff]/u.test(text)) return result(null, 'empty');
  // Conservative whole-input negation is a guard, not learned understanding.
  if (/ではな|ではなく|じゃな|でなく|以外|不要|要らない|いらない|作らな|置かな|乗せな|載せな|付けな|つけな|繋がな|つながな|貫かな|通さな|しない|ないで|なし|ません|ありません|作らず|置かず|付けず|貫かず|通さず|使わず|避け|やめ|除い|してはいけ|\b(?:not|without|never|no|don't|cannot|can't)\b/iu.test(text)) {
    evidence.push({ kind: 'explicit-negation-guard' }); return result(null, 'negation-held');
  }
  if (/(?:[3-9]|三|四|五|六|七|八|九)\s*(?:個|つ|本|部位|parts)/u.test(text)) return result(null, 'part-budget');
  const spans = nounSpans(text);
  if (spans.length > 2) return result(null, 'part-budget');
  const targets = spans.length ? spans.map(span => span.text) : [withoutColor(text)];
  const primitives: Primitive[] = [];
  for (const target of targets) {
    const candidates = widgetStudentScores(target, 'primitive'); primitiveCandidates.push(candidates);
    const [top, second] = candidates;
    evidence.push({ kind: 'learned-char-primitive', detail: top.label, score: top.score });
    if (top.label === 'unknown' || top.score < MODEL.thresholds.primitiveScore || top.score - second.score < MODEL.thresholds.primitiveMargin || (top.coverage ?? 0) < MODEL.thresholds.primitiveCoverage) return result(null, 'primitive-uncertain');
    primitives.push(top.label as Primitive);
  }
  if (primitives.length === 1) {
    const program = validateProgram({ version: 1, parts: [attributes(primitives[0], '0', withoutColor(text))] });
    evidence.push({ kind: 'explicit-attribute-scope' });
    return result(program, program ? 'selected' : 'invalid-program');
  }
  const query = relationText(text, spans), candidates = widgetStudentScores(query, 'relation'); relationCandidates.push(...candidates);
  const [top, second] = candidates;
  evidence.push({ kind: 'explicit-noun-and-color-mask' }, { kind: 'learned-char-relation', detail: top.label, score: top.score });
  if (top.label === 'none' || top.score < MODEL.thresholds.relationScore || top.score - second.score < MODEL.thresholds.relationMargin) return result(null, 'relation-uncertain');
  const [first, secondSpan] = spans, between = text.slice(first.end, secondSpan.start), after = text.slice(secondSpan.end);
  // Order/scope are structural rules. The learned head still chooses end,
  // above, through, or none independently from these rules.
  const reverse = /\b(?:above|over|atop|through|penetrates|piercing|at\s+(?:the\s+)?(?:end|tip)\s+of|on\s+top\s+of|to\s+(?:the\s+)?(?:end|tip)\s+of)\b/u.test(between)
    || (/を/u.test(between) && /の(?:上|頭上|真上|てっぺん|頂点|先|端|末端|終端)/u.test(after))
    || /が/u.test(between);
  const firstPart = attributes(primitives[0], reverse ? '1' : '0', text.slice(0, first.end));
  const secondPart = attributes(primitives[1], reverse ? '0' : '1', text.slice(first.end));
  const parts = reverse ? [secondPart, firstPart] : [firstPart, secondPart];
  const program = validateProgram({ version: 1, parts, relation: { kind: top.label, parent: '0', child: '1' } });
  evidence.push({ kind: 'explicit-part-order-and-attribute-scope', detail: reverse ? 'reverse' : 'forward' });
  return result(program, program ? 'selected' : 'invalid-program');
}
