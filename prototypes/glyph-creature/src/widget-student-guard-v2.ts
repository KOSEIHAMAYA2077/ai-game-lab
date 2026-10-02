import { widgetStudentResolution, type StudentResolution } from './widget-student';
import { compileScaffoldProgram, validateProgram, type Part, type Primitive, type Program } from './scaffold-program';

export type WidgetStudentGuardResolution = StudentResolution & { guardVersion: 'widget-student-guard-v2'; classifierMs: number; guardMs: number };
const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
const words = ['メビウスの輪','メビウス','輪っか','円環','ドーナツ','花瓶','花入れ','一輪挿し','壺','つぼ','丸い玉','球体','球面','球状','球形','ボール','玉','球','四角い箱','立方体','直方体','四角い','四角','六面体','箱','円柱の棒','パイプ','円柱','円筒','棒','管','筒','刃物','ソード','剣','刀','刃','輪','sphere','ball','orb','box','cube','cuboid','block','tube','rod','pipe','cylinder','stick','sword','blade','saber','ring','torus','loop','donut','hoop','vase','urn'];
type Span = { start: number; end: number };
const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
function spansFor(text: string): Span[] {
  const found = words.flatMap(word => {
    const pattern = /^[a-z]+$/u.test(word) ? `(?<![a-z])${escape(word)}(?![a-z])` : word.length === 1 ? `(?<![\\u3400-\\u9fff])${escape(word)}(?![\\u3400-\\u9fff])` : escape(word);
    return [...text.matchAll(new RegExp(pattern, 'gu'))].map(match => ({ start: match.index!, end: match.index! + match[0].length }));
  }).sort((a,b) => a.start-b.start || b.end-a.end);
  const accepted: Span[] = [];
  for (const span of found) if (!accepted.some(other => span.start < other.end && span.end > other.start)) accepted.push(span);
  return accepted;
}

