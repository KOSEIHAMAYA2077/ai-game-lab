import { interpretMotion } from './motion-language';
import { MOTION_NAMES, type Motion } from './motions';

export const SHAPES = ['condense', 'vortex', 'orbit', 'mobius', 'ring', 'cube', 'cuboid', 'cross', 'triangle', 'square', 'fireworks', 'dango', 'flower', 'butterfly', 'jellyfish', 'tree', 'star', 'helix', 'hourglass', 'saturn', 'sword', 'vase'] as const;
export type Shape = typeof SHAPES[number];
export type SceneSpec = { shape: Shape; mode: 'flow' | 'surface'; count: number; arrangement: 'single' | 'swarm' | 'chain'; deformation: 'gentle' | 'omega' | 'double'; motion?: Motion };
export const DEFAULT_SPEC: SceneSpec = { shape: 'condense', mode: 'surface', count: 1, arrangement: 'single', deformation: 'gentle', motion: 'calm' };
export const COLORS = { white: [0.94, 0.95, 0.94], red: [1, 0.19, 0.16], yellow: [1, 0.85, 0.12], blue: [0.25, 0.48, 1], cyan: [0.15, 0.9, 1], green: [0.25, 1, 0.48], purple: [0.8, 0.4, 1], pink: [1, 0.4, 0.7] } as const;
export type Ink = keyof typeof COLORS;
export const SHAPE_NAMES: Record<Shape, string> = { condense: '球体', vortex: '渦', orbit: '軌道', mobius: 'メビウスの輪', ring: '円環', cube: '立方体', cuboid: '直方体', cross: '十字', triangle: '三角形', square: '四角形', fireworks: '花火', dango: '団子', flower: '花', butterfly: '蝶', jellyfish: 'くらげ', tree: '木', star: '星', helix: '螺旋', hourglass: '砂時計', saturn: '土星', sword: '剣', vase: '花瓶' };
export const INK_NAMES: Record<Ink, string> = { white: '白', red: '赤', yellow: '黄色', blue: '青', cyan: '水色', green: '緑', purple: '紫', pink: '桃色' };
export const SHAPE_GROUPS: { name: string; shapes: Shape[] }[] = [
  { name: '形', shapes: ['condense', 'cube', 'cuboid', 'mobius', 'ring', 'square', 'triangle', 'cross', 'star', 'helix'] },
  { name: '生きもの', shapes: ['flower', 'butterfly', 'jellyfish', 'tree'] },
  { name: 'もの・空', shapes: ['vase', 'sword', 'hourglass', 'saturn', 'dango', 'fireworks', 'vortex', 'orbit'] },
];
const shapeWords: [RegExp, Shape][] = [
  [/花瓶|かびん|壺|つぼ|\b(?:vase|urn|pottery)\b/iu, 'vase'],
  [/砂時計|すなどけい|\bhourglass\b/iu, 'hourglass'],
  [/土星|どせい|\bsaturn\b/iu, 'saturn'],
  [/くらげ|クラゲ|海月|水母|\bjellyfish\b/iu, 'jellyfish'],
  [/蝶|ちょうちょ|チョウチョ|バタフライ|\bbutterfl(?:y|ies)\b/iu, 'butterfly'],
  [/螺旋|らせん|スプリング|コイル|\b(?:helix|spring|coil)\b/iu, 'helix'],
  [/剣|つるぎ|ソード|\b(?:sword|blade)\b/iu, 'sword'],
  [/樹木|大樹|樹|木(?!曜)|ツリー|\b(?:tree|fir)\b/iu, 'tree'],
  [/星型|星形|星|スター|\bstars?\b/iu, 'star'],
  [/花びら|花|はな(?=が|を|に|の|[\s。、!?]|$)|フラワー|\b(?:flower|blossom|petal)\b/iu, 'flower'],
  [/花火|はなび|\bfireworks?\b/iu, 'fireworks'], [/団子|だんご|\bdango\b/iu, 'dango'],
  [/メビウス|メビュウス|\b(?:möbius|mobius)\b/iu, 'mobius'], [/直方体|\b(?:cuboid|rectangular\s*(?:prism|box))\b/iu, 'cuboid'],
  [/立方体|キューブ|サイコロ|さいころ|\b(?:cube|dice)\b/iu, 'cube'], [/三角|\btriangle\b/iu, 'triangle'], [/四角|正方形|\bsquare\b/iu, 'square'],
  [/十字|\bcross\b/iu, 'cross'], [/ドーナツ|どーなつ|円環|円|リング|輪|\b(?:ring|circle|donut|doughnut|torus)\b/iu, 'ring'], [/原子|軌道|\borbit\b/iu, 'orbit'],
  [/渦|うず|\bvortex\b/iu, 'vortex'], [/凝縮|塊|かたまり|球|ボール|地球|\b(?:sphere|ball|globe)\b/iu, 'condense'],
];
const inkWords: [RegExp, Ink][] = [
  [/水色|シアン|\bcyan\b/iu, 'cyan'], [/黄色?|\byellow\b/iu, 'yellow'], [/赤色?|\bred\b/iu, 'red'], [/青色?|\bblue\b/iu, 'blue'],
  [/緑色?|\bgreen\b/iu, 'green'], [/紫色?|\bpurple\b/iu, 'purple'], [/桃色|ピンク|\bpink\b/iu, 'pink'], [/白色?|\bwhite\b/iu, 'white'],
];
export type Interpretation = { spec: SceneSpec; ink?: Ink; recognized: boolean; description: string };

