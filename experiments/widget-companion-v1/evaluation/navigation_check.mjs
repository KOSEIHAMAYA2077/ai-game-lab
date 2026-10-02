/** Real navigation recovery plus an explicitly labelled BFCache event contract. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const require = createRequire(path.join(root, 'prototypes/glyph-creature/package.json'));
const { chromium } = require('@playwright/test');
const url = process.argv[2] ?? 'http://127.0.0.1:4232/widget.html';
const output = path.join(directory, `${process.argv[3] ?? 'navigation-r2'}.json`);
if (fs.existsSync(output)) throw Error('Refusing overwrite');
const browser = await chromium.launch({ headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ignoreDefaultArgs: ['--disable-back-forward-cache'] });
const page = await browser.newPage({ viewport: { width: 400, height: 440 } });
await page.addInitScript(() => {
  window.__navigationProbe = { persistedPageShows: 0 };
  window.addEventListener('pageshow', event => { if (event.persisted) window.__navigationProbe.persistedPageShows++; });
});
const inspect = () => page.evaluate(() => window.__WIDGET_ART__.inspect());
try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__WIDGET_ART__);
  await page.keyboard.press('Enter');
  await page.locator('#text-input').fill('表面 メビウスの輪');
  await page.locator('#text-input').press('Enter');
  await page.waitForFunction(() => !window.__WIDGET_ART__.inspect().busy && window.__WIDGET_ART__.inspect().count > 1);
  const before = await inspect();
  await page.goto('about:blank');
  // A BFCache return need not emit a new DOMContentLoaded event.
  const navigationWait = await page.goBack({ waitUntil: 'commit', timeout: 5000 })
    .then(() => ({ completed: true }))
    .catch(error => ({ completed: false, error: error.message.split('\n')[0] }));
  await page.waitForURL(url, { waitUntil: 'commit' });
  await page.waitForFunction(() => !!window.__WIDGET_ART__);
  const returned = await inspect();
  await page.waitForTimeout(1000);
  const after = await inspect();
  const actual = { navigationWait, beforeCount: before.count, afterCount: after.count,
    persistedPageShows: await page.evaluate(() => window.__navigationProbe.persistedPageShows),
    scheduler: after.scheduler, framesAddedAfterBack: after.scheduler.frames - returned.scheduler.frames,
    finite: after.scene.finite };
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  const stopped = await inspect();
  await page.waitForTimeout(500);
  const stayed = await inspect();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  const shown = await inspect();
  await page.waitForTimeout(1000);
  const resumed = await inspect();
  fs.writeFileSync(output, JSON.stringify({ actualNavigation: actual,
    syntheticPersistedEventContract: {
      method: 'Synthetic pagehide/pageshow persisted=true; not an actual BFCache hit',
      stopped: stopped.scheduler, stayed: stayed.scheduler,
      stoppedFramesDelta: stayed.scheduler.frames - stopped.scheduler.frames,
      resumed: resumed.scheduler, resumedFramesDelta: resumed.scheduler.frames - shown.scheduler.frames,
      finite: resumed.scene.finite,
    } }, null, 2) + '\n');
  console.log(fs.readFileSync(output, 'utf8'));
} finally { await browser.close(); }
