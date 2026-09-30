import { captureDay, restoreDay, validDay, type Day } from './diary';
import { Matter } from './model';

export const MAX_DIARY_FILE_BYTES = 8 * 1024 * 1024;

function calendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Parse one exported day without executing its text or writing to browser storage. */
export function parseDiaryFile(text: string): Day {
  if (typeof text !== 'string') throw new Error('日記のJSONファイルを選んでください。');
  // UTF-16 length is a cheap lower bound; the actual limit is the UTF-8 byte length.
  if (text.length > MAX_DIARY_FILE_BYTES || new TextEncoder().encode(text).byteLength > MAX_DIARY_FILE_BYTES) {
    throw new Error('日記ファイルは8 MiBまで読み込めます。');
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text.replace(/^\uFEFF/u, '')); }
  catch { throw new Error('日記のJSONを読み取れませんでした。'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('一日分の日記ファイルを選んでください。複数日をまとめたファイルは読み込めません。');
  }
  if ((parsed as { version?: unknown }).version !== 1) throw new Error('この版の日記ファイルには対応していません。');
  if (!calendarDate((parsed as { date?: unknown }).date)) throw new Error('日記の日付が正しくありません。');
  const batches = (parsed as { batches?: unknown }).batches;
  // Property keys coerce arrays such as ['red']; a file's ink must be an actual string.
  if (Array.isArray(batches) && batches.some(batch => batch && typeof batch === 'object' && batch.ink !== undefined && typeof batch.ink !== 'string')) {
    throw new Error('日記の文字色の形式が正しくありません。');
  }
  if (!validDay(parsed)) throw new Error('日記の形式、文字数、形、動きのいずれかが正しくありません。');

  const matter = new Matter();
  // Replaying every batch verifies its recorded count before anything can reach the current scene.
  restoreDay(matter, parsed);
  const { shape, mode, count, arrangement, deformation, motion } = matter.spec;
  matter.spec = { shape, mode, count, arrangement, deformation, motion: motion ?? 'calm' };
  const day = captureDay(matter, parsed.date);
  delete day.thumbnail;
  return day;
}
