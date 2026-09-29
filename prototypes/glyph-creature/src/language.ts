export const SHAPES = ['condense', 'vortex', 'orbit', 'mobius', 'ring', 'cube', 'cuboid', 'cross', 'triangle', 'square'] as const;
export type Shape = typeof SHAPES[number];
export type SceneSpec = { shape: Shape; mode: 'flow' | 'surface'; count: number; arrangement: 'single' | 'swarm' | 'chain'; deformation: 'gentle' | 'omega' | 'double' };
export const DEFAULT_SPEC: SceneSpec = { shape: 'condense', mode: 'surface', count: 1, arrangement: 'single', deformation: 'gentle' };
export const COLORS = { white: [0.94, 0.95, 0.94], red: [1, 0.19, 0.16], yellow: [1, 0.85, 0.12], blue: [0.25, 0.48, 1], cyan: [0.15, 0.9, 1], green: [0.25, 1, 0.48], purple: [0.8, 0.4, 1], pink: [1, 0.4, 0.7] } as const;
export type Ink = keyof typeof COLORS;
export const SHAPE_NAMES: Record<Shape, string> = { condense: '塊', vortex: '渦', orbit: '軌道', mobius: 'メビウスの輪', ring: '円環', cube: '立方体', cuboid: '直方体', cross: '十字', triangle: '三角形', square: '四角形' };
export const INK_NAMES: Record<Ink, string> = { white: '白', red: '赤', yellow: '黄色', blue: '青', cyan: '水色', green: '緑', purple: '紫', pink: '桃色' };
const shapeWords: [RegExp, Shape][] = [
  [/メビウス|メビュウス|möbius|mobius/iu, 'mobius'], [/直方体|cuboid|rectangular\s*(prism|box)/iu, 'cuboid'],
  [/立方体|キューブ|cube/iu, 'cube'], [/三角|triangle/iu, 'triangle'], [/四角|正方形|square/iu, 'square'],
  [/十字|cross/iu, 'cross'], [/円環|円|リング|輪|ring|circle/iu, 'ring'], [/原子|軌道|orbit/iu, 'orbit'],
  [/渦|うず|vortex/iu, 'vortex'], [/凝縮|塊|かたまり|球|sphere/iu, 'condense'],
];
const inkWords: [RegExp, Ink][] = [
  [/水色|シアン|cyan/iu, 'cyan'], [/黄色?|yellow/iu, 'yellow'], [/赤色?|red/iu, 'red'], [/青色?|blue/iu, 'blue'],
  [/緑色?|green/iu, 'green'], [/紫色?|purple/iu, 'purple'], [/桃色|ピンク|pink/iu, 'pink'], [/白色?|white/iu, 'white'],
];
export type Interpretation = { spec: SceneSpec; ink?: Ink; recognized: boolean; description: string };

export const explicitShape = (text: string) => shapeWords.find(([pattern]) => pattern.test(text.normalize('NFKC')))?.[1];

/** An explicit vocabulary composer, not a claim of general language understanding. */
export function interpret(text: string, current: SceneSpec, shapeOverride?: Shape | null): Interpretation {
  const source = text.normalize('NFKC');
  const shape = shapeOverride === undefined ? explicitShape(source) : shapeOverride ?? undefined;
  const ink = inkWords.find(([pattern]) => pattern.test(source))?.[1];
  const surface = /表面|surface/iu.test(source), flow = /流れ|流す|流れる|flow|stream/iu.test(source);
  const chain = /鎖|くさり|chain/iu.test(source);
  const double = /大小|大きい.*小さい|小さい.*大きい|二つの輪|2つの輪/iu.test(source);
  const omega = /オメガ|omega|Ω/u.test(source);
  const digits = source.match(/(\d+)\s*(?:個|つ|本|枚|輪|rings?)/iu) ?? source.match(/(?:円|リング|輪)\s*(\d+)/u);
  const japanese = source.match(/([一二三四五六七八九十])\s*(?:個|つ|本|枚|輪)/u);
  const rawCount = digits ? Number(digits[1]) : japanese ? '一二三四五六七八九十'.indexOf(japanese[1]) + 1 : undefined;
  const count = Math.max(1, Math.min(16, rawCount ?? (chain ? 5 : shape ? 1 : current.count)));
  const recognized = Boolean(shape || ink || surface || flow || chain || double || omega || rawCount !== undefined);
  const spec: SceneSpec = {
    shape: shape ?? (chain || double ? 'ring' : omega ? 'mobius' : current.shape),
    mode: surface ? 'surface' : flow ? 'flow' : current.mode,
    count: double ? 2 : count,
    arrangement: chain ? 'chain' : double ? 'swarm' : shape ? count > 1 ? 'swarm' : 'single' : count === 1 ? 'single' : current.arrangement === 'chain' ? 'chain' : 'swarm',
    deformation: double ? 'double' : omega ? 'omega' : shape || (rawCount !== undefined && rawCount !== 2) ? 'gentle' : current.deformation,
  };
  if (spec.arrangement === 'chain') { spec.shape = 'ring'; spec.deformation = 'gentle'; }
  if (spec.deformation === 'double') { spec.shape = 'ring'; spec.count = 2; spec.arrangement = 'swarm'; }
  if (spec.deformation === 'omega') spec.shape = 'mobius';
  return { spec, ink, recognized, description: describe(spec, ink) };
}

export function describe(spec: SceneSpec, ink?: Ink) {
  return `${spec.mode === 'surface' ? '表面' : '流れる'} · ${SHAPE_NAMES[spec.shape]}${spec.count > 1 ? ` · ${spec.count}個` : ''}${spec.arrangement === 'chain' ? ' · 鎖' : ''}${spec.deformation === 'omega' ? ' · オメガ' : ''}${spec.deformation === 'double' ? ' · 大小' : ''}${ink ? ` · 追加文字は${INK_NAMES[ink]}` : ''}`;
}
