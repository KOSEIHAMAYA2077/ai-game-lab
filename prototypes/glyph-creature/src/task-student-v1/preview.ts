import './preview.css';
import { Matter, MAX_INPUT_LENGTH, splitGlyphs } from '../model';
import { COLORS, SHAPES, SHAPE_NAMES, interpret, shapeChoices, type Shape } from '../language';
import { WidgetScheduler } from '../widget-scheduler';
import { TaskStudentScene, deformationParams, type TaskAttributes } from './deformation';
// @ts-ignore The sibling frozen inference module is plain JavaScript.
import { loadModel, predict } from './inference.mjs';
// @ts-ignore This helper is shared verbatim with the independent Node baseline.
import { ruleAttributes } from './rule-modifiers.mjs';
// @ts-ignore Standalone CPU runtime uses only browser APIs.
import { loadStaticEncoder } from './static-runtime/encoder.mjs';
// @ts-ignore Frozen dense task heads are a plain JavaScript module.
import { loadDenseModel, predictDense } from './dense-inference.mjs';

type Provider = 'static-seed' | 'static-bonsai8' | 'student' | 'seed-baseline' | 'bonsai4' | 'rules';
type Prediction = TaskAttributes & { shape: Shape | 'hold'; score: number; margin: number; coverage: number; modelMs: number; source: Provider; error?: string };
type RawPrediction = Omit<Prediction, 'source'>;
const limits = { stored: 32_000, drawn: 1_536 };
const modelPaths = {
  'static-seed': new URL('../../../../experiments/bonsai-task-student-v1/artifacts/static-seed-model.json', import.meta.url).href,
  'static-bonsai8': new URL('../../../../experiments/bonsai-task-student-v1/artifacts/static-bonsai8-model.json', import.meta.url).href,
  student: new URL('../../../../experiments/bonsai-task-student-v1/artifacts/student-model.json', import.meta.url).href,
  'seed-baseline': new URL('../../../../experiments/bonsai-task-student-v1/artifacts/seed-model.json', import.meta.url).href,
  bonsai4: new URL('../../../../experiments/bonsai-task-student-v1/artifacts/bonsai4-model.json', import.meta.url).href,
};
const modelCache = new Map<Exclude<Provider, 'rules'>, Promise<unknown>>();
const modelLoads: Partial<Record<Provider, { loadMs: number; bytes: number }>> = {};
let encoderPromise: Promise<unknown> | null = null;
let encoderStats: unknown = null;
const matter = new Matter();
let scene: TaskStudentScene;
let scheduler: WidgetScheduler;
let busy = false, paused = false, nativeVisible = true, awakened = false;
let composing = false, compositionEndedAt = -Infinity, sequence = 0;
let lastText = '', lastPrediction: Prediction | null = null;
let additions = 0, predictionCalls = 0;
let comparisons: Prediction[] = [];

document.querySelector('#app')!.innerHTML = `
  <main id="scene" tabindex="-1" aria-label="文字の空間。Enterで入力"></main>
  <button id="start-prompt">press enter</button>
  <nav id="actions" aria-label="操作" hidden>
    <button id="write-word">&gt; 入力</button><button id="show-help">? HELP / 比較</button>
    <button id="pause">止める</button><button id="reset">最初へ</button>
  </nav>
  <section id="terminal" aria-label="ターミナル" hidden>
    <form id="feed-form"><div class="input-line">
      <label for="text-input">&gt;</label>
      <input id="text-input" aria-label="加える文字" autocomplete="off" spellcheck="false" placeholder="enter word [enter]" />
      <button id="feed" type="submit" aria-label="加える">↵</button>
      <button id="close" type="button" aria-label="閉じる">×</button>
    </div></form>
    <p id="status" role="status"></p>
    <details id="guide"><summary>? HELP / 比較</summary>
      <div class="controls">
        <label>model <select id="provider"><option value="static-seed">意味 / seed</option><option value="static-bonsai8">意味 / Bonsai追加</option><option value="student">文字 / Bonsai8</option><option value="bonsai4">文字 / Bonsai4</option><option value="seed-baseline">文字 / seed</option><option value="rules">rules</option></select></label>
        <label>× <select id="repeat"><option value="1">1</option><option value="64" selected>64</option><option value="256">256</option></select></label>
        <button id="compare" type="button" disabled>同じ入力を比較</button>
        <output>保存 off</output>
      </div>
      <pre id="compare-results" aria-live="polite"></pre>
      <p class="keys">Enter 入力・送信 / Esc 閉じる / drag 回転 / scroll 拡大</p>
      <p class="keys">実験用。否定文にも反応することがあります。</p>
    </details>
  </section>
  <p id="fatal" role="alert" hidden></p>`;
