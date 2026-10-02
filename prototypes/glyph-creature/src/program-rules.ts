import type { Part, Primitive, Program } from './scaffold-program';

// Explicit-word baseline. It does not use or claim the learned relation head.
const words: [Primitive, RegExp][] = [
  ['sphere', /球体|球|玉|ボール|\b(?:sphere|ball|orb)\b/giu],
  ['box', /立方体|直方体|箱|四角い|\b(?:box|cube|cuboid)\b/giu],
  ['tube', /棒|管|筒|\b(?:tube|rod|cylinder)\b/giu],
  ['blade', /剣|刃|刀|\b(?:blade|sword)\b/giu],
  ['ring', /輪っか|円環|輪|\b(?:ring|torus|hoop)\b/giu],
  ['vase', /花瓶|花入れ|\bvase\b/giu],
];
type Resolution = { program: Program | null; source: 'rules'; modelMs: number; reason: string };

function part(primitive: Primitive, id: '0' | '1', clause: string): Part {
  const value: Part = { id, primitive, height: 1, width: 1, depth: 1, bend: 0, twist: 0 };
  if (/大き|\blarge\b|\bbig\b/iu.test(clause)) value.height = value.width = value.depth = 1.5;
  if (/小さ|\bsmall\b|\btiny\b/iu.test(clause)) value.height = value.width = value.depth = .55;
  if (/細|\bthin\b|\bslender\b|\bnarrow\b/iu.test(clause)) value.width = value.depth = .55;
  if (/長|高|\blong\b|\btall\b/iu.test(clause)) value.height = 1.65;
  if (/太|幅広|\bwide\b|\bbroad\b/iu.test(clause)) value.width = value.depth = 1.5;
  if (/曲が|曲げ|\bbent\b|\bcurved\b/iu.test(clause)) value.bend = .65;
  if (/ねじ|捻|\btwisted\b/iu.test(clause)) value.twist = .65;
  return value;
}

export function ruleProgramResolution(raw: string): Resolution {
  const text = raw.normalize('NFKC').toLowerCase();
  const hold = (reason: string): Resolution => ({ program: null, source: 'rules', modelMs: 0, reason });
  if (/ではない|じゃない|しない|不要|ないで|なし|\b(?:not|without|don't|never)\b/iu.test(text)) return hold('否定を保留');
  const mentions = words.flatMap(([primitive, re]) => [...text.matchAll(re)].map(match => ({ primitive, index: match.index!, end: match.index! + match[0].length }))).sort((a,b) => a.index - b.index);
  if (!mentions.length || mentions.length > 2) return hold('形の指定なし、または2部位超過');
  if (mentions.length === 1) return { program: { version: 1, parts: [part(mentions[0].primitive, '0', text)] }, source: 'rules', modelMs: 0, reason: '指定語' };
  const [first, second] = mentions;
  const between = text.slice(first.end, second.index), after = text.slice(second.end);
  const kind = /貫|通り抜け|\bthrough\b/iu.test(between + after) ? 'through'
    : /上|\babove\b|\btop\b/iu.test(between) ? 'above'
    : /先|端|\bend\b|\btip\b/iu.test(between) ? 'end' : null;
  if (!kind) return hold('関係の指定なし');
  // Japanese parent の上に child. English child above parent / child through parent.
  const reverse = /\b(?:above|through|at\s+the\s+end|on\s+top)\b/iu.test(between) || (/が/iu.test(between) && /を貫/iu.test(after));
  const one = part(first.primitive, reverse ? '1' : '0', text.slice(0, first.end));
  const two = part(second.primitive, reverse ? '0' : '1', text.slice(first.end, second.end));
  return { program: { version: 1, parts: reverse ? [two,one] : [one,two], relation: { kind, parent: '0', child: '1' } }, source: 'rules', modelMs: 0, reason: '指定語と関係規則' };
}
