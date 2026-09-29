import { describe, it, expect } from 'vitest';
import { Matter } from './model';
import { captureDay, localDay, restoreDay, validDay, readDays, writeDay } from './diary';
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
