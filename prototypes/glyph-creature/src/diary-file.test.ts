import { describe, expect, it } from 'vitest';
import { captureDay, restoreDay } from './diary';
import { parseDiaryFile, MAX_DIARY_FILE_BYTES } from './diary-file';
import { Matter } from './model';

function example() {
  const matter = new Matter(); matter.reset(73); matter.step(2);
  matter.add('赤いだんご 🍡 e\u0301', 3, { ink: 'red', seed: 201 }); matter.step(4);
  matter.add('「<script>」も文字のまま。', 1, { ink: 'cyan', seed: 202 }); matter.step(8);
  matter.spec = { shape: 'dango', mode: 'surface', count: 1, arrangement: 'single', deformation: 'gentle', motion: 'breathe' };
  return captureDay(matter, '2026-09-30');
}

describe('一日分の日記ファイル', () => {
  it('書き出した文・色・時刻・seed・motionを保って復元できる', () => {
    const day = example(), parsed = parseDiaryFile(JSON.stringify(day, null, 2));
    expect(parsed).toEqual({ version: day.version, date: day.date, seed: day.seed, time: day.time, spec: day.spec, batches: day.batches });
    const original = new Matter(), restored = new Matter();
    restoreDay(original, day); restoreDay(restored, parsed);
    expect(restored.inspect()).toEqual(original.inspect());
  });
  it('UTF-8 BOMとmotionを省略した旧保存を読み、未知フィールドを落とす', () => {
    const day = example(); delete day.spec.motion;
    const raw = JSON.stringify({ ...day, thumbnail: 'data:image/webp;base64,AAAA', untrusted: 'ignored', spec: { ...day.spec, extra: 'ignored' }, batches: day.batches.map(b => ({ ...b, extra: 'ignored' })) });
    const parsed = parseDiaryFile('\uFEFF' + raw);
    expect(parsed.spec.motion).toBe('calm'); expect(parsed.date).toBe(day.date);
    expect(Object.keys(parsed).sort()).toEqual(['version', 'date', 'seed', 'time', 'spec', 'batches'].sort());
    expect(Object.keys(parsed.spec).sort()).toEqual(['shape', 'mode', 'count', 'arrangement', 'deformation', 'motion'].sort());
    expect(parsed.batches).toEqual(day.batches);
  });
  it('配列・複数日・未来version・壊れたJSONを拒否する', () => {
    const day = example();
    for (const text of [JSON.stringify([day]), JSON.stringify([day, day]), JSON.stringify({ ...day, version: 2 }), '{"version":1,', 'null']) {
      expect(() => parseDiaryFile(text)).toThrow();
    }
  });
  it('存在しない日付を拒否し、うるう年の2月29日を許可する', () => {
    const day = example();
    for (const date of ['2026-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-01-00', '0000-01-01', '2026-9-30']) {
      expect(() => parseDiaryFile(JSON.stringify({ ...day, date }))).toThrow('日付');
    }
    expect(parseDiaryFile(JSON.stringify({ ...day, date: '2000-02-29' })).date).toBe('2000-02-29');
    expect(parseDiaryFile(JSON.stringify({ ...day, date: '2024-02-29' })).date).toBe('2024-02-29');
  });
  it('UTF-8で8MiBちょうどを許可し、超過を文字数に関わらず拒否する', () => {
    const raw = JSON.stringify(captureDay(new Matter(), '2026-09-30'));
    const padded = raw + ' '.repeat(MAX_DIARY_FILE_BYTES - new TextEncoder().encode(raw).byteLength);
    expect(parseDiaryFile(padded).date).toBe('2026-09-30');
    expect(() => parseDiaryFile(padded + ' ')).toThrow('8 MiB');
    const multibyte = JSON.stringify({ ...example(), extra: 'あ'.repeat(Math.ceil(MAX_DIARY_FILE_BYTES / 3)) });
    expect(multibyte.length).toBeLessThan(MAX_DIARY_FILE_BYTES);
    expect(() => parseDiaryFile(multibyte)).toThrow('8 MiB');
  });
  it('記録された追加文字数の不一致、未知motion、入力上限超過を拒否する', () => {
    const day = example();
    const mismatch = { ...day, batches: day.batches.map((b, i) => ({ ...b, added: b.added + (i === 0 ? 1 : 0) })) };
    expect(() => parseDiaryFile(JSON.stringify(mismatch))).toThrow('文字数');
    expect(() => parseDiaryFile(JSON.stringify({ ...day, spec: { ...day.spec, motion: 'unknown' } }))).toThrow();
    for (const ink of [['red'], { toString: 'red' }, null, 1]) {
      expect(() => parseDiaryFile(JSON.stringify({ ...day, batches: [{ ...day.batches[0], ink }] }))).toThrow('文字色');
    }
    expect(() => parseDiaryFile(JSON.stringify({ ...day, batches: [{ ...day.batches[0], text: 'a'.repeat(16_385) }] }))).toThrow();
  });
});