function globalGuard(text: string): string | null {
  if (/[「『“”"`]/u.test(text) || /'[^']+'/u.test(text) || /引用|という(?:文字|単語|語|名前)|\b(?:quoted?|literal|string|variable|function|source\s+code)\b/u.test(text)) return 'quotation-or-code-context';
  if (/取り?消|取消|キャンセル|中止|撤回|削除|消去|リセット|\b(?:cancel|cancell?ed|undo|remove|delete|erase|reset|abort)\b/u.test(text)) return 'cancel-or-removal';
  if (/(?:作る|出す|描く|表示する|生成する|置く|付ける|つける|貫く|通す|乗せる|載せる)\s*な(?:[。.!?！？\s]|$)|(?:の|が|を持た)?ない|(?:を|が)欠け|(?:を|の)抜き|(?:を)?除外|無し|禁止|不可|\b(?:forbid|forbidden|exclude|excluded|lacks?|absent|omit|prohibit)\b/u.test(text)) return 'explicit-negation-or-absence';
  return null;
}
const opposites: [string, RegExp, RegExp][] = [
  ['height', /縦長|縦(?:に)?(?:伸|長)|長(?:い|く|め)|高(?:い|く)|\b(?:long(?:er)?|tall(?:er)?|elongated)\b/u, /短(?:い|く|め)|低(?:い|く)|ずんぐり|扁平|平た|ぺちゃんこ|\b(?:short(?:er)?|squat|flat(?:ter)?)\b/u],
  ['width', /幅(?:が|の|を)?広|太(?:い|く|め)|横(?:に)?(?:長|広)|\b(?:wide(?:r)?|broad(?:er)?|thick(?:er)?|fat(?:ter)?)\b/u, /細(?:い|く|め)|幅(?:が|の|を)?狭|狭(?:い|く|め)|\b(?:narrow(?:er)?|thin(?:ner)?|slim(?:mer)?|slender)\b/u],
  ['size', /大き|巨大|\b(?:large(?:r)?|big(?:ger)?|huge)\b/u, /小さ|小型|\b(?:small(?:er)?|tiny)\b/u],
  ['bend', /曲が|曲げ|湾曲|\b(?:bent|curved|bend)\b/u, /まっすぐ|真っ直ぐ|直線|\b(?:straight|unbent)\b/u],
  ['twist', /ねじれ|ねじる|ひねる|ひねった|螺旋|らせん|\b(?:twisted|twisting|spiral)\b/u, /ねじりなし|ねじれなし|ひねりなし|\b(?:untwisted|no\s+twist)\b/u],
];
function contradictory(phrase: string): string | null {
  // "horizontal long" describes width, so it cannot alone contradict height.
  const heightPhrase = phrase.replace(/横(?:に)?(?:長(?:い|く|め)?|伸びた)|横長/gu, '');
  for (const [key, positive, negative] of opposites) {
    const scoped = key === 'height' ? heightPhrase : phrase;
    if (positive.test(scoped) && negative.test(scoped)) return key;
  }
  return null;
}
function baseDimensions(primitive: Primitive): Pick<Part, 'height' | 'width' | 'depth'> {
  return { height: primitive === 'tube' || primitive === 'blade' ? 1.4 : 1, width: primitive === 'tube' ? .4 : primitive === 'blade' ? .5 : 1, depth: primitive === 'tube' || primitive === 'blade' ? .4 : 1 };
}
function scopedAttributePatch(part: Part, phrase: string): { part: Part; rules: string[] } {
  const value = { ...part }, rules: string[] = [], defaults = baseDimensions(part.primitive);
  if (/縦長|縦(?:方向)?(?:に)?(?:伸び|伸ば|長|引き伸ば)|\b(?:vertically\s+(?:long|stretched|elongated)|taller)\b/u.test(phrase)) { value.height = 1.65; rules.push('vertical-elongation'); }
  if (/横長|横(?:方向)?(?:に)?(?:長|伸び|伸ば|広|引き伸ば)|\b(?:horizontally\s+(?:long|stretched|elongated)|wider|broader)\b/u.test(phrase)) { value.height = defaults.height; value.width = 1.65; rules.push('horizontal-elongation'); }
  if (/押し(?:つぶ|潰)|つぶれ|潰れ|扁平|ぺちゃんこ|\b(?:flattened|squashed|pancake)\b/u.test(phrase)) { value.height = .65; value.width = Math.max(value.width, 1.1); rules.push('flattened'); }
  if (/ずんぐり|どっしり|\b(?:squat|stocky)\b/u.test(phrase)) { value.height = .65; value.width = Math.max(value.width, 1.1); rules.push('squat'); }
  if (/横(?:に)?圧縮|幅(?:を)?縮め|\b(?:horizontally\s+compressed|narrower)\b/u.test(phrase)) { value.width = .4; rules.push('horizontal-compression'); }
  if (/縦(?:に)?圧縮|高さ(?:を)?縮め|\b(?:vertically\s+compressed|shorter)\b/u.test(phrase)) { value.height = .65; rules.push('vertical-compression'); }
  return { part: value, rules };
}

type Order = { parentMention: 0 | 1; expectedKind: 'end' | 'above' | 'through'; rule: string };
function explicitOrder(text: string, spans: Span[]): Order | null {
  if (spans.length !== 2) return null;
  const [first, second] = spans, between = text.slice(first.end, second.start), after = text.slice(second.end);
  if (/\b(?:at|on|to)\s+(?:the\s+)?(?:end|tip)\s+of\b/u.test(between)) return { parentMention: 1, expectedKind: 'end', rule: 'english-child-at-parent-tip' };
  if (/\b(?:above|over|atop|on\s+top\s+of)\b/u.test(between)) return { parentMention: 1, expectedKind: 'above', rule: 'english-child-above-parent' };
  if (/\b(?:through|penetrates|piercing)\b/u.test(between)) return { parentMention: 1, expectedKind: 'through', rule: 'english-child-through-parent' };
  if (/\bpierced\s+by\b/u.test(between)) return { parentMention: 0, expectedKind: 'through', rule: 'english-parent-pierced-by-child' };
  if (/\bwith\b/u.test(between) && /\b(?:at|on)\s+(?:the\s+)?(?:end|tip)\b/u.test(after)) return { parentMention: 0, expectedKind: 'end', rule: 'english-parent-with-tip-child' };
  const pos = /の(?:先端|末端|先|端|片端|終端)/u;
  const top = /の(?:上方|上|真上|てっぺん|頂点|頭上)/u;
  if (/を/u.test(between) && pos.test(after)) return { parentMention: 1, expectedKind: 'end', rule: 'japanese-child-to-parent-tip' };
  if (/を/u.test(between) && top.test(after)) return { parentMention: 1, expectedKind: 'above', rule: 'japanese-child-to-parent-top' };
  if (pos.test(between)) return { parentMention: 0, expectedKind: 'end', rule: 'japanese-parent-tip-child' };
  if (top.test(between)) return { parentMention: 0, expectedKind: 'above', rule: 'japanese-parent-top-child' };
  if (/が/u.test(between) && /を(?:貫|突き抜|通り抜)/u.test(after)) return { parentMention: 1, expectedKind: 'through', rule: 'japanese-child-subject-pierces-parent' };
  if (/を/u.test(between) && /(?:が)?(?:貫|突き抜|通り抜)/u.test(after)) return { parentMention: 0, expectedKind: 'through', rule: 'japanese-parent-object-pierced-by-child' };
  if (/を(?:貫|通る|突き抜)/u.test(between) || /の(?:中|中心|中央|穴)(?:を|に)/u.test(between) && /(?:通|貫|挿|刺)/u.test(after) || /に/u.test(between) && /を(?:通|挿|刺)/u.test(after)) return { parentMention: 0, expectedKind: 'through', rule: 'japanese-parent-passage-child' };
  return null;
}

/** Fixed freeze-1 classifier + explicit safety/scope rules. No retraining,
 * threshold adjustment, hidden model calls, or arbitrary mesh generation. */
export function widgetStudentGuardV2Resolution(raw: string): WidgetStudentGuardResolution {
  const start = performance.now();
  const empty: StudentResolution = { program: null, source: 'tiny-student', modelMs: 0, reason: 'guard-held', evidence: [], primitiveCandidates: [], relationCandidates: [] };
  let base = empty, classifierMs = 0;
  const finish = (program: Program | null, reason: string, extra: StudentResolution['evidence'] = []): WidgetStudentGuardResolution => {
    const total = performance.now()-start;
    return { ...base, program, reason, modelMs: total, evidence: [...base.evidence, ...extra], guardVersion: 'widget-student-guard-v2', classifierMs, guardMs: Math.max(0,total-classifierMs) };
  };
  if (typeof raw !== 'string' || raw.length > 4000) return finish(null,'input-budget');
  const text = normalize(raw), global = globalGuard(text);
  if (global) return finish(null,global,[{ kind: 'explicit-v2-global-guard', detail: global }]);
  const spans = spansFor(text), phrases = spans.length === 2 ? [text.slice(0, spans[0].end), text.slice(spans[0].end)] : [text];
  for (const phrase of phrases) {
    const conflict = contradictory(phrase);
    if (conflict) return finish(null,'contradictory-local-attributes',[{ kind: 'explicit-v2-local-contradiction', detail: conflict }]);
  }
  const classifyStarted = performance.now(); base = widgetStudentResolution(raw); classifierMs = performance.now()-classifyStarted;
  if (!base.program) return finish(null,base.reason);
  let program = structuredClone(base.program), extra: StudentResolution['evidence'] = [];
  if (program.parts.length === 2) {
    if (spans.length !== 2) return finish(null,'noun-scope-unresolved',[{ kind: 'explicit-v2-scope-guard' }]);
    const previousReverse = base.evidence.some(item => item.kind === 'explicit-part-order-and-attribute-scope' && item.detail === 'reverse');
    const mentionParts = previousReverse ? [...program.parts].reverse() : [...program.parts];
    const order = explicitOrder(text, spans);
    if (!order || order.expectedKind !== program.relation?.kind) return finish(null,'relation-order-unresolved',[{ kind: 'explicit-v2-relation-consistency-guard', detail: order?.rule ?? 'unrecognized-order' }]);
    const ordered = order.parentMention === 0 ? mentionParts : [...mentionParts].reverse();
    for (let mention = 0; mention < mentionParts.length; mention++) {
      const patch = scopedAttributePatch(mentionParts[mention], phrases[mention]);
      Object.assign(mentionParts[mention],patch.part);
      if (patch.rules.length) extra.push({ kind: 'explicit-v2-scoped-attribute', detail: patch.rules.join(',') });
    }
    program.parts = ordered.map((part,index) => ({ ...part, id: String(index) }));
    program.relation = { kind: order.expectedKind, parent: '0', child: '1' };
    extra.push({ kind: 'explicit-v2-parent-order', detail: order.rule });
  } else {
    const patch = scopedAttributePatch(program.parts[0],text); program.parts[0] = patch.part;
    if (patch.rules.length) extra.push({ kind: 'explicit-v2-scoped-attribute', detail: patch.rules.join(',') });
  }
  const valid = validateProgram(program);
  if (!valid) return finish(null,'invalid-program',[...extra,{ kind: 'explicit-v2-validator-guard' }]);
  // Compilation includes the existing finite through-material check. It does
  // not prove every future animation pose, nor repair unsupported child types.
  const compiled = compileScaffoldProgram(valid);
  if (!compiled) return finish(null,'geometry-unsupported',[...extra,{ kind: 'explicit-v2-compiler-guard' }]);
  extra.push({ kind: 'explicit-v2-compiler-accepted' });
  return finish(valid,'selected',extra);
}
