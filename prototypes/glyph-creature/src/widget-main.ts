import './style.css';
import './skeleton-style.css';
import './widget-style.css';
import { WidgetScheduler, type WidgetFrame } from './widget-scheduler';
import { WidgetModelClient } from './widget-model-client';
import { restoreWidget, saveWidget } from './widget-state';
import { Matter, splitGlyphs, MAX_INPUT_LENGTH } from './model';
import { GlyphScene } from './scene';
import { interpret, COLORS, INK_NAMES, shapeChoices, type Ink } from './language';
import { ruleProgramResolution } from './program-rules';
import type { Program } from './scaffold-program';
import type { ProgramModelInfo } from './scaffold-model-client';
type Resolution = { program: Program | null; source: 'semantic-model' | 'tiny-student' | 'unchanged' | 'rules' | 'replay'; modelMs: number; reason: string; evidence?: unknown; classifierMs?: number; guardMs?: number };
type TinyModules = { guard: typeof import('./widget-student-guard-v2'); student: typeof import('./widget-student') };
// File size and total decoded frozen heads are asset accounting, not app RAM.
const TINY_ASSET_BYTES = 122601, TINY_FROZEN_WEIGHT_BYTES = 91136;

const labels = { vase: '花瓶', blade: '刃', tube: '棒', ring: '輪', sphere: '球', box: '箱' };
const examples = ['表面 メビウスの輪','白い表面 球体','表面 クラゲ','棒の先に球', '球の上に箱', '箱を輪が貫く', '細い棒の先に大きな球', '青い細長い花瓶', 'a sphere above a box', 'a blade at the end of a tube','白いねじれた箱','ねじれた細長い刃'];
document.querySelector('#app')!.innerHTML = `
<main id="scene" tabindex="-1" aria-label="文字の空間。Enterで入力"></main>
<button id="start-prompt" aria-label="press enter">press enter</button>
<nav id="actions" aria-label="空間の操作" hidden><button id="write-word">▶ 入力</button><button id="thicken" disabled>＋文字</button><button id="show-help">? HELP</button><button id="pause">止める</button><button id="reset">最初へ</button></nav>
<p id="whisper" role="status" hidden></p>
<section id="terminal" aria-label="文字のターミナル" hidden><form id="feed-form"><div class="input-line"><label for="text-input">&gt;</label><input id="text-input" aria-label="加える文字" autocomplete="off" spellcheck="false" placeholder="enter word [enter]" /><button id="feed" aria-label="文字を加える" type="submit">↵</button><button id="close" aria-label="閉じる" type="button">×</button></div></form><p id="status" role="status"></p>
<details id="guide"><summary>? HELP</summary><p class="help">Enter で入力・送信。Esc で閉じる。ドラッグで回転、スクロールで拡大。</p><p class="help">Enterで文字を追加。根性ではメビウス・クラゲなど60形の対応語、分類器とMiniLMでは球・箱・棒など最大2部位を組み合わせます。「先に」「上に」「貫く」で位置を変えます。指定色は今回の文字だけ。未対応の文章では今の形を保ちます。</p>
<div class="controls"><label>解釈 <select id="provider"><option value="rules">根性</option><option value="tiny">小型分類器（実験）</option><option value="browser">MiniLM（ブラウザ）</option></select></label><label>× <select id="repeat"><option value="1">1</option><option value="64" selected>64</option><option value="256">256</option></select></label><label>文字色 <select id="ink"><option value="auto">赤 → 白</option>${Object.keys(COLORS).map(ink => `<option value="${ink}">${INK_NAMES[ink as Ink]}</option>`).join('')}</select></label></div>
<p class="help"><button type="button" id="prepare-model">MiniLMを取得（初回約128MB）</button></p>
<p id="connection" class="help">根性：指定語で60形から選びます。</p><p class="help">小型分類器（実験）：球・箱・棒・刃・輪・花瓶の6形、最大2部位＋1関係。約122KBの分類用データを選択・入力時に読み込みます。自由文の成功率は低く、不明・否定・未対応は判定を保留して今の形に文字だけを追加します。寸法・語順などは明示的な規則も使います。外部送信・追加Workerはありません。</p><p class="help">× は入力した文字の表示を繰り返す密度。描画は最大1,536文字、原文と色は端末内に保持。モデルは部位の意味と関係を解釈し、中心線と断面から面を作ります。最大2部位＋1関係。任意のメッシュ生成ではありません。</p>
<div class="examples">${examples.map(text => `<button type="button" data-example="${text}">${text}</button>`).join('')}</div><p class="help">計算から文字の吸収が終わるまでを計測します。初回のモデル準備時間は別記録です。</p><output id="timing" class="help"></output></details></section><p id="fatal" role="alert" hidden></p>`;
const el = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const input = el<HTMLInputElement>('#text-input'), terminal = el('#terminal'), status = el('#status');
const provider = el<HTMLSelectElement>('#provider'), repeat = el<HTMLSelectElement>('#repeat'), inkSelect = el<HTMLSelectElement>('#ink');
const matter = new Matter();
let scene: GlyphScene, paused = false, busy = false, composing = false, ended = -Infinity, awakened = false;
let lastText = '', lastInk: Ink | undefined, sequence = 0, controller: AbortController | null = null;
let scheduler: WidgetScheduler;
const model = new WidgetModelClient();
let nativeVisible = true, lastNativeReport = -Infinity;
let browserInfo: ProgramModelInfo | null = null;
let lastResolution: Resolution | null = null;
let tinyModules: TinyModules | null = null, tinyPromise: Promise<TinyModules> | null = null, tinyLoadMs = 0;
function loadTiny(signal: AbortSignal): Promise<TinyModules> {
  signal.throwIfAborted();
  if (!tinyPromise) {
    const started = performance.now();
    tinyPromise = Promise.all([import('./widget-student-guard-v2'), import('./widget-student')])
      .then(([guard, student]) => { tinyModules = { guard, student }; tinyLoadMs = performance.now() - started; return tinyModules; })
      .catch(error => { tinyPromise = null; throw error; });
  }
  // Module downloads cannot be undone; cancellation must still discard their UI result.
  return new Promise((resolve, reject) => {
    const abort = () => { reject(new DOMException('Aborted', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    tinyPromise!.then(value => { signal.removeEventListener('abort', abort); if (signal.aborted) abort(); else resolve(value); }, error => { signal.removeEventListener('abort', abort); reject(error); });
  });
}
function providerDescription() {
  return provider.value === 'tiny' ? '小型分類器（実験） · 6形 / 最大2部位＋1関係 · 不明な文章は判定保留'
    : provider.value === 'browser' ? 'MiniLM · 初回約128MBを取得 · 入力時だけWorkerを使い、処理後に解放'
    : '根性 · 指定語で60形から選択';
}
async function prepareTiny() {
  const token = sequence, request = new AbortController(); controller = request;
  try {
    await loadTiny(request.signal);
    if (token !== sequence || provider.value !== 'tiny') return;
    el('#connection').textContent = `${providerDescription()} · 分類用データ読込済み`;
  } catch { if (token === sequence && provider.value === 'tiny') el('#connection').textContent = '分類用データを読み込めませんでした。選択し直して再試行できます。'; }
  finally { if (controller === request) controller = null; }
}
type Measurement = { totalMs: number; firstFrameMs: number; interpretationMs: number; constructionMs: number; modelMs: number; classifierMs?: number; guardMs?: number; source: Resolution['source']; program: Program | null; within30s: boolean; glyphs: number; renderCpuP95Ms: number };
const timings: Measurement[] = [], frameDurations: number[] = [];
let pending: { start: number; readyAt: number; interpretationMs: number; constructionMs: number; result: Resolution } | null = null;

function open() { el('#start-prompt').hidden = true; terminal.hidden = false; el('#whisper').hidden = true; input.focus(); }
function close() { terminal.hidden = true; el('#scene').focus({ preventScroll: true }); }
function update() { el('#actions').hidden = !awakened; el<HTMLButtonElement>('#thicken').disabled = busy || !lastText || matter.glyphs.length >= 32000; el<HTMLButtonElement>('#feed').disabled = busy; el('#pause').textContent = paused ? '動かす' : '止める'; }
function say(_text: string) { /* Results stay in the terminal. */ }
function emission(text: string) {
  const rect = input.getBoundingClientRect(), ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = getComputedStyle(input).font;
  let x = rect.left - input.scrollLeft;
  return splitGlyphs(text).map(letter => { const width = ctx.measureText(letter).width; const point = { x: Math.max(rect.left + 4, Math.min(rect.right - 4, x + width / 2)), y: rect.top + rect.height / 2 }; x += width; return point; });
}
function invalidate() { sequence++; controller?.abort(); model.cancel(); controller = null; pending = null; busy = false; el<HTMLButtonElement>('#prepare-model').disabled = false; scheduler?.setTransient(false); }
function modelProgress(signal: AbortSignal) {
  return (progress: import('./scaffold-model-client').ModelProgress) => {
    if (signal.aborted) return;
    el('#connection').textContent = progress.stage === 'download' ? `モデルを取得 ${Math.round((progress.loaded ?? 0) / Math.max(1, progress.total ?? 1) * 100)}%`
      : progress.stage === 'verify' ? '確認…' : progress.stage === 'initialize' ? '解釈を準備…' : '準備完了';
  };
}
async function prepareBrowser() {
  invalidate(); const token = ++sequence, request = new AbortController(); controller = request;
  busy = true; update(); const button = el<HTMLButtonElement>('#prepare-model'); button.disabled = true;
  const timer = setTimeout(() => request.abort(), 30_000);
  try {
    const info = await model.prepare(request.signal, modelProgress(request.signal));
    if (token !== sequence || provider.value !== 'browser') return;
    browserInfo = info;
    el('#connection').textContent = `取得済み · ${(browserInfo.modelLoadMs / 1000).toFixed(1)}秒 · 処理後にモデルを解放`;
    button.textContent = 'MiniLM取得済み（約128MB）';
  } catch { if (token === sequence) el('#connection').textContent = '取得できませんでした。再試行できます。'; }
  finally { clearTimeout(timer); if (token === sequence) { busy = false; controller = null; button.disabled = false; update(); reportNative(); } }
}
async function submit(text: string, replay = false) {
  if (busy || composing || performance.now() - ended < 80) return;
  if (!splitGlyphs(text).length || text.length > MAX_INPUT_LENGTH) { status.textContent = '空白以外の文字を、短く分けて入力してください。'; return; }
  const selectedProvider = provider.value;
  if (selectedProvider !== 'rules' && text.length > 4000) { status.textContent = 'モデルの入力は4,000文字までです。分けて送ってください。'; return; }
  if (matter.glyphs.length >= 32000) { status.textContent = 'この比較版は保存する文字は32,000文字までです。「最初へ」で再開できます。'; return; }
  const start = performance.now(), token = ++sequence, wasPaused = paused;
  busy = true; paused = false; scheduler.setPaused(false); update(); status.textContent = '…';
  const requestController = new AbortController(); controller = requestController;
  const timeout = setTimeout(() => requestController.abort(), 30_000);
  const points = replay ? undefined : emission(text);
  try {
    if (token !== sequence) return;
    requestController.signal.throwIfAborted();
    let result = replay ? { program: scene.program?.spec ?? null, source: 'replay', modelMs: 0, reason: '同じ文字' } as Resolution
      : selectedProvider === 'tiny' ? (await loadTiny(requestController.signal)).guard.widgetStudentGuardV2Resolution(text)
      : selectedProvider === 'browser' ? await model.interpret(text, requestController.signal, scene.program?.spec ?? null, modelProgress(requestController.signal)) : ruleProgramResolution(text);
    if (token !== sequence) return;
    requestController.signal.throwIfAborted();
    const interpretationMs = performance.now() - start;
    const buildStart = performance.now();
    const parsed = interpret(text, matter.spec);
    const ink = replay ? lastInk : inkSelect.value === 'auto' ? parsed.ink : inkSelect.value as Ink;
    const chars = splitGlyphs(text).length, times = Math.max(1, Math.min(Number(repeat.value), Math.floor((32000 - matter.glyphs.length) / chars)));
    // Keep the rich authored single shapes in the default provider. Only an
    // explicit two-part program takes priority; tiny holds never enter this path.
    if (selectedProvider === 'rules' && !replay && result.program?.parts.length === 1 && shapeChoices(text).length) {
      result = { ...result, program: null, reason: 'authored-surface' };
    }
    // Accept material before changing geometry. At the kind limit Matter can
    // reject the entire batch; preserve the draft and current shape in that case.
    const addition = matter.add(text, times, { ink, seed: crypto.getRandomValues(new Uint32Array(1))[0] });
    if (!addition.added) {
      busy = false; paused = wasPaused; scheduler.setPaused(paused);
      status.textContent = addition.reason === 'kinds'
        ? '文字の種類は1,024種類までです。入力は残しています。'
        : '文字を追加できませんでした。入力は残しています。';
      scheduler.setTransient(false); update(); reportNative();
      return;
    }
    // Matter bounds the visible body but records the full submitted text and accepted count.
    if (result.program) {
      if (scene.setProgram(result.program)) scene.setSpec({ ...matter.spec, shape: 'condense', mode: 'surface', count: 1, arrangement: 'single', deformation: 'gentle', motion: 'calm' });
      else result = { ...result, program: null, source: selectedProvider === 'tiny' ? 'tiny-student' : 'unchanged', reason: 'unsupported-relation-geometry' };
    }
    if (selectedProvider === 'rules' && !result.program && parsed.recognized && !replay) {
      // Preserve the broader authored shapes in the small companion too.
      if (shapeChoices(text).length || parsed.spec.arrangement !== matter.spec.arrangement || parsed.spec.mode !== matter.spec.mode || parsed.spec.motion !== matter.spec.motion) {
        scene.setProgram(null); scene.setSpec(parsed.spec);
        result = { ...result, source: 'rules', reason: 'authored-surface' };
      }
    }
    browserInfo = model.inspect().lastInfo ?? browserInfo;
    lastResolution = result;
    scene.sync(points, parseFloat(getComputedStyle(input).fontSize));
    scheduler.setTransient(true); scheduler.invalidate();
    const constructionMs = performance.now() - buildStart;
    pending = { start, readyAt: matter.time + 3.95, interpretationMs, constructionMs, result };
    lastText = text; lastInk = ink; awakened = true; input.value = ''; close(); update(); saveWidget(matter, scene.program?.spec ?? null); reportNative();
  } catch (error) {
    if (token !== sequence) return;
    busy = false; status.textContent = requestController.signal.aborted ? '時間内に形を作れませんでした。今の形は保持しています。' : selectedProvider === 'tiny' ? '分類用データを確認できませんでした。HELP で選択し直して再試行できます。' : 'MiniLMを確認できませんでした。HELP から準備を再試行できます。';
    scheduler.setTransient(false); update(); reportNative();
  } finally { clearTimeout(timeout); if (controller === requestController) controller = null; }
}

async function start() {
  await document.fonts.ready;
  try { scene = new GlyphScene(el('#scene'), matter, { pixelRatio: 1, antialias: false, preserveDrawingBuffer: false, maxDrawnGlyphs: 1536, dynamicAtlas: true }); }
  catch { el('#fatal').hidden = false; el('#fatal').textContent = 'WebGL2が使えるブラウザで開いてください。'; return; }
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; ended = performance.now(); });
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.stopPropagation(); if (event.isComposing || event.keyCode === 229 || composing) return; event.preventDefault(); if (!event.repeat) void submit(input.value); } });
  const previewInk = () => { const ink = inkSelect.value === 'auto' ? interpret(input.value, matter.spec).ink ?? 'red' : inkSelect.value as Ink; input.style.color = `rgb(${COLORS[ink].map(value => value * 255).join(',')})`; };
  input.addEventListener('input', previewInk);
  inkSelect.addEventListener('change', previewInk);
  el('#feed-form').addEventListener('submit', event => { event.preventDefault(); void submit(input.value); });
  document.addEventListener('keydown', event => { if (event.isComposing || composing || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.keyCode === 229) return; if (event.key === 'Enter' && terminal.hidden && !(event.target instanceof HTMLElement && event.target.closest('button,a,select'))) { event.preventDefault(); open(); } if (event.key === 'Escape') close(); });
  el('#start-prompt').addEventListener('click', open); el('#write-word').addEventListener('click', open); el('#scene').addEventListener('open-terminal', open);
  el('#show-help').addEventListener('click', () => { open(); el<HTMLDetailsElement>('#guide').open = true; }); el('#close').addEventListener('click', close);
  el('#thicken').addEventListener('click', () => { void submit(lastText, true); });
  el('#pause').addEventListener('click', () => { if (busy) return; paused = !paused; scheduler.setPaused(paused); update(); reportNative(); });
  el('#reset').addEventListener('click', () => { invalidate(); matter.reset(); scene.reset(); lastText = ''; awakened = false; paused = false; timings.length = 0; lastResolution = null; input.value = ''; status.textContent = ''; el('#start-prompt').hidden = false; close(); scheduler.setPaused(false); scheduler.invalidate(); saveWidget(matter, null); update(); reportNative(); });
  provider.addEventListener('change', () => { invalidate(); status.textContent = providerDescription(); el('#connection').textContent = providerDescription(); update(); if (provider.value === 'tiny') void prepareTiny(); });
  el('#prepare-model').addEventListener('click', () => { provider.value = 'browser'; invalidate(); update(); void prepareBrowser(); });
  document.querySelectorAll<HTMLButtonElement>('[data-example]').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.example!; input.dispatchEvent(new Event('input')); input.focus(); }));
  el('#connection').textContent = providerDescription();
  update();
  function frame({ now, dt }: WidgetFrame) {
    const active = dt;
    matter.step(active); const began = performance.now(); scene.render(active);
    if (matter.glyphs.length > 1 && active > 0) { frameDurations.push(performance.now() - began); if (frameDurations.length > 180) frameDurations.shift(); }
    if (pending && matter.time >= pending.readyAt && !document.hidden) {
      const sorted = [...frameDurations].sort((a,b) => a-b), totalMs = performance.now() - pending.start;
      const measurement: Measurement = { totalMs, firstFrameMs: pending.interpretationMs + pending.constructionMs, interpretationMs: pending.interpretationMs, constructionMs: pending.constructionMs, modelMs: pending.result.modelMs, classifierMs: pending.result.classifierMs, guardMs: pending.result.guardMs, source: pending.result.source, program: pending.result.program, within30s: totalMs <= 30_000, glyphs: matter.glyphs.length, renderCpuP95Ms: sorted[Math.ceil(sorted.length * .95) - 1] ?? 0 };
      timings.push(measurement); if (timings.length > 30) timings.shift();
      const name = !pending.result.program ? pending.result.source === 'tiny-student' ? '形を保持（判定保留）' : pending.result.reason === 'authored-surface' ? '今の形' : '形を保持' : scene.program ? scene.program.spec.parts.map(part => labels[part.primitive]).join('・') : '今の形';
      status.textContent = `${name} · ${(totalMs / 1000).toFixed(2)}秒${measurement.within30s ? '' : '（30秒超過）'}`;
      el('#timing').textContent = `全体 ${(totalMs / 1000).toFixed(2)}秒 / 解釈 ${(measurement.interpretationMs / 1000).toFixed(3)}秒 / 構築・初回描画 ${(measurement.constructionMs / 1000).toFixed(3)}秒${measurement.source === 'tiny-student' ? ` / 分類 ${measurement.classifierMs?.toFixed(2)}ms / 規則・構築確認 ${measurement.guardMs?.toFixed(2)}ms` : ''} / 吸収完了まで計測`;
      say(status.textContent); pending = null; busy = false; scheduler.setTransient(false); update(); reportNative();
    }
    if (now - lastNativeReport > 5000) { lastNativeReport = now; reportNative(); }
  }
  const restored = restoreWidget(matter);
  if (restored) { scene.setSpec(restored.spec); scene.setProgram(restored.program); scene.sync(); awakened = matter.batches.length > 0; el('#start-prompt').hidden = awakened; lastText = matter.batches.at(-1)?.text ?? ''; lastInk = matter.batches.at(-1)?.ink; update(); }
  scheduler = new WidgetScheduler(frame, { visible: !document.hidden, calmFps: 15, transientFps: 30 });
  document.addEventListener('visibilitychange', () => { scheduler.setVisible(nativeVisible && !document.hidden); if (document.hidden) { invalidate(); saveWidget(matter, scene.program?.spec ?? null); update(); } reportNative(); });
  window.addEventListener('glyph-widget-lifecycle', event => { const visible = (event as CustomEvent<{visible:boolean}>).detail?.visible; if (typeof visible !== 'boolean') return; nativeVisible = visible; scheduler.setVisible(nativeVisible && !document.hidden); if (!visible) { invalidate(); saveWidget(matter, scene.program?.spec ?? null); update(); } reportNative(); });
  el('#scene').addEventListener('pointermove', event => { if ((event as PointerEvent).buttons) { scheduler.boost(250); scheduler.invalidate(); } });
  el('#scene').addEventListener('wheel', () => { scheduler.boost(250); scheduler.invalidate(); });
  window.addEventListener('resize', () => scheduler.invalidate());
  window.addEventListener('pagehide', () => { saveWidget(matter, scene.program?.spec ?? null); invalidate(); scheduler.stop(); });
  window.addEventListener('pageshow', () => { scheduler.setVisible(nativeVisible && !document.hidden); scheduler.start(); });
  scheduler.start();
  (window as unknown as { __WIDGET_ART__: unknown }).__WIDGET_ART__ = {
    inspect: () => ({ ...matter.inspect(), scene: scene.inspect(), busy, provider: provider.value, timings: timings.map(item => ({ ...item })), browserModel: browserInfo, tinyClassifier: { loaded: tinyModules !== null, source: 'tiny-student', assetBytes: TINY_ASSET_BYTES, frozenWeightBytes: TINY_FROZEN_WEIGHT_BYTES, decodedWeightBytes: tinyModules?.student.inspectWidgetStudent().decodedWeightBytes ?? 0, loadMs: tinyLoadMs, classifierMs: lastResolution?.classifierMs ?? null, guardMs: lastResolution?.guardMs ?? null, transformer: false, worker: false }, resolution: lastResolution, terminalOpen: !terminal.hidden, scheduler: scheduler.inspect(), worker: model.inspect(), nativeVisible, limits: { drawn: 1536, stored: 32000 }, pixelRatio: scene.renderer.getPixelRatio() }),
  };
}
function reportNative() {
  const bridge = (window as unknown as { webkit?: { messageHandlers?: { widgetMetrics?: {postMessage:(v:unknown)=>void} } } }).webkit?.messageHandlers?.widgetMetrics;
  if (!bridge || !scheduler || !scene) return;
  const counter = scheduler.inspect();
  bridge.postMessage({ frames: counter.frames, renderCount: counter.frames, updates: counter.ticks, glyphCount: matter.glyphs.length, renderedGlyphs: scene.count, storedGlyphs: matter.glyphs.length, fps: counter.mode === 'transient' ? 30 : counter.mode === 'calm' ? 15 : 0, workerActive: model.inspect().workerActive, workerCount: model.inspect().workerCount, modelLoaded: model.inspect().workerActive, visible: counter.visible, paused, busy, uptimeSeconds: performance.now()/1000 });
}
void start();