export const explicitShape = (text: string) => shapeChoices(text)[0];

/** Longest overlapping words win: メビウスの輪 must not also count as 輪. */
export function wordChoices<T>(source: string, vocabulary: [RegExp, T][]): T[] {
  const hits = vocabulary.flatMap(([pattern, value]) => [...source.matchAll(new RegExp(pattern.source, pattern.flags + 'g'))]
    .map(match => ({ start: match.index!, end: match.index! + match[0].length, value })));
  const accepted: typeof hits = [];
  for (const hit of hits.sort((a, b) => (b.end - b.start) - (a.end - a.start))) {
    if (!accepted.some(other => hit.start < other.end && hit.end > other.start)) accepted.push(hit);
  }
  // A ring word within メビウスの輪 is part of that name, even though メビウス matched separately.
  return [...new Set(accepted.sort((a, b) => a.start - b.start).map(hit => hit.value))];
}

export function shapeChoices(text: string): Shape[] {
  const source = text.normalize('NFKC').replace(/(メビウス|メビュウス)の輪/gu, '$1');
  return wordChoices(source, shapeWords);
}

/** An explicit vocabulary composer, not a claim of general language understanding. */
export function interpret(text: string, current: SceneSpec, shapeOverride?: Shape | null, choose?: () => number): Interpretation {
  const source = text.normalize('NFKC');
  const pick = <T>(items: T[]) => items[Math.min(items.length - 1, Math.floor((choose?.() ?? 0) * items.length))];
  const shape = shapeOverride === undefined ? choose ? pick(shapeChoices(source)) : explicitShape(source) : shapeOverride ?? undefined;
  const ink = choose ? pick(wordChoices(source, inkWords)) : inkWords.find(([pattern]) => pattern.test(source))?.[1];
  const surface = /表面|\bsurface\b/iu.test(source), flow = /流れ|流す|流れる|\b(?:flow|stream)\b/iu.test(source);
  const chain = /鎖|くさり|\bchain\b/iu.test(source);
  const double = /大小|大きい.*小さい|小さい.*大きい|二つの輪|2つの輪/iu.test(source);
  const omega = /オメガ|\bomega\b|Ω/u.test(source);
  const digits = source.match(/(\d+)\s*(?:個|つ|本|枚|輪|rings?)/iu) ?? source.match(/(?:円|リング|輪)\s*(\d+)/u);
  const japanese = source.match(/([一二三四五六七八九十])\s*(?:個|つ|本|枚|輪)/u);
  const rawCount = digits ? Number(digits[1]) : japanese ? '一二三四五六七八九十'.indexOf(japanese[1]) + 1 : undefined;
  const count = Math.max(1, Math.min(16, rawCount ?? (chain ? 5 : shape ? 1 : current.count)));
  const motion = interpretMotion(source, current.motion ?? 'calm', choose);
  const recognized = Boolean(shape || ink || surface || flow || chain || double || omega || rawCount !== undefined || motion.recognized);
  const spec: SceneSpec = {
    shape: shape ?? (chain || double ? 'ring' : omega ? 'mobius' : current.shape),
    mode: surface && flow && choose ? pick<SceneSpec['mode']>(['surface', 'flow']) : surface ? 'surface' : flow ? 'flow' : current.mode,
    count: double ? 2 : count,
    arrangement: chain ? 'chain' : double ? 'swarm' : shape ? count > 1 ? 'swarm' : 'single' : count === 1 ? 'single' : current.arrangement === 'chain' ? 'chain' : 'swarm',
    deformation: double ? 'double' : omega ? 'omega' : shape || (rawCount !== undefined && rawCount !== 2) ? 'gentle' : current.deformation,
    motion: motion.motion,
  };
  if (spec.arrangement === 'chain') { spec.shape = 'ring'; spec.deformation = 'gentle'; }
  if (spec.deformation === 'double') { spec.shape = 'ring'; spec.count = 2; spec.arrangement = 'swarm'; }
  if (spec.deformation === 'omega') spec.shape = 'mobius';
  return { spec, ink, recognized, description: describe(spec, ink) };
}

export function describe(spec: SceneSpec, ink?: Ink) {
  return `${spec.mode === 'surface' ? '表面' : '流れる'} · ${SHAPE_NAMES[spec.shape]}${spec.motion && spec.motion !== 'calm' ? ` · ${MOTION_NAMES[spec.motion]}` : ''}${spec.count > 1 ? ` · ${spec.count}個` : ''}${spec.arrangement === 'chain' ? ' · 鎖' : ''}${spec.deformation === 'omega' ? ' · オメガ' : ''}${spec.deformation === 'double' ? ' · 大小' : ''}${ink ? ` · 追加文字は${INK_NAMES[ink]}` : ''}`;
}
