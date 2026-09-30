import { chromium } from '../../prototypes/glyph-creature/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
const browser = await chromium.launch({ ...(existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
const errors = [], external = [], checks = [], states = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', entry => { if (entry.type() === 'error') errors.push(entry.text()); });
page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4196') && !request.url().startsWith('data:')) external.push(request.url()); });
const dir = new URL(`./evidence-v${process.argv[2] || '1'}/`, import.meta.url); await mkdir(dir, { recursive: true });
const inspect = () => page.evaluate(() => window.__GLYPH_ART__.inspect());
const tick = seconds => page.evaluate(s => { const api = window.__GLYPH_ART__; api.pause(); for (let i = 0; i < s * 30; i++) api.step(1000 / 30); }, seconds);
const assert = (name, value) => { checks.push({ name, pass: Boolean(value) }); if (!value) throw new Error(name); };
async function feed(text, repeat = '1') {
  await page.keyboard.press('Enter'); await page.locator('#guide').evaluate(el => el.open = true);
  await page.locator('#repeat').selectOption(repeat); await page.locator('#text-input').fill(text); await page.locator('#text-input').press('Enter'); await tick(10);
}
async function mode(value) { await page.locator('#show-help').click(); await page.locator('#contour-mode').selectOption(value); await page.locator('#close').click(); }
async function shot(name) { await page.screenshot({ path: new URL(name.replaceAll('球体', 'sphere').replaceAll('立方体', 'cube') + '.png', dir).pathname }); states.push({ name, state: await inspect() }); }
try {
  for (const shape of ['球体', '立方体']) {
    await page.goto('http://127.0.0.1:4196'); await page.waitForFunction(() => window.__GLYPH_ART__);
    await page.evaluate(() => window.__GLYPH_ART__.reset(23));
    await feed(`白い${shape} ${'ことば流れるabcdefghijklmnopqrstuvwxyz'.repeat(45)}`);
    await feed('赤いあいうえおかきくけこさしすせそ', '16');
    await feed('青いアイウエオカキクケコサシスセソ', '16');
    const before = await inspect(); assert(shape + ' input colors', before.batches.map(b => b.ink).join() === 'white,red,blue');
    await shot(shape + '-off'); await mode('emphasis'); await tick(.1); await shot(shape + '-emphasis');
    await mode('contour'); await tick(4); await shot(shape + '-contour');
    const on = await inspect(); assert(shape + ' visible circulation', on.scene.contour.visible > 0);
    assert(shape + ' both colors enrolled', on.scene.contour.colors.red > 32 && on.scene.contour.colors.blue > 32 && on.scene.contour.enrolled <= 160);
    assert(shape + ' no glyph replacement', JSON.stringify(before.batches) === JSON.stringify(on.batches) && before.count === on.count);
    const paused = JSON.stringify(on.scene.contour); await page.waitForTimeout(250); assert(shape + ' pause', paused === JSON.stringify((await inspect()).scene.contour));
    await tick(4); const moved = await inspect(); assert(shape + ' moves on same IDs', JSON.stringify(moved.scene.contour.selected.map(x => x.id)) === JSON.stringify(on.scene.contour.selected.map(x => x.id)) && JSON.stringify(moved.scene.contour.selected.map(x => x.point)) !== JSON.stringify(on.scene.contour.selected.map(x => x.point)));
    await shot(shape + '-contour-t8');
    await page.mouse.move(500, 430); await page.mouse.down(); await page.mouse.move(760, 540, { steps: 30 }); await page.mouse.up(); await tick(2); await shot(shape + '-rotated');
    assert(shape + ' finite after drag', (await inspect()).scene.finite);
    if (shape === '立方体') {
      let hidden = 0, wrong = 0;
      for (let n = 0; n < 16; n++) {
        await tick(.5); const s = await inspect();
        for (const letter of s.scene.contour.selected) if (letter.weight > .05) {
          const p = letter.point.map(v => v / s.scene.contour.bodyScale), c = s.scene.contour.cameraLocal;
          const facing = p.reduce((sum, v, i) => sum + v ** 11 * (c[i] - v), 0);
          if (facing < -.15) { hidden++; if (letter.visibility > .01) wrong++; }
        }
      }
      assert('cube back edges are hidden', hidden > 0 && wrong === 0);
    }
    await feed('黄色いあいうえおかきくけこさしすせそ', '16');
    const bigger = await inspect(); assert(shape + ' later colors join without replacing earlier IDs', bigger.scene.contour.enrolled > 160 && bigger.scene.contour.colors.yellow > 0 && JSON.stringify(bigger.scene.contour.selected.map(x => x.id)) === JSON.stringify(on.scene.contour.selected.map(x => x.id)));
    await tick(55); const laterCohort = await inspect(); assert(shape + ' larger cohort remains finite', laterCohort.scene.finite);
    await mode('off'); await tick(5); const off = await inspect(); assert(shape + ' returns to surface', off.scene.contour.mix < .001 && off.scene.contour.visible === 0);
    await mode('contour'); await feed('白いメビウスの輪'); const other = await inspect(); assert(shape + ' unsupported form keeps surface', !other.scene.contour.supported && other.scene.contour.visible === 0 && other.scene.finite);
  }
  await page.goto('http://127.0.0.1:4196'); await page.waitForFunction(() => window.__GLYPH_ART__); await feed('球体 ことばあいうえおかきくけこさしすせそ'); await mode('contour'); await tick(10);
  assert('no automatic recoloring / enrollment', (await inspect()).scene.contour.enrolled === 0); await shot('auto-white');
  await feed('赤い光あいうえおかきくけこ', '1'); await tick(4); await shot('sparse');
  await feed(`白い${'文字の面を流れる'.repeat(350)}`); await tick(4); await shot('dense');
  assert('no errors', errors.length === 0); assert('no external requests', external.length === 0);
} catch (error) { errors.push(error.stack); process.exitCode = 1; }
await writeFile(new URL('results.json', dir), JSON.stringify({ checks, errors, external, states, browser: await browser.version(), note: 'Time is stepped at 30 Hz. This is not a long real-time endurance test.' }, null, 2));
await browser.close(); console.log(JSON.stringify({ checks, errors, external }));
