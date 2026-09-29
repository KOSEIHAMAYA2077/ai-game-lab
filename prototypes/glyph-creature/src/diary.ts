import { Matter, MAX_GLYPHS, MAX_INPUT_LENGTH, MAX_KINDS } from './model';
import { COLORS, SHAPES, type SceneSpec, type Ink } from './language';

export const DIARY_KEY = 'glyph-matter:days:v1';
export type Day = { version: 1; date: string; seed: number; time: number; spec: SceneSpec; batches: Matter['batches']; thumbnail?: string };
export const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const captureDay = (matter: Matter, date = localDay(), thumbnail?: string): Day => ({ version: 1, date, seed: matter.seed, time: matter.time, spec: { ...matter.spec }, batches: matter.batches.map(b => ({ ...b })), thumbnail });

/** Local storage is untrusted input too; reject malformed or oversized snapshots. */
export function validDay(value: unknown): value is Day {
  const d = value as Day;
  const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
  if (!d || d.version !== 1 || !/^\d{4}-\d{2}-\d{2}$/u.test(d.date) || !finite(d.time) || d.time < 0 || d.time > 1e9 || !finite(d.seed)) return false;
  const s = d.spec;
  if (!s || !SHAPES.includes(s.shape) || !['surface', 'flow'].includes(s.mode) || !Number.isInteger(s.count) || s.count < 1 || s.count > 16 || !['single', 'swarm', 'chain'].includes(s.arrangement) || !['gentle', 'omega', 'double'].includes(s.deformation)) return false;
  if (d.thumbnail !== undefined && (typeof d.thumbnail !== 'string' || !d.thumbnail.startsWith('data:image/webp;base64,') || d.thumbnail.length > 100_000)) return false;
  if (!Array.isArray(d.batches) || d.batches.length > MAX_GLYPHS) return false;
  let total = 1;
  for (const b of d.batches) {
    if (!b || typeof b.text !== 'string' || b.text.length > MAX_INPUT_LENGTH || !Number.isInteger(b.repeat) || b.repeat < 1 || b.repeat > 256 || !Number.isInteger(b.added) || b.added < 1 || !finite(b.seed) || !finite(b.at) || b.at < 0 || b.at > d.time || (b.ink !== undefined && !Object.hasOwn(COLORS, b.ink))) return false;
    total += b.added;
  }
  return total <= MAX_GLYPHS;
}
export function restoreDay(matter: Matter, day: Day) {
  if (!validDay(day)) throw new Error('日記の形式が違います');
  const restored = new Matter();
  restored.reset(day.seed);
  for (const batch of day.batches) {
    restored.time = batch.at;
    const result = restored.add(batch.text, batch.repeat, { ink: batch.ink as Ink | undefined, seed: batch.seed });
    if (result.added !== batch.added) {
      // The last batch may have reached the glyph-kind limit. Its recorded count must still match.
      throw new Error('日記の文字数が一致しません');
    }
  }
  if (restored.kinds.size > MAX_KINDS) throw new Error('文字の種類が多すぎます');
  restored.spec = { ...day.spec }; restored.time = day.time;
  Object.assign(matter, restored);
}
export function readDays(storage: Pick<Storage, 'getItem'> = localStorage): Day[] {
  const raw = storage.getItem(DIARY_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(validDay)) throw new Error('日記を読み込めませんでした');
  return parsed.slice(0, 14).sort((a, b) => b.date.localeCompare(a.date));
}
export function writeDay(day: Day, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): Day[] {
  if (!validDay(day)) throw new Error('日記の形式が違います');
  const days = [day, ...readDays(storage).filter(d => d.date !== day.date)].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  storage.setItem(DIARY_KEY, JSON.stringify(days));
  return days;
}

export const DRAFT_KEY = 'glyph-matter:manuscript:v1';
export type Draft = { version: 1; text: string; start: number; end: number };
export function readDraft(storage: Pick<Storage, 'getItem'> = localStorage): Draft | undefined {
  const raw = storage.getItem(DRAFT_KEY);
  if (!raw) return undefined;
  const d = JSON.parse(raw) as Draft;
  if (!d || d.version !== 1 || typeof d.text !== 'string' || d.text.length > 1_000_000 || !Number.isInteger(d.start) || !Number.isInteger(d.end) || d.start < 0 || d.end < d.start || d.end > d.text.length) throw new Error('原稿を読み込めませんでした');
  return d;
}
export function writeDraft(draft: Draft, storage: Pick<Storage, 'setItem'> = localStorage) {
  if (draft.text.length > 1_000_000) throw new Error('原稿が長すぎます。書き出して区切ってください');
  storage.setItem(DRAFT_KEY, JSON.stringify(draft));
}
/** Recovery is explicit. Keep the original under a separate key before changing the diary. */
export function recoverDays(storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
  const raw = storage.getItem(DIARY_KEY);
  if (raw === null) return { raw: '', days: [] as Day[] };
  let days: Day[] = [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) days = parsed.filter(validDay).filter(day => { try { restoreDay(new Matter(), day); return true; } catch { return false; } }).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  } catch { /* Unreadable JSON is retained in the recovery copy. */ }
  storage.setItem(`${DIARY_KEY}:recovery:${Date.now()}:${Math.random().toString(36).slice(2)}`, raw);
  storage.setItem(DIARY_KEY, JSON.stringify(days));
  return { raw, days };
}

/** Keep a damaged manuscript intact before replacing it with the current text. */
export function recoverDraft(draft: Draft, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
  const raw = storage.getItem(DRAFT_KEY) ?? '';
  storage.setItem(`${DRAFT_KEY}:recovery:${Date.now()}:${Math.random().toString(36).slice(2)}`, raw);
  writeDraft(draft, storage);
  return raw;
}
