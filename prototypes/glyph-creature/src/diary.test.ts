import { describe, it, expect } from 'vitest';
import { Matter } from './model';
import { captureDay, localDay, restoreDay, validDay, readDays, writeDay, readDraft, writeDraft, recoverDays, DIARY_KEY } from './diary';
import { interpret, DEFAULT_SPEC, shapeChoices } from './language';

describe('文章の候補と日記', () => {
  it('語の重複を避け、独立した候補からだけ選ぶ', () => {
    expect(shapeChoices('メビウスの輪')).toEqual(['mobius']);
    expect(shapeChoices('水色の立方体、球体と立方体。')).toEqual(['cube','condense']);
    expect(interpret('水色の立方体と赤い球体', DEFAULT_SPEC, undefined, ()=>0)).toMatchObject({spec:{shape:'cube'},ink:'cyan'});
    expect(interpret('水色の立方体と赤い球体', DEFAULT_SPEC, undefined, ()=>.99)).toMatchObject({spec:{shape:'condense'},ink:'red'});
  });
  it('文字・色・日時・乱数を保って再生し、壊れた保存は採用しない', () => {
    const matter = new Matter(); matter.add('あいうえお',16,{ink:'cyan',seed:15}); matter.step(4);
    matter.add('花火',16,{seed:18}); matter.spec=interpret('花火', matter.spec).spec; matter.step(8);
    const day = captureDay(matter, '2026-09-30');
    const restored = new Matter(); restoreDay(restored,day);
    expect(restored.inspect()).toEqual(matter.inspect());
    expect(validDay({...day,time:NaN})).toBe(false);
    expect(validDay({...day,spec:{...day.spec,shape:'unknown'}})).toBe(false);
    expect(validDay({...day,batches:[{...day.batches[0], repeat:Infinity}]})).toBe(false);
  });
  it('端末の暦日で14日を残し、同日の保存は更新する', () => {
    expect(localDay(new Date(2026,8,30,23,59))).toBe('2026-09-30');
    const map=new Map<string,string>(); const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v)}};
    const matter=new Matter();
    for(let i=1;i<=16;i++) writeDay(captureDay(matter,`2026-09-${String(i).padStart(2,'0')}`),storage);
    expect(readDays(storage)).toHaveLength(14);
    writeDay(captureDay(matter,'2026-09-16'),storage);
    expect(readDays(storage)[0].date).toBe('2026-09-16');
    expect(readDays(storage)).toHaveLength(14);
  });
});


describe('原稿と日記の復旧', () => {
  const memoryStorage = () => { const data = new Map<string, string>(); return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } }; };
  it('原稿と選択位置を、形への追加とは別に保持する', () => {
    const storage = memoryStorage();
    const draft = { version: 1 as const, text: 'まだ送っていない\n文章', start: 3, end: 5 };
    writeDraft(draft, storage); expect(readDraft(storage)).toEqual(draft);
    expect(readDays(storage)).toEqual([]);
  });
  it('不正な復元は作業中の形を変更しない', () => {
    const matter = new Matter(); matter.add('今の文章', 1, { seed: 9 });
    const before = matter.inspect(), invalid = captureDay(matter);
    invalid.batches[0].added += 1;
    expect(() => restoreDay(matter, invalid)).toThrow();
    expect(matter.inspect()).toEqual(before);
  });
  it('壊れた原本を退避してから、読み取れる日を回復する', () => {
    const storage = memoryStorage(), matter = new Matter(); matter.add('保存した文章', 1, { seed: 8 });
    const valid = captureDay(matter, '2026-09-29');
    const raw = JSON.stringify([valid, { version: 99 }]); storage.setItem(DIARY_KEY, raw);
    expect(() => readDays(storage)).toThrow();
    const recovered = recoverDays(storage);
    expect(recovered.days).toEqual([valid]); expect(readDays(storage)).toEqual([valid]);
    expect([...storage.data.entries()].some(([key, value]) => key.includes(':recovery:') && value === raw)).toBe(true);
  });
  it('退避が保存できない場合、壊れた原本も置き換えない', () => {
    const storage = memoryStorage(); storage.setItem(DIARY_KEY, 'broken');
    const failing = { getItem: storage.getItem, setItem: () => { throw new Error('quota'); } };
    expect(() => recoverDays(failing)).toThrow(); expect(storage.getItem(DIARY_KEY)).toBe('broken');
  });
});
