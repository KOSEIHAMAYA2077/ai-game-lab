import { expect, it } from 'vitest';
import { DEFAULT_SPEC } from './language';
import { interpretWithModel } from './learned-shape';
import { ShapeCycle, hasShapeIntent, writingCue } from './shape-cycle';

it('30秒で異なる形へ移り、停止中と無効中は進まず、長い停止後も連続切替しない', () => {
  const cycle = new ShapeCycle();
  expect(cycle.advance(29, DEFAULT_SPEC)).toBeNull();
  expect(cycle.advance(0, DEFAULT_SPEC)).toBeNull();
  const cube = cycle.advance(1, DEFAULT_SPEC)!;
  expect(cube.shape).toBe('cube');
  expect(cycle.advance(600, cube)?.shape).toBe('mobius');
  expect(cycle.remaining).toBe(30);
  cycle.setEnabled(false); expect(cycle.advance(300, cube)).toBeNull();
  cycle.setEnabled(true); expect(cycle.advance(29, cube)).toBeNull();
  expect(cycle.advance(1, cube)?.shape).toBe('mobius');
});

it('指定した形を60秒保ち、自動移行では文字以外の複数配置を単体へ戻す', () => {
  const cycle = new ShapeCycle(); cycle.advance(20, DEFAULT_SPEC); cycle.hold();
  const spec = { ...DEFAULT_SPEC, shape: 'ring' as const, count: 8, arrangement: 'chain' as const, motion: 'wave' as const };
  expect(cycle.advance(59, spec)).toBeNull();
  expect(cycle.advance(1, spec)).toMatchObject({ shape: 'cuboid', mode: 'surface', count: 1, arrangement: 'single', motion: 'wave' });
});

it('文章の形指定と色だけを区別し、同じフレーズの後に書き続けても指定を繰り返さない', () => {
  for (const words of ['球体', 'メビウスの輪', '赤い花火', '円環 鎖', 'オメガ', '円 8個']) expect(hasShapeIntent(words)).toBe(true);
  for (const words of ['赤いことば', '文章を続ける', '呼吸する', '流れる']) expect(hasShapeIntent(words)).toBe(false);
  const cue = (text: string) => writingCue(text, interpretWithModel(text, DEFAULT_SPEC, false));
  expect(cue('球体')).toBe(cue('球体について今日も文章を書いている'));
  expect(cue('赤いことば')).toBe('');
  expect(cue('球体')).not.toBe(cue('球体と立方体'));
});