const el = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const input = el<HTMLInputElement>('#text-input'), terminal = el('#terminal');
const provider = el<HTMLSelectElement>('#provider'), repeat = el<HTMLSelectElement>('#repeat');
const status = el('#status'), guide = el<HTMLDetailsElement>('#guide');

function open() { el('#start-prompt').hidden = true; terminal.hidden = false; input.focus(); }
function close() { terminal.hidden = true; el('#scene').focus({ preventScroll: true }); }
function update() {
  el('#actions').hidden = !awakened || !terminal.hidden;
  el<HTMLButtonElement>('#feed').disabled = busy;
  el<HTMLButtonElement>('#compare').disabled = busy || !lastText;
  el('#pause').textContent = paused ? '動かす' : '止める';
  provider.disabled = busy;
}
const providers: Provider[] = ['static-seed', 'static-bonsai8', 'student', 'bonsai4', 'seed-baseline', 'rules'];
function selectedProvider(): Provider { return providers.includes(provider.value as Provider) ? provider.value as Provider : 'static-seed'; }

async function getModel(source: Exclude<Provider, 'rules'>) {
  let pending = modelCache.get(source);
  if (!pending) {
    const began = performance.now();
    pending = fetch(modelPaths[source]).then(async response => {
      if (!response.ok) throw new Error(`model-http-${response.status}`);
      const text = await response.text();
      const model = source.startsWith('static-') ? loadDenseModel(JSON.parse(text)) : loadModel(JSON.parse(text));
      modelLoads[source] = { loadMs: performance.now() - began, bytes: new TextEncoder().encode(text).length };
      return model;
    }).catch(error => { modelCache.delete(source); throw error; });
    modelCache.set(source, pending);
  }
  return pending;
}

async function getEncoder() {
  if (!encoderPromise) encoderPromise = loadStaticEncoder().then((encoder: { inspect: () => unknown; assetLoadMs: number }) => {
    encoderStats = { details: encoder.inspect(), assetLoadMs: encoder.assetLoadMs }; return encoder;
  }).catch((error: unknown) => { encoderPromise = null; throw error; });
  return encoderPromise;
}

function rulesPrediction(text: string): RawPrediction {
  const choices = shapeChoices(text);
  const shape: Shape | 'hold' = choices.length ? choices[0] : 'hold';
  return { shape, score: shape === 'hold' ? 0 : 1, margin: shape === 'hold' ? 0 : 1, coverage: shape === 'hold' ? 0 : 1,
    ...ruleAttributes(text), modelMs: 0 };
}

async function prediction(text: string, source: Provider): Promise<Prediction> {
  const started = performance.now();
  let raw: RawPrediction;
  if (source === 'rules') raw = rulesPrediction(text);
  else if (source.startsWith('static-')) {
    const [model, encoder] = await Promise.all([getModel(source), getEncoder()]);
    raw = predictDense(model, encoder, text) as RawPrediction;
  } else raw = predict(await getModel(source), text) as RawPrediction;
  predictionCalls++;
  const number = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return {
    source,
    shape: raw.shape === 'hold' || (SHAPES as readonly string[]).includes(raw.shape) ? raw.shape : 'hold',
    score: number(raw.score), margin: number(raw.margin), coverage: number(raw.coverage),
    length: raw.length === 'long' || raw.length === 'short' ? raw.length : 'neutral',
    width: raw.width === 'wide' || raw.width === 'narrow' ? raw.width : 'neutral',
    bend: raw.bend === 'curved' ? 'curved' : 'straight',
    modelMs: source === 'rules' ? performance.now() - started : number(raw.modelMs),
  };
}

function held(source: Provider, error: string): Prediction {
  return { source, shape: 'hold', score: 0, margin: 0, coverage: 0, length: 'neutral', width: 'neutral', bend: 'straight', modelMs: 0, error };
}

