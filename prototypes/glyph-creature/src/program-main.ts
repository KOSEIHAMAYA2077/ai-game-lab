import './style.css';
import './skeleton-style.css';
import { Matter, splitGlyphs, MAX_INPUT_LENGTH } from './model';
import { GlyphScene } from './scene';
import { interpret, COLORS, INK_NAMES, type Ink } from './language';
import { ruleProgramResolution } from './program-rules';
import type { Program } from './scaffold-program';
import { loadProgramModel, resolveProgram, type ProgramModelInfo } from './scaffold-model-client';
type Resolution = { program: Program | null; source: 'semantic-model' | 'unchanged' | 'rules' | 'replay'; modelMs: number; reason: string; evidence?: unknown };

const labels = { vase: '花瓶', blade: '刃', tube: '棒', ring: '輪', sphere: '球', box: '箱' };
const examples = ['棒の先に球', '球の上に箱', '箱を輪が貫く', '細い棒の先に大きな球', '青い細長い花瓶', 'a sphere above a box', 'a blade at the end of a tube','白いねじれた箱','ねじれた細長い刃'];
document.querySelector('#app')!.innerHTML = `
<main id="scene" tabindex="-1" aria-label="文字の空間。Enterで入力"></main>
<button id="start-prompt" aria-label="press enter">press enter</button>
<nav id="actions" aria-label="空間の操作" hidden><button id="write-word">▶ 入力</button><button id="thicken" disabled>＋文字</button><button id="show-help">? HELP</button><button id="pause">止める</button><button id="reset">最初へ</button></nav>
<p id="whisper" role="status" hidden></p>
<section id="terminal" aria-label="文字のターミナル" hidden><form id="feed-form"><div class="input-line"><label for="text-input">&gt;</label><input id="text-input" aria-label="加える文字" autocomplete="off" spellcheck="false" placeholder="enter word [enter]" /><button id="feed" aria-label="文字を加える" type="submit">↵</button><button id="close" aria-label="閉じる" type="button">×</button></div></form><p id="status" role="status"></p>
<details id="guide"><summary>? HELP</summary><p class="help">Enter で入力・送信。Esc で閉じる。ドラッグで回転、スクロールで拡大。</p><p class="help">文章が材料になります。球・箱・棒・刃・輪・花瓶を、最大2部位で組み合わせます。「先に」「上に」「貫く」で位置を変えます。指定色は今回の文字だけ。未対応の文章では今の形を保ちます。</p>
<div class="controls"><label>解釈 <select id="provider"><option value="rules">根性</option><option value="browser">小型モデル（ブラウザ）</option></select></label><label>× <select id="repeat"><option value="1">1</option><option value="64">64</option><option value="256" selected>256</option></select></label><label>文字色 <select id="ink"><option value="auto">赤 → 白</option>${Object.keys(COLORS).map(ink => `<option value="${ink}">${INK_NAMES[ink as Ink]}</option>`).join('')}</select></label></div>
<p class="help"><button type="button" id="prepare-model">小型モデルを準備（初回約128MB）</button></p>
<p id="connection" class="help">根性：指定語を拾います。小型モデル：端末内で部位・寸法・関係を解釈します。</p><p class="help">× は入力した文字の表示を繰り返す密度。最大8,192文字。モデルは部位の意味と関係を解釈し、中心線と断面から面を作ります。最大2部位＋1関係。任意のメッシュ生成ではありません。</p>
<div class="examples">${examples.map(text => `<button type="button" data-example="${text}">${text}</button>`).join('')}</div><p class="help">計算から文字の吸収が終わるまでを計測します。初回のモデル準備時間は別記録です。</p><output id="timing" class="help"></output></details></section><p id="fatal" role="alert" hidden></p>`;
const el = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const input = el<HTMLInputElement>('#text-input'), terminal = el('#terminal'), status = el('#status');
const provider = el<HTMLSelectElement>('#provider'), repeat = el<HTMLSelectElement>('#repeat'), inkSelect = el<HTMLSelectElement>('#ink');
const matter = new Matter();
let scene: GlyphScene, paused = false, busy = false, composing = false, ended = -Infinity, awakened = false;
let frameTime = performance.now(), lastText = '', lastInk: Ink | undefined, sequence = 0, controller: AbortController | null = null;
let whisperUntil = 0;
let browserInfo: ProgramModelInfo | null = null;
let lastResolution: Resolution | null = null;
type Measurement = { totalMs: number; firstFrameMs: number; interpretationMs: number; constructionMs: number; modelMs: number; source: Resolution['source']; program: Program | null; within30s: boolean; glyphs: number; renderCpuP95Ms: number };
const timings: Measurement[] = [], frameDurations: number[] = [];
let pending: { start: number; readyAt: number; interpretationMs: number; constructionMs: number; result: Resolution } | null = null;

