import { VISUAL_GRAPH } from './association-graph';

export type NamedTerm = { term: string; shape: string };
type DictionaryEntry = { term: string; shapes: string[]; relation: string; concept: string };
export type MatchReason = 'name' | 'synonym' | 'association' | 'spelling';
export type ShapeEvidence = { shape: string; score: number; kind: MatchReason; word: string; path: string[] };
type Span = { start: number; end: number; term: string };
const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
const normalize = (text: string) => text.normalize('NFKC').toLowerCase();
const kana = (text: string) => normalize(text).replace(/[ァ-ヶ]/gu, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
// The raw corpus is compiled offline. It is optional while authoring, bundled at build.
const dictionaries = import.meta.glob<{ entries: DictionaryEntry[] }>('./data/konjo-wordnet.json', { eager: true, import: 'default' });
const dictionary = Object.values(dictionaries).flatMap(d => d.entries);
const graph = new Map(VISUAL_GRAPH.map(node => [node.id, node]));
const memo = new Map<string, ShapeEvidence[]>();

export function isNegated(source: string, end: number): boolean {
  return /^(?:では|じゃ|で|は|の|が)?(?:ない|なく|ありません|なかった)|^以外/u.test(source.slice(end).trimStart());
}

export function literalContextAllowed(source: string, start: number, term: string): boolean {
  // Dates and prices are common prose, not instructions to draw a moon/ring.
  return !((term === '月' || term === '円') && /[0-9一二三四五六七八九十百千]\s*$/u.test(source.slice(0, start)));
}

export function wordSegments(source: string) {
  return [...segmenter.segment(source)].filter(x => x.isWordLike).map(x => ({ word: x.segment, start: x.index, end: x.index + x.segment.length }));
}

function spans(source: string, raw: string, strict: boolean): Span[] {
  const term = normalize(raw), found: Span[] = [];
  if (!term || !source.includes(term)) return found;
  const tokens = strict && !/[a-z]/i.test(term) ? wordSegments(source) : [];
  let at = 0;
  while ((at = source.indexOf(term, at)) !== -1) {
    const end = at + term.length;
    const english = /^[a-z\s-]+$/i.test(term);
    const boundary = english ? !/[a-z0-9_]/i.test(source[at - 1] ?? '') && !/[a-z0-9_]/i.test(source[end] ?? '')
      : !strict || tokens.some(x => x.start === at) && tokens.some(x => x.end === end);
    if (boundary && literalContextAllowed(source, at, term) && !isNegated(source, end)) found.push({ start: at, end, term });
    at = end;
  }
  return found;
}

/** Mask only the ambiguous loop cue so the literal 輪 cannot override its graph. */
export function maskLooseLoops(text: string): string {
  return text.replace(/(?:ねじれた|ひねった)?(?:輪っか|わっか)|(?:ねじれた|ひねった)輪|花を(?:生ける|いける)/gu, x => ' '.repeat(x.length));
}

export function lexicalEvidence(text: string, names: NamedTerm[]): ShapeEvidence[] {
  const source = normalize(text).slice(0, 12000), cached = memo.get(source);
  if (cached) return cached;
  const evidence: ShapeEvidence[] = [];
  const nodeHits = VISUAL_GRAPH.flatMap(node => node.words.flatMap(term => spans(source, term, false).map(hit => ({ ...hit, node }))));
  const accepted: typeof nodeHits = [];
  for (const hit of nodeHits.sort((a, b) => (b.end - b.start) - (a.end - a.start))) {
    if (!accepted.some(other => hit.start < other.end && hit.end > other.start)) accepted.push(hit);
  }
  for (const hit of accepted) {
    const visit = (id: string, score: number, path: string[]) => {
      if (path.length > 3 || path.includes(id)) return;
      const node = graph.get(id); if (!node) return;
      for (const [shape, weight] of node.forms ?? []) evidence.push({ shape, score: score * weight, kind: 'association', word: hit.term, path: [...path, id, shape] });
      for (const [next, weight] of node.links ?? []) visit(next, score * weight, [...path, id]);
    };
    visit(hit.node.id, .9, []);
  }
  for (const row of dictionary) for (const hit of spans(source, row.term, true)) {
    if (accepted.some(other => hit.start < other.end && hit.end > other.start)) continue;
    for (const shape of row.shapes) evidence.push({ shape, score: row.relation === 'synonym' ? .96 : .7, kind: 'synonym', word: hit.term, path: [row.concept, row.relation, shape] });
  }
  if (!evidence.length) {
    const candidates = [...names, ...dictionary.flatMap(d => d.shapes.map(shape => ({ term: d.term, shape })))];
    const words = wordSegments(source).slice(-64);
    for (const word of words) {
      const query = kana(word.word), chars = [...query];
      // Short kana/kanji edits change meaning too easily; only longer spellings qualify.
      if (!/^[a-z]{6,24}$/u.test(query) && !/^[ぁ-ゖー]{4,18}$/u.test(query) || isNegated(source, word.end)) continue;
      for (const candidate of candidates) {
        const target = kana(candidate.term), letters = [...target];
        if (query.startsWith(target) && /^(?:s|y|ed|ing)$/.test(query.slice(target.length))) continue;
        if (target === query || !/^(?:[a-z]{6,24}|[ぁ-ゖー]{4,18})$/u.test(target)) continue;
        const max = chars.length >= 9 && letters.length >= 9 ? 2 : 1;
        if (Math.abs(chars.length - letters.length) > max) continue;
        const distance = editDistance(chars, letters, max);
        if (distance > max) continue;
        const score = .78 - .2 * distance / Math.max(chars.length, letters.length);
        evidence.push({ shape: candidate.shape, score, kind: 'spelling', word: word.word, path: [word.word, candidate.term, candidate.shape] });
      }
    }
  }
  const byShape = new Map<string, ShapeEvidence>();
  for (const item of evidence.sort((a, b) => b.score - a.score)) if (!byShape.has(item.shape)) byShape.set(item.shape, item);
  const ranked = [...byShape.values()], best = ranked[0]?.score ?? 0;
  const result = ranked.filter(e => e.score >= .7 && e.score >= best - .1).slice(0, 4);
  if (memo.size >= 96) memo.delete(memo.keys().next().value!);
  memo.set(source, result);
  return result;
}

function editDistance(a: string[], b: string[], limit: number): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i), older: number[] | undefined;
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (older && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) next[j] = Math.min(next[j], older[j - 2] + 1);
    }
    if (Math.min(...next) > limit) return limit + 1;
    older = row; row = next;
  }
  return row[b.length];
}

export function lexicalStats() { return { dictionaryEntries: dictionary.length, graphNodes: graph.size, graphTerms: VISUAL_GRAPH.reduce((n, node) => n + node.words.length, 0), cached: memo.size }; }