function resultLine(result: Prediction) {
  const form = result.shape === 'hold' ? 'hold' : `${SHAPE_NAMES[result.shape]} (${result.shape})`;
  return `${result.source} → ${form}\nscore ${result.score.toFixed(3)}  margin ${result.margin.toFixed(3)}  coverage ${result.coverage.toFixed(3)}  ${result.modelMs.toFixed(3)}ms\n${result.length} / ${result.width} / ${result.bend}${result.error ? `\n${result.error}` : ''}`;
}
function showResults() {
  el('#compare-results').textContent = comparisons.length ? comparisons.map(resultLine).join('\n\n') : lastPrediction ? resultLine(lastPrediction) : '';
}

function emission(text: string) {
  const rect = input.getBoundingClientRect(), context = document.createElement('canvas').getContext('2d')!;
  context.font = getComputedStyle(input).font;
  let x = rect.left - input.scrollLeft;
  return splitGlyphs(text).map(letter => {
    const width = context.measureText(letter).width;
    const point = { x: Math.max(rect.left + 4, Math.min(rect.right - 4, x + width / 2)), y: rect.top + rect.height / 2 };
    x += width; return point;
  });
}

async function submit(text: string, options: { repeat?: number; seed?: number; source?: Provider; screenIntake?: boolean } = {}) {
  if (busy) return { added: 0, busy: true };
  const chosen = options.source ?? selectedProvider();
  if (!splitGlyphs(text).length) { status.textContent = ''; return { added: 0, empty: true }; }
  if (text.length > MAX_INPUT_LENGTH) { status.textContent = `入力は${MAX_INPUT_LENGTH.toLocaleString()}文字まで。`; return { added: 0, limited: true }; }
  const parsed = interpret(text, matter.spec, null);
  const points = options.screenIntake === false ? undefined : emission(text);
  // The material is accepted before any model await. A held or failed judgment
  // still adds these exact glyphs and only this batch receives its specified ink.
  const addition = matter.add(text, options.repeat ?? Number(repeat.value), { ink: parsed.ink, seed: options.seed });
  if (!addition.added) {
    status.textContent = addition.reason === 'kinds' ? '文字の種類は1,024まで。' : '材料は32,000文字まで。';
    return addition;
  }
  additions += addition.added;
  scene.sync(points, parseFloat(getComputedStyle(input).fontSize));
  scheduler.invalidate();
  awakened = true; lastText = text; comparisons = []; input.value = '';
  busy = true; const token = ++sequence;
  status.textContent = '…'; update(); close(); update();
  let result: Prediction;
  try { result = await prediction(text, chosen); }
  catch { result = held(chosen, 'モデルを読み込めませんでした'); }
  if (token !== sequence) return { ...addition, canceled: true };
  lastPrediction = result;
  if (result.shape !== 'hold') {
    scene.setSpec({ ...matter.spec, shape: result.shape, motion: parsed.spec.motion });
    scene.setDeformation(deformationParams(result));
  } else if (parsed.spec.motion !== matter.spec.motion) {
    scene.setSpec({ ...matter.spec, motion: parsed.spec.motion });
  }
  busy = false;
  status.textContent = `${result.shape === 'hold' ? 'hold' : SHAPE_NAMES[result.shape]} · +${addition.added.toLocaleString()}${addition.limited ? ' · 上限' : ''}`;
  showResults(); scheduler.invalidate(); update();
  return { ...addition, prediction: result };
}

async function compare() {
  if (busy || !lastText) return;
  const text = lastText, token = sequence;
  busy = true; update();
  const results: Prediction[] = [];
  for (const source of providers) {
    try { results.push(await prediction(text, source)); }
    catch { results.push(held(source, 'モデルを読み込めませんでした')); }
    if (token !== sequence) return;
  }
  comparisons = results; busy = false; showResults(); update();
}

function reset(seed = 1) {
  sequence++; busy = false; paused = false; lastText = ''; lastPrediction = null; comparisons = [];
  additions = 0; matter.reset(seed); scene.reset(); scheduler.setPaused(false); scheduler.invalidate();
  awakened = false; input.value = ''; status.textContent = ''; showResults();
  guide.open = false; el('#start-prompt').hidden = false; close(); update();
}

function inspect() {
  return {
    ...matter.inspect(), scene: scene.inspect(), bounds: scene.deformationBounds(),
    params: { ...scene.params }, targetParams: { ...scene.targetParams }, prediction: lastPrediction ? { ...lastPrediction } : null,
    comparisons: comparisons.map(value => ({ ...value })), source: selectedProvider(), busy, paused,
    addedGlyphs: additions, predictionCalls, modelLoads: { ...modelLoads }, loadedModels: [...modelCache.keys()],
    encoderStats,
    glyphs: matter.glyphs.map(value => ({ id: value.id, text: value.text, ink: value.ink ?? 'auto' })),
    terminalOpen: !terminal.hidden, scheduler: scheduler.inspect(), nativeVisible,
    saving: false, storageKey: null, limits, pixelRatio: scene.renderer.getPixelRatio(),
  };
}

