import { afterEach, describe, expect, it, vi } from 'vitest';
import { modelResolution, ruleResolution } from './skeleton-client';

afterEach(() => vi.unstubAllGlobals());
describe('bounded scaffold interpretation boundary', () => {
  it('keeps ordinary writing, colour, and negated shapes from replacing the body', () => {
    for (const text of ['今日はよく眠った', '赤い', '花瓶ではない', '赤い花瓶ではなく剣にする']) {
      const result = ruleResolution(text);
      if (text.includes('剣')) expect(result.spec?.family).toBe('sword');
      else expect(result.spec).toBeNull();
    }
  });
  it('selects authored noun and bounded dimensions independently of colour', () => {
    expect(ruleResolution('細長い青い花瓶').spec).toMatchObject({ family: 'vase', height: 1.65, width: .7 });
    expect(ruleResolution('表面 四角い').spec?.family).toBe('cube');
  });
  it('accepts a real model hold without inventing a shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ spec: null, source: 'unchanged', modelMs: 2, reason: 'ambiguous' }) }));
    expect(await modelResolution('明日の予定', new AbortController().signal)).toMatchObject({ spec: null, source: 'unchanged' });
  });
  it('rejects malformed or missing model results rather than disguising a rule fallback', async () => {
    for (const raw of [{ spec: null, source: 'unchanged', modelMs: 0, reason: 'model-unavailable' }, { spec: { family: 'vase', height: 99 }, source: 'semantic-model', modelMs: 1 }]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => raw }));
      await expect(modelResolution('花瓶', new AbortController().signal)).rejects.toThrow();
    }
  });
});
