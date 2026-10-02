import { chromium } from '../../prototypes/glyph-creature/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';

// Run with a separate development server and a clean browser context; no saved manuscript is read.
// node experiments/surface-flow-20260930/capture.mjs baseline http://127.0.0.1:4174/
const label = process.argv[2] || 'candidate';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Use a simple output label.');
const url = process.argv[3] || 'http://127.0.0.1:4173/';
const output = new URL(`./comparison/${label}/`, import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const errors = [], results = [];
const cases = [['cube', '表面 立方体'], ['mobius', '表面 メビウスの輪'], ['fireworks', '表面 花火']];
const count = 2048, seed = 7, fps = 30, firstTime = 12, lastTime = 20;
try {
  for (const [name, command] of cases) {
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
    await page.goto(url);
    await page.waitForFunction(() => window.__GLYPH_ART__);
    await page.evaluate(({ command, count, seed, firstTime }) => {
      const api = window.__GLYPH_ART__; api.reset(seed);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      document.querySelector('#repeat').value = '1';
      const filler = [...'あいうえおかきくけ'];
      document.querySelector('#text-input').value = command + Array.from({ length: count - 1 - [...command.replace(/\s/g, '')].length }, (_, i) => filler[i % filler.length]).join('');
      document.querySelector('#feed-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      api.pause(true);
      for (let second = 0; second < firstTime; second++) api.step(1000);
    }, { command, count, seed, firstTime });
    // Comparison videos show only the art. This CSS exists in this disposable context only.
    await page.addStyleTag({ content: '#app > :not(#scene) { visibility: hidden !important; }' });
    await page.evaluate(() => {
      const stream = document.querySelector('#scene canvas').captureStream(0);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      window.__CAPTURE__ = { recorder, chunks, track: stream.getVideoTracks()[0] };
      recorder.start(); window.__CAPTURE__.track.requestFrame();
    });
    const snapshots = [], samples = [];
    for (let frame = 0; frame <= (lastTime - firstTime) * fps; frame++) {
      if (frame) await page.evaluate(ms => { window.__GLYPH_ART__.step(ms); window.__CAPTURE__.track.requestFrame(); }, 1000 / fps);
      if (frame % fps === 0) {
        const state = await page.evaluate(() => window.__GLYPH_ART__.inspect());
        samples.push({ time: state.time, points: state.scene.points, camera: state.scene.camera, finite: state.scene.finite });
        if (!state.scene.finite || state.count !== count || state.seed !== seed) throw new Error(`${name}: invalid capture state`);
        if (frame % (4 * fps) === 0) {
          const time = firstTime + frame / fps;
          const data = await page.locator('#scene canvas').evaluate(canvas => canvas.toDataURL('image/png'));
          const filename = `${name}-t${time}.png`;
          await writeFile(new URL(filename, output), Buffer.from(data.split(',')[1], 'base64'));
          snapshots.push({ file: filename, time: state.time, count: state.count, spec: state.spec, camera: state.scene.camera });
        }
      }
      // Recorded video timing includes host scheduling overhead; simulation advances exactly 1/30 s per frame.
      if (frame < (lastTime - firstTime) * fps) await wait(1000 / fps);
    }
    const videoData = await page.evaluate(async () => {
      const { recorder, chunks, track } = window.__CAPTURE__;
      await new Promise(resolve => { recorder.onstop = resolve; recorder.stop(); });
      track.stop();
      const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer());
      let binary = '';
      for (let start = 0; start < bytes.length; start += 32768) binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
      return btoa(binary);
    });
    await writeFile(new URL(`${name}.webm`, output), Buffer.from(videoData, 'base64'));
    await context.close();
    results.push({ name, command, count, seed, snapshots, samples, video: `${name}.webm` });
    console.log(JSON.stringify({ label, name, count, seed, snapshots: snapshots.map(s => s.time) }));
  }
  await writeFile(new URL('results.json', output), JSON.stringify({ viewport: [1200, 900], deviceScaleFactor: 1, simulationFps: fps,
    videoTiming: 'Recorded wall time includes browser and host overhead; exact simulated timestamps are in snapshots and samples.', errors, results }, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
