/* Development browser check. Uses only synthetic frozen fixtures and loopback. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const require = createRequire(path.join(root, 'prototypes/glyph-creature/package.json'));
const { chromium } = require('@playwright/test');
const fixtureBytes = fs.readFileSync(path.join(directory, 'fixture.json'));
const fixtureSha = crypto.createHash('sha256').update(fixtureBytes).digest('hex');
if (fixtureSha !== fs.readFileSync(path.join(directory, 'fixture.sha256'), 'utf8').split(/\s+/)[0]) throw new Error('Fixture hash changed');
const allCases = JSON.parse(fixtureBytes).cases;
const cases = process.env.CASE_LIMIT ? allCases.slice(0, Number(process.env.CASE_LIMIT)) : allCases;
const runId = process.env.BROWSER_RUN_ID ?? 'browser-regression-1';
const destination = path.join(directory, `${runId}.json`);
if (fs.existsSync(destination)) throw new Error('Refusing to overwrite browser result');
const captureDir = path.join(root, '.local/skeleton-evaluation');
fs.mkdirSync(captureDir, { recursive: true });
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, ...(fs.existsSync(executablePath) ? { executablePath } : {}) });
const results = [];
function familyAndAttributes(caseValue, spec) {
  const familyPass = (spec?.family ?? null) === caseValue.expectedFamily;
  const conditions = Object.entries(caseValue.attributes ?? {}).map(([key, check]) => {
    const value = spec?.[key];
    return { attribute: key, actual: value, expected: check, pass: Number.isFinite(value) &&
      (check.min === undefined || value >= check.min) && (check.max === undefined || value <= check.max) &&
      (check.minAbs === undefined || Math.abs(value) >= check.minAbs) };
  });
  return { familyPass, conditions, meaningPass: familyPass && conditions.every(check => check.pass) };
}
try {
  for (const caseValue of cases) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const started = performance.now();
    let outcome;
    try {
      await page.goto('http://127.0.0.1:4212/skeleton.html', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.__SKELETON_ART__);
      await page.keyboard.press('Enter');
      await page.locator('#guide summary').click();
      await page.locator('#provider').selectOption('model');
      await page.locator('#guide summary').click();
      await page.locator('#text-input').fill(caseValue.text);
      await page.locator('#text-input').press('Enter');
      await page.waitForFunction(() => window.__SKELETON_ART__?.inspect().timings.length === 1, undefined, { timeout: 35000 });
      const state = await page.evaluate(() => window.__SKELETON_ART__.inspect());
      const timing = state.timings[0];
      const spec = state.scene.skeleton;
      const supplied = [...new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(caseValue.text.normalize('NFC'))]
        .map(item => item.segment).filter(value => !/^\s+$/u.test(value));
      const textRetained = supplied.every(letter => state.characters.includes(letter));
      outcome = { id: caseValue.id, group: caseValue.group, spec, timing, textRetained,
        finite: state.scene.finite, drawCalls: state.scene.drawCalls, glyphs: state.count, errors,
        ...familyAndAttributes(caseValue, spec) };
      if (caseValue.group === 'exact' || ['attr-vase-tall', 'attr-vase-neck', 'attr-sword-long', 'attr-sword-bend', 'attr-ring-twist'].includes(caseValue.id)) {
        await page.screenshot({ path: path.join(captureDir, `${caseValue.id}.png`) });
      }
    } catch (error) {
      outcome = { id: caseValue.id, group: caseValue.group, error: String(error), errors, meaningPass: false,
        failureState: await page.evaluate(() => ({ hook: window.__SKELETON_ART__?.inspect(), status: document.querySelector("#status")?.textContent, fatal: document.querySelector("#fatal")?.textContent })).catch(() => null) };
      await page.screenshot({ path: path.join(captureDir, `${runId}-${caseValue.id}-failure.png`) }).catch(() => {});
    }
    outcome.testWallMs = Math.round((performance.now() - started) * 1000) / 1000;
    results.push(outcome);
    if (outcome.error) console.log(outcome.error, JSON.stringify(outcome.failureState));
    console.log(`${caseValue.id}: ${outcome.meaningPass ? 'PASS' : 'FAIL'} full ${outcome.timing?.totalMs?.toFixed(1) ?? '?'} ms / ${outcome.glyphs ?? '?'} glyphs`);
    await page.close();
  }
} finally { await browser.close(); }
const ordered = results.filter(row => row.timing).map(row => row.timing.totalMs).sort((a, b) => a - b);
const quantile = p => { if (!ordered.length) return null; const at = (ordered.length - 1) * p; const low = Math.floor(at); return ordered[low] + (ordered[Math.ceil(at)] - ordered[low]) * (at - low); };
const summary = {
  cases: results.length, completed: results.filter(row => row.timing).length,
  familyPass: results.filter(row => row.familyPass).length, meaningPass: results.filter(row => row.meaningPass).length,
  finitePass: results.filter(row => row.finite).length, textRetainedPass: results.filter(row => row.textRetained).length,
  completedUnder10s: results.filter(row => row.timing?.totalMs <= 10000).length,
  correctUnder10s: results.filter(row => row.meaningPass && row.timing?.totalMs <= 10000).length,
  completedUnder30s: results.filter(row => row.timing?.totalMs <= 30000).length,
  correctUnder30s: results.filter(row => row.meaningPass && row.timing?.totalMs <= 30000).length,
  fullP50Ms: quantile(.5), fullP95Ms: quantile(.95),
  timingIncludes: 'Input submitted, interpretation HTTP, scaffold/surface construction, glyph placement, first new render and absorption completion. Already-started inference server; model process preparation excluded and reported separately.',
  machineCaveat: 'Apple M5 32GB host; not evidence of 16GB laptop CPU/iGPU performance.',
  methodology: 'Fixed 1440x1000 development browser context, fresh page for each case, one active page, same frozen fixtures after controller fixes: regression, not new held-out accuracy.',
};
fs.writeFileSync(destination, JSON.stringify({ fixtureSha256: fixtureSha, controllerRevision: process.env.EVALUATION_REVISION ?? 'unspecified', summary, results }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
