import { describe, expect, it } from 'vitest';
import { shapeChoices, shapeEvidence, SHAPES, DEFAULT_SPEC, interpret } from './language';
import { lexicalStats } from './lexical';
import { EXPANDED_SHAPES, EXPANDED_NAMES } from './shape-catalog';

describe('根性版の語彙グラフ', () => {
  it('輪っかをメビウスにも結び、ねじれの指定で絞る', () => {
    expect(shapeChoices('輪っか')).toEqual(['mobius','ring']);
    expect(shapeChoices('わっかみたいなもの')).toContain('mobius');
    expect(shapeChoices('ねじれた輪っか')).toEqual(['mobius']);
    expect(shapeChoices('円環')).toEqual(['ring']);
    expect(shapeChoices('メビウスの輪')).toEqual(['mobius']);
    expect(interpret('黄色い輪っか 8個', DEFAULT_SPEC, undefined, () => 0)).toMatchObject({ spec: { shape: 'mobius', count: 8 }, ink: 'yellow' });
  });
  it('直接の名前を連想より優先し、名前がない時に関係を辿る', () => {
    expect(shapeChoices('ふわふわした立方体')).toEqual(['cube']);
    expect(shapeChoices('花を生けるもの')).toContain('vase');
    expect(shapeChoices('マッシュルームの傘')).toContain('mushroom');
    expect(shapeChoices('稲光')).toContain('bolt');
    expect(shapeChoices('青いmaelstrom')).toContain('vortex');
    expect(shapeChoices('花のない部屋')).toEqual([]);
    expect(shapeChoices('雄螺子')).not.toContain('bolt');
    expect(shapeChoices('ふわふわ')).toContain('cloud');
    expect(shapeChoices('ぐるぐる')).toContain('helix');
    expect(shapeEvidence('輪っか')[0]).toMatchObject({ kind: 'association', path: ['loop','twisted-loop','mobius'] });
    expect(interpret('ふわふわ漂う青いくらげ', DEFAULT_SPEC)).toMatchObject({ spec: { shape: 'jellyfish', motion: 'wave' }, ink: 'blue' });
  });
  it('短い綴りや単語の一部で関係のない形を出さない', () => {
    for (const text of ['言葉を追加する','木曜日','月曜日','これは形ではない','はなしを続ける','高かった','今日はいい天気です','offspring startling flowery','microwave overflow','hello world','enter word','This is a word.','start','2026年5月18日の日記。','100円を払う']) {
      expect(shapeChoices(text), text).toEqual([]);
    }
    expect(shapeChoices('花ではなく球体')).toEqual(['condense']);
    expect(shapeChoices('輪っかじゃない')).toEqual([]);
    expect(interpret('未知の文章を続ける', { ...DEFAULT_SPEC, shape: 'mobius' }).spec.shape).toBe('mobius');
  });
  it('長い単語の誤字と転置だけを限定して拾う', () => {
    expect(shapeChoices('butterfyl')).toContain('butterfly');
    expect(shapeChoices('メビウヌ')).toContain('mobius');
    expect(shapeChoices('ca')).toEqual([]);
  });
  it('60形の登録名と選択できる形が一致する', () => {
    expect(SHAPES.length).toBe(60);
    for (const shape of EXPANDED_SHAPES) expect(shapeChoices(EXPANDED_NAMES[shape]), shape).toEqual([shape]);
    expect(lexicalStats().dictionaryEntries).toBeGreaterThan(100);
  });
});