function open() { el('#start-prompt').hidden = true; terminal.hidden = false; el('#whisper').hidden = true; input.focus(); }
function close() { terminal.hidden = true; el('#scene').focus({ preventScroll: true }); }
function update() { el('#actions').hidden = !awakened; el<HTMLButtonElement>('#thicken').disabled = busy || !lastText || matter.glyphs.length >= 8192; el<HTMLButtonElement>('#feed').disabled = busy; el('#pause').textContent = paused ? '動かす' : '止める'; }
function say(text: string) { el('#whisper').textContent = text; whisperUntil = performance.now() + 5000; }
function emission(text: string) {
  const rect = input.getBoundingClientRect(), ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = getComputedStyle(input).font;
  let x = rect.left - input.scrollLeft;
  return splitGlyphs(text).map(letter => { const width = ctx.measureText(letter).width; const point = { x: Math.max(rect.left + 4, Math.min(rect.right - 4, x + width / 2)), y: rect.top + rect.height / 2 }; x += width; return point; });
}
function invalidate() { sequence++; controller?.abort(); controller = null; pending = null; busy = false; }
async function prepareBrowser() {
  const button = el<HTMLButtonElement>('#prepare-model'); button.disabled = true;
  try {
    browserInfo = await loadProgramModel(progress => {
      el('#connection').textContent = progress.stage === 'download' ? `モデルを準備 ${Math.round((progress.loaded ?? 0) / Math.max(1, progress.total ?? 1) * 100)}%`
        : progress.stage === 'verify' ? 'モデルを確認…' : progress.stage === 'initialize' ? 'モデルを読み込み…' : 'モデル準備完了';
    });
    el('#connection').textContent = `ブラウザ内モデル準備完了 · ${(browserInfo.modelLoadMs / 1000).toFixed(1)}秒 · 入力の外部送信なし`;
    button.textContent = 'モデル準備完了';
    return browserInfo;
  } catch (error) { button.disabled = false; el('#connection').textContent = 'モデルを準備できませんでした。再試行するか「根性」で試せます。'; throw error; }
}
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'));
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
    promise.then(value => { signal.removeEventListener('abort', abort); resolve(value); }, error => { signal.removeEventListener('abort', abort); reject(error); });
  });
}
async function submit(text: string, replay = false) {
  if (busy || composing || performance.now() - ended < 80) return;
  if (!splitGlyphs(text).length || text.length > MAX_INPUT_LENGTH) { status.textContent = '空白以外の文字を、短く分けて入力してください。'; return; }
  if (provider.value !== 'rules' && [...text].length > 4000) { status.textContent = 'モデルの入力は4,000文字までです。分けて送ってください。'; return; }
  if (matter.glyphs.length >= 8192) { status.textContent = 'この比較版は8,192文字までです。「最初へ」で再開できます。'; return; }
  const start = performance.now(), token = ++sequence;
  busy = true; paused = false; update(); status.textContent = '…';
  const requestController = new AbortController(); controller = requestController;
  const timeout = setTimeout(() => requestController.abort(), 24_000);
  const points = replay ? undefined : emission(text);
  try {
    if (!replay && provider.value === 'browser' && !browserInfo) await abortable(prepareBrowser(), requestController.signal);
    if (token !== sequence) return;
    requestController.signal.throwIfAborted();
    let result = replay ? { program: scene.program?.spec ?? null, source: 'replay', modelMs: 0, reason: '同じ文字' } as Resolution
      : provider.value === 'browser' ? await resolveProgram(text, requestController.signal, scene.program?.spec ?? null) : ruleProgramResolution(text);
    if (token !== sequence) return;
    const interpretationMs = performance.now() - start;
    const buildStart = performance.now();
    const parsed = interpret(text, matter.spec);
    const ink = replay ? lastInk : inkSelect.value === 'auto' ? parsed.ink : inkSelect.value as Ink;
    const chars = splitGlyphs(text).length, times = Math.max(1, Math.min(Number(repeat.value), Math.floor((8192 - matter.glyphs.length) / chars)));
    // Limit by graphemes, not UTF-16 code units; retain the exact submitted glyphs.
    const capacity = 8192 - matter.glyphs.length;
    const safeText = chars > capacity ? splitGlyphs(text).slice(0, capacity).join('') : text;
    if (result.program) {
      if (scene.setProgram(result.program)) scene.setSpec({ ...matter.spec, shape: 'condense', mode: 'surface', count: 1, arrangement: 'single', deformation: 'gentle', motion: 'calm' });
      else result = { ...result, program: null, source: 'unchanged', reason: 'unsupported-relation-geometry' };
    }
    lastResolution = result;
    matter.add(safeText, times, { ink, seed: crypto.getRandomValues(new Uint32Array(1))[0] });
    scene.sync(points, parseFloat(getComputedStyle(input).fontSize));
    scene.render(0);
    const constructionMs = performance.now() - buildStart;
    pending = { start, readyAt: matter.time + 3.95, interpretationMs, constructionMs, result };
    lastText = safeText; lastInk = ink; awakened = true; input.value = ''; close(); update();
  } catch (error) {
    if (token !== sequence) return;
    busy = false; status.textContent = requestController.signal.aborted ? '時間内に形を作れませんでした。今の形は保持しています。' : '小型モデルを確認できませんでした。HELP から準備を再試行するか「根性」に切り替えられます。';
    console.warn(error instanceof Error ? error.message : 'Model failed'); update();
  } finally { clearTimeout(timeout); if (controller === requestController) controller = null; }
}