async function start() {
  await document.fonts.ready;
  try {
    scene = new TaskStudentScene(el('#scene'), matter, { pixelRatio: 1, antialias: false, preserveDrawingBuffer: false, maxDrawnGlyphs: limits.drawn, dynamicAtlas: true });
    scene.installDeformation();
  } catch {
    el('#fatal').hidden = false; el('#fatal').textContent = 'WebGL2が使えるブラウザで開いてください。'; return;
  }
  scheduler = new WidgetScheduler(({ dt }) => { matter.step(dt); scene.render(dt); }, { visible: !document.hidden, calmFps: 15, transientFps: 15 });
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; compositionEndedAt = performance.now(); });
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.stopPropagation();
    if (event.isComposing || event.keyCode === 229 || composing || performance.now() - compositionEndedAt < 80) return;
    event.preventDefault(); if (!event.repeat) void submit(input.value);
  });
  el('#feed-form').addEventListener('submit', event => { event.preventDefault(); if (!composing) void submit(input.value); });
  input.addEventListener('input', () => {
    const ink = interpret(input.value, matter.spec, null).ink ?? 'red';
    input.style.color = `rgb(${COLORS[ink].map(v => Math.round(v * 255)).join(',')})`;
  });
  document.addEventListener('keydown', event => {
    if (event.isComposing || composing || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.keyCode === 229) return;
    if (event.key === 'Enter' && terminal.hidden && !(event.target instanceof HTMLElement && event.target.closest('button,a,select'))) { event.preventDefault(); open(); update(); }
    if (event.key === 'Escape') { close(); update(); }
  });
  el('#start-prompt').addEventListener('click', () => { open(); update(); });
  el('#write-word').addEventListener('click', () => { open(); update(); });
  el('#scene').addEventListener('open-terminal', () => { open(); update(); });
  el('#show-help').addEventListener('click', () => { open(); guide.open = true; showResults(); update(); });
  el('#close').addEventListener('click', () => { close(); update(); });
  el('#compare').addEventListener('click', () => { void compare(); });
  el('#pause').addEventListener('click', () => { paused = !paused; scheduler.setPaused(paused); update(); });
  el('#reset').addEventListener('click', () => { reset(); });
  provider.addEventListener('change', () => { comparisons = []; showResults(); });
  document.addEventListener('visibilitychange', () => { scheduler.setVisible(nativeVisible && !document.hidden); });
  window.addEventListener('glyph-widget-lifecycle', event => {
    const visible = (event as CustomEvent<{ visible: boolean }>).detail?.visible;
    if (typeof visible === 'boolean') { nativeVisible = visible; scheduler.setVisible(nativeVisible && !document.hidden); }
  });
  el('#scene').addEventListener('pointermove', event => { if ((event as PointerEvent).buttons) scheduler.invalidate(); });
  el('#scene').addEventListener('wheel', () => { scheduler.invalidate(); });
  window.addEventListener('resize', () => { scheduler.invalidate(); });
  window.addEventListener('pagehide', () => { scheduler.stop(); });
  window.addEventListener('pageshow', () => { scheduler.setVisible(nativeVisible && !document.hidden); scheduler.start(); });
  (window as unknown as { __TASK_STUDENT_V1__: unknown }).__TASK_STUDENT_V1__ = {
    inspect, submit, reset, compare,
    selectModel: (source: Provider) => { if (providers.includes(source)) provider.value = source; },
    setVisible: (visible: boolean) => { nativeVisible = visible; scheduler.setVisible(visible && !document.hidden); },
    setPaused: (value: boolean) => { paused = value; scheduler.setPaused(value); update(); },
    step: (seconds: number) => { const dt = Number.isFinite(seconds) ? Math.max(0, Math.min(60, seconds)) : 0; matter.step(dt); scene.render(dt); return inspect(); },
    setTestPose: (yaw: number | null) => { scene.testYaw = yaw; scheduler.invalidate(); },
    setShape: (shape: Shape) => { if ((SHAPES as readonly string[]).includes(shape)) { scene.setSpec({ ...matter.spec, shape }); scheduler.invalidate(); } },
  };
  update(); scheduler.start();
}
void start();
