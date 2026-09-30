import { expect, test, type Download, type Page } from '@playwright/test';

type ArtState = { count: number; characters: string[]; batches: unknown[]; time: number; seed: number; spec: unknown; paused: boolean };
const inspect = (page: Page): Promise<ArtState> => page.evaluate(() => (window as any).__GLYPH_ART__.inspect());
const shape = ({ count, characters, batches, time, seed, spec }: ArtState) => ({ count, characters, batches, time, seed, spec });
const errors = new WeakMap<Page, string[]>();
const fixture = () => ({ version: 1, date: '2030-02-19', seed: 429, time: 11,
  spec: { shape: 'dango', mode: 'surface', count: 1, arrangement: 'single', deformation: 'gentle', motion: 'breathe' },
  batches: [{ text: '記憶', repeat: 16, added: 32, at: 2, seed: 913, ink: 'cyan' }] });
const payload = (value: unknown, name = 'synthetic-day.json') => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
async function init(page: Page, url: string) {
  await page.clock.install({ time: new Date('2030-02-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2030-02-20T12:00:01Z'));
  await page.goto(url);
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__GLYPH_ART__))).toBe(true);
  await page.clock.runFor(32);
}
async function feed(page: Page, text: string) {
  if (await page.locator('#start-prompt').isVisible()) await page.locator('#start-prompt').click({ force: true });
  else await page.locator('#write-word').click({ force: true });
  if (!await page.locator('#repeat').isVisible()) await page.locator('#guide summary').click({ force: true });
  await page.locator('#repeat').selectOption('1', { force: true });
  await page.locator('#text-input').fill(text);
  await page.locator('#text-input').press('Enter');
}
async function bytes(download: Download) {
  const stream = await download.createReadStream();
  if (!stream) throw new Error('ダウンロード本文を読めません');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
async function exported(page: Page) {
  const ready = page.waitForEvent('download');
  await page.locator('#export-day').click({ force: true });
  return bytes(await ready);
}
async function importFile(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  const ready = page.waitForEvent('filechooser');
  await page.locator('#import-day').click({ force: true });
  await (await ready).setFiles(file);
}
const storage = (page: Page) => page.evaluate(() => ({ days: localStorage.getItem('glyph-matter:days:v1'), draft: localStorage.getItem('glyph-matter:manuscript:v1') }));

test.beforeEach(async ({ page }) => {
  const messages: string[] = []; errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

test('日記ファイル: 実際に書き出したbytesを別の状態から閲覧し、再書出し・帰還する', async ({ page }) => {
  await init(page, '/');
  await feed(page, '表面 波打つ 黄色い立方体');
  await page.clock.runFor(4200);
  const original = shape(await inspect(page));
  await page.locator('#show-diary').click({ force: true });
  const originalBytes = await exported(page);
  await page.locator('#diary-close').click({ force: true });
  await feed(page, '流れる 赤い円環 3個');
  await page.clock.runFor(1100);
  const current = shape(await inspect(page)), saved = await storage(page);
  await page.locator('#show-diary').click({ force: true });
  await importFile(page, { name: 'round-trip.json', mimeType: 'application/json', buffer: originalBytes });
  await expect(page.locator('#diary-status')).toContainText('ファイルから閲覧中');
  expect(shape(await inspect(page))).toEqual(original);
  expect((await inspect(page)).paused).toBe(true);
  await expect(page.locator('#save-today')).toBeDisabled();
  expect(JSON.parse((await exported(page)).toString('utf8'))).toEqual(JSON.parse(originalBytes.toString('utf8')));
  expect(await storage(page)).toEqual(saved);
  await page.locator('#diary-close').click({ force: true });
  expect(shape(await inspect(page))).toEqual(current);
  await expect(page.locator('#diary')).toBeHidden();
});

test('日記ファイル: 執筆原稿と保存を保持し、閲覧した形を別窓へ配信しない', async ({ page, context }) => {
  await init(page, '/?write');
  await page.locator('#manuscript').fill('表面 青い立方体');
  await page.locator('#manuscript').press('Enter');
  await page.locator('#manuscript').fill('表面 青い立方体\n書きかけの合成原稿。まだ送らない。');
  await page.clock.runFor(500);
  const viewer = await context.newPage();
  try {
    await init(viewer, '/?companion');
    await expect.poll(async () => (await inspect(viewer)).count).toBe((await inspect(page)).count);
    const viewerBefore = shape(await inspect(viewer)), current = shape(await inspect(page));
    const manuscript = await page.locator('#manuscript').inputValue(), saved = await storage(page);
    await page.locator('#writing-history').click({ force: true });
    await importFile(page, payload(fixture()));
    await expect(page.locator('#diary-status')).toContainText('ファイルから閲覧中');
    expect((await inspect(page)).spec).toEqual(fixture().spec);
    await page.clock.runFor(2000);
    const viewerAfter = shape(await inspect(viewer));
    expect({ ...viewerAfter, time: viewerBefore.time }).toEqual(viewerBefore);
    expect(viewerAfter.time).toBeGreaterThan(viewerBefore.time); // Its own animation continues.
    expect(await page.locator('#manuscript').inputValue()).toBe(manuscript);
    expect(await storage(page)).toEqual(saved);
    await expect(page.locator('#save-today')).toBeDisabled();
    await page.locator('#diary-close').click({ force: true });
    expect(shape(await inspect(page))).toEqual(current);
    expect(await page.locator('#manuscript').inputValue()).toBe(manuscript);
    expect(await storage(page)).toEqual(saved);
  } finally { await viewer.close(); }
});

test('日記ファイル: 破損・再生数不一致・型不一致・8MiB超を拒否し、現在の形を保つ', async ({ page }) => {
  await init(page, '/'); await feed(page, '表面 緑の球体'); await page.clock.runFor(4000);
  await page.locator('#show-diary').click({ force: true });
  const current = shape(await inspect(page)), saved = await storage(page);
  const mismatch = fixture(); mismatch.batches[0].added++;
  const wrongInk = fixture() as any; wrongInk.batches[0].ink = ['red'];
  const cases = [
    { name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{') },
    payload(mismatch, 'mismatch.json'), payload(wrongInk, 'wrong-ink.json'),
    { name: 'oversize.json', mimeType: 'application/json', buffer: Buffer.alloc(8 * 1024 * 1024 + 1, ' ') },
  ];
  for (const file of cases) {
    await importFile(page, file);
    await expect(page.locator('#diary-status')).toContainText('日記を開けませんでした');
    if (file.name === 'oversize.json') await expect(page.locator('#diary-status')).toContainText('8 MiB');
    expect(shape(await inspect(page))).toEqual(current);
    expect(await storage(page)).toEqual(saved);
    await expect(page.locator('#save-today')).toBeEnabled();
  }
});

test('日記ファイル: 閉じる・別ファイル・保存日選択で古い読込を後から表示しない', async ({ page }) => {
  await init(page, '/'); await feed(page, '表面 三角形'); await page.clock.runFor(1000);
  // Synthetic File fixtures only: delay their read completion without mutating app state.
  await page.evaluate(() => {
    const read = File.prototype.text;
    File.prototype.text = async function () {
      const text = await read.call(this);
      if (this.name.startsWith('slow-')) {
        (window as any).__SLOW_DIARY_PENDING__ = ((window as any).__SLOW_DIARY_PENDING__ ?? 0) + 1;
        await new Promise(resolve => setTimeout(resolve, 1500));
        (window as any).__SLOW_DIARY_COMPLETED__ = ((window as any).__SLOW_DIARY_COMPLETED__ ?? 0) + 1;
      }
      return text;
    };
  });
  const current = shape(await inspect(page));
  await page.locator('#show-diary').click({ force: true });
  await page.locator('#save-today').click({ force: true });
  await expect(page.locator('#days button')).toHaveCount(1);
  await importFile(page, payload(fixture(), 'slow-close.json'));
  await expect.poll(() => page.evaluate(() => (window as any).__SLOW_DIARY_PENDING__)).toBe(1);
  await page.locator('#diary-close').click({ force: true });
  await page.clock.runFor(1700);
  await expect.poll(() => page.evaluate(() => (window as any).__SLOW_DIARY_COMPLETED__)).toBe(1);
  const closed = await inspect(page);
  expect({ ...shape(closed), time: current.time }).toEqual(current);
  expect(closed.time).toBeGreaterThan(current.time);
  await expect(page.locator('#diary')).toBeHidden();
  await page.locator('#show-diary').click({ force: true });
  await importFile(page, payload(fixture(), 'slow-replaced.json'));
  await expect.poll(() => page.evaluate(() => (window as any).__SLOW_DIARY_PENDING__)).toBe(2);
  const fast = fixture(); fast.date = '2030-02-18'; fast.seed = 731; fast.spec.shape = 'mobius';
  await importFile(page, payload(fast, 'newer-selection.json'));
  await expect(page.locator('#diary-status')).toContainText('2030-02-18');
  const selected = shape(await inspect(page));
  await page.clock.runFor(1700);
  await expect.poll(() => page.evaluate(() => (window as any).__SLOW_DIARY_COMPLETED__)).toBe(2);
  expect(shape(await inspect(page))).toEqual(selected);
  await expect(page.locator('#diary-status')).toContainText('2030-02-18');
  await importFile(page, payload(fixture(), 'slow-saved-day.json'));
  await expect.poll(() => page.evaluate(() => (window as any).__SLOW_DIARY_PENDING__)).toBe(3);
  await page.locator('#days button').click({ force: true });
  const savedDay = shape(await inspect(page));
  await page.clock.runFor(1700);
  await expect.poll(() => page.evaluate(() => (window as any).__SLOW_DIARY_COMPLETED__)).toBe(3);
  expect(shape(await inspect(page))).toEqual(savedDay);
  expect(savedDay.spec).toEqual(current.spec);
});