async function start() {
  await document.fonts.ready;
  try { scene = new GlyphScene(el('#scene'), matter); }
  catch { el('#fatal').hidden = false; el('#fatal').textContent = 'WebGL2が使えるブラウザで開いてください。'; return; }
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; ended = performance.now(); });
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.stopPropagation(); if (event.isComposing || event.keyCode === 229 || composing) return; event.preventDefault(); if (!event.repeat) void submit(input.value); } });
  input.addEventListener('input', () => { const ink = interpret(input.value, matter.spec).ink ?? (inkSelect.value === 'auto' ? 'red' : inkSelect.value as Ink); input.style.color = `rgb(${COLORS[ink].map(value => value * 255).join(',')})`; });
  el('#feed-form').addEventListener('submit', event => { event.preventDefault(); void submit(input.value); });
  document.addEventListener('keydown', event => { if (event.isComposing || composing || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.keyCode === 229) return; if (event.key === 'Enter' && terminal.hidden && !(event.target instanceof HTMLElement && event.target.closest('button,a,select'))) { event.preventDefault(); open(); } if (event.key === 'Escape') close(); });
  el('#start-prompt').addEventListener('click', open); el('#write-word').addEventListener('click', open); el('#scene').addEventListener('open-terminal', open);
  el('#show-help').addEventListener('click', () => { open(); el<HTMLDetailsElement>('#guide').open = true; }); el('#close').addEventListener('click', close);
  el('#thicken').addEventListener('click', () => { void submit(lastText, true); });
  el('#pause').addEventListener('click', () => { if (busy) return; paused = !paused; update(); });
  el('#reset').addEventListener('click', () => { invalidate(); matter.reset(); scene.reset(); lastText = ''; awakened = false; paused = false; timings.length = 0; lastResolution = null; input.value = ''; status.textContent = ''; el('#start-prompt').hidden = false; close(); update(); });
  provider.addEventListener('change', () => { invalidate(); status.textContent = provider.value === 'rules' ? '指定語で形を作ります。' : 'このブラウザ内の小型モデルを使います。初回はモデル準備が必要です。'; update(); });
  el('#prepare-model').addEventListener('click', () => { provider.value = 'browser'; invalidate(); update(); void prepareBrowser().catch(() => {}); });
  document.querySelectorAll<HTMLButtonElement>('[data-example]').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.example!; input.dispatchEvent(new Event('input')); input.focus(); }));
  el('#connection').textContent = '「根性」は指定語で組み合わせます。「小型モデルを準備」で無料モデルを取得し、このブラウザ内で処理します。';
  update();
  function frame(now: number) {
    const dt = Math.min((now - frameTime) / 1000, .05); frameTime = now;
    const active = paused || document.hidden ? 0 : dt;
    matter.step(active); const began = performance.now(); scene.render(active);
    if (matter.glyphs.length > 1 && active > 0) { frameDurations.push(performance.now() - began); if (frameDurations.length > 180) frameDurations.shift(); }
    if (pending && matter.time >= pending.readyAt && !document.hidden) {
      const sorted = [...frameDurations].sort((a,b) => a-b), totalMs = performance.now() - pending.start;
      const measurement: Measurement = { totalMs, firstFrameMs: pending.interpretationMs + pending.constructionMs, interpretationMs: pending.interpretationMs, constructionMs: pending.constructionMs, modelMs: pending.result.modelMs, source: pending.result.source, program: pending.result.program, within30s: totalMs <= 30_000, glyphs: matter.glyphs.length, renderCpuP95Ms: sorted[Math.ceil(sorted.length * .95) - 1] ?? 0 };
      timings.push(measurement); if (timings.length > 30) timings.shift();
      const name = !pending.result.program ? '形を保持' : scene.program ? scene.program.spec.parts.map(part => labels[part.primitive]).join('・') : '今の形';
      status.textContent = `${name} · ${(totalMs / 1000).toFixed(2)}秒${measurement.within30s ? '' : '（30秒超過）'}`;
      el('#timing').textContent = `全体 ${(totalMs / 1000).toFixed(2)}秒 / 解釈 ${(measurement.interpretationMs / 1000).toFixed(3)}秒 / 構築・初回描画 ${(measurement.constructionMs / 1000).toFixed(3)}秒 / 吸収完了まで計測`;
      say(status.textContent); pending = null; busy = false; update();
    }
    el('#whisper').hidden = !terminal.hidden || now > whisperUntil;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  (window as unknown as { __PROGRAM_ART__: unknown }).__PROGRAM_ART__ = {
    inspect: () => ({ ...matter.inspect(), scene: scene.inspect(), busy, provider: provider.value, timings: timings.map(item => ({ ...item })), browserModel: browserInfo, resolution: lastResolution, terminalOpen: !terminal.hidden }),
  };
}
void start();
