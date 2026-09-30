/** Authored geometry and hand-written vocabulary. No model inference is used. */
export const EXPANDED_SHAPES = [
  'cone', 'cylinder', 'capsule', 'pyramid', 'diamond', 'octahedron', 'heart', 'egg', 'droplet', 'moon',
  'cloud', 'mushroom', 'leaf', 'apple', 'pear', 'pumpkin', 'shell', 'fish', 'bird', 'snake', 'turtle',
  'spider', 'lotus', 'rose', 'sun', 'snowflake', 'gear', 'bolt', 'bottle', 'cup', 'teapot', 'umbrella',
  'bell', 'lantern', 'crown', 'knot', 'wave', 'ribbon',
] as const;
export type ExpandedShape = typeof EXPANDED_SHAPES[number];
export const EXPANDED_NAMES: Record<ExpandedShape, string> = {
  cone: '円錐', cylinder: '円柱', capsule: 'カプセル', pyramid: 'ピラミッド', diamond: '宝石', octahedron: '八面体',
  heart: 'ハート', egg: '卵', droplet: '雫', moon: '三日月', cloud: '雲', mushroom: 'きのこ', leaf: '葉', apple: 'りんご',
  pear: '洋梨', pumpkin: 'かぼちゃ', shell: '巻き貝', fish: '魚', bird: '鳥', snake: '蛇', turtle: '亀', spider: '蜘蛛',
  lotus: '蓮', rose: '薔薇', sun: '太陽', snowflake: '雪の結晶', gear: '歯車', bolt: '稲妻', bottle: '瓶', cup: 'カップ',
  teapot: 'ティーポット', umbrella: '傘', bell: '鐘', lantern: '提灯', crown: '王冠', knot: '結び目', wave: '波', ribbon: 'リボン',
};
export const EXPANDED_GROUPS: readonly { label: string; shapes: readonly ExpandedShape[] }[] = [
  { label: '立体', shapes: ['cone', 'cylinder', 'capsule', 'pyramid', 'diamond', 'octahedron', 'heart', 'egg', 'droplet'] },
  { label: '自然', shapes: ['moon', 'cloud', 'leaf', 'mushroom', 'apple', 'pear', 'pumpkin', 'lotus', 'rose', 'sun', 'snowflake', 'wave'] },
  { label: '生きもの', shapes: ['shell', 'fish', 'bird', 'snake', 'turtle', 'spider'] },
  { label: '道具', shapes: ['gear', 'bolt', 'bottle', 'cup', 'teapot', 'umbrella', 'bell', 'lantern', 'crown', 'knot', 'ribbon'] },
];
export const EXPANDED_ALIASES: Record<ExpandedShape, string[]> = {
  cone: ['円錐', 'えんすい', 'コーン', 'cone'], cylinder: ['円柱', 'えんちゅう', 'シリンダー', 'cylinder'],
  capsule: ['カプセル', 'capsule'], pyramid: ['ピラミッド', '四角錐', '角錐', 'pyramid'],
  diamond: ['ダイヤモンド', 'ダイヤ', '宝石', 'diamond', 'gem'], octahedron: ['八面体', '正八面体', 'octahedron'],
  heart: ['ハート', 'heart'], egg: ['卵', '玉子', 'たまご', 'タマゴ', 'egg'], droplet: ['雫', 'しずく', '滴', '水滴', '涙', 'droplet', 'teardrop'],
  moon: ['三日月', '月', 'crescent', 'moon'], cloud: ['雲', 'くも', 'cloud'], mushroom: ['きのこ', 'キノコ', '茸', 'mushroom'],
  leaf: ['葉っぱ', '葉', '木の葉', 'leaf'], apple: ['りんご', 'リンゴ', '林檎', 'apple'], pear: ['洋梨', '洋ナシ', '洋なし', 'pear'],
  pumpkin: ['かぼちゃ', 'カボチャ', '南瓜', 'pumpkin'], shell: ['巻き貝', '貝殻', '貝', 'shell', 'seashell'],
  fish: ['魚', 'さかな', 'サカナ', 'fish'], bird: ['鳥', 'ことり', '小鳥', 'bird'], snake: ['蛇', 'へび', 'ヘビ', 'snake'],
  turtle: ['亀', 'かめ', 'カメ', 'turtle'], spider: ['蜘蛛', 'くも型', 'スパイダー', 'spider'],
  lotus: ['蓮', 'はす', 'ハス', '睡蓮', 'lotus'], rose: ['薔薇', 'ばら', 'バラ', 'rose'],
  sun: ['太陽', 'お日様', 'sun'], snowflake: ['雪の結晶', '雪結晶', '雪', 'snowflake'], gear: ['歯車', 'ギア', 'gear', 'cog'],
  bolt: ['稲妻', '雷', 'かみなり', 'いなずま', 'lightning', 'thunderbolt'], bottle: ['瓶', 'びん', 'ボトル', 'bottle'],
  cup: ['カップ', 'コップ', 'マグカップ', 'マグ', 'cup', 'mug'], teapot: ['ティーポット', '急須', 'やかん', 'teapot', 'kettle'],
  umbrella: ['傘', 'かさ', 'カサ', 'umbrella'], bell: ['鐘', '釣鐘', '鈴', 'ベル', 'bell'],
  lantern: ['提灯', 'ちょうちん', 'ランタン', 'lantern'], crown: ['王冠', '冠', 'クラウン', 'crown'],
  knot: ['結び目', '結び', '結び紐', 'knot'], wave: ['波', 'なみ', '波浪', 'wave'], ribbon: ['リボン', '蝶結び', 'ribbon'],
};
