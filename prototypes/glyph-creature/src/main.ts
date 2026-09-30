import './style.css';
import { FORMS, MAX_GLYPHS, MAX_INPUT_LENGTH, Matter, splitGlyphs, type Form } from './model';
import { GlyphScene } from './scene';
import { interpretWithModel } from './learned-shape';
import { COLORS, INK_NAMES, SHAPE_NAMES, SHAPES, interpret, describe, type Ink, type Shape } from './language';
import { setupCompanion } from './companion';
import { randomUnit } from './shapes';

const names: Record<Form, string> = { condense: '凝縮', vortex: '渦', orbit: '軌道', mobius: 'メビウス' };
const examples = ['流れる 球体', '表面 立方体', '今夜は赤い花火を眺めている。', '呼吸する 黄色い立方体', '流れる 波打つ メビウスの輪', '表面 メビウスの輪', '流れる 赤 四角形', 'だんご', '円 8個', '円環 鎖', 'オメガ メビウスの輪', '円環 大小', '表面 呼吸する だんご', '流れる 十字', '通常の動き'];

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main id="scene" tabindex="-1" aria-label="文字の空間。Enterで始める"></main>
  <button id="start-prompt" type="button" aria-label="press enter"><canvas id="prompt-ink" aria-hidden="true"></canvas></button>
  <nav id="actions" aria-label="空間の操作" hidden><button id="write-word">▶ 入力</button><button id="choose-form">◇ 形</button><button id="show-help">? HELP</button><a href="./?write">✎ 書く</a><a href="./strokes.html">一画</a><button id="show-diary">日記</button></nav>
  <nav id="quick-forms" aria-label="形のボタン" hidden>${SHAPES.map(shape => `<button type="button" data-shape="${shape}">${SHAPE_NAMES[shape]}</button>`).join('')}</nav>
  <p id="whisper" aria-live="polite" hidden></p>
  <section id="terminal" hidden aria-label="文字のターミナル">
    <form id="feed-form"><div class="input-line"><label for="text-input" aria-label="文字を入力">&gt;</label><input id="text-input" type="text" autocomplete="off" spellcheck="false" aria-label="加える文字" aria-describedby="input-help" placeholder="enter word [enter]" /><button id="feed" type="submit" aria-label="文字を加える">↵</button></div></form>
    <p id="input-help">「エンター」と入力して、Enter。文章も入力できます。</p>
    <p id="status" role="status" aria-live="polite"></p>
    <details id="guide"><summary>❔ HELP — 入力 / 操作</summary>
      <p id="lesson"></p><div class="controls"><button id="lesson-try" type="button">入力例を使う</button><button id="lesson-next" type="button">次へ →</button></div>
      <div class="examples" aria-label="入力例">${examples.map(text => `<button type="button" data-example="${text}">${text}</button>`).join('')}</div>
      <p class="help">入力例は書き換えられます。形・流れ・色・個数に「呼吸」「波打つ」を組み合わせられます。「通常」で変形を戻します。候補が複数ある場合は、送信ごとに一つ選びます。入力した文章全体を文字として追加します。</p>
      <label class="help"><input id="learned-shapes" type="checkbox" /> 学習した形を使う（実験）</label><p class="help">サイコロ、ドーナツなどの言い換えを、自作モデルで推定します。この実験をオンにすると、形の選択はモデルを優先します。</p>
      <nav aria-label="形を選ぶ">${FORMS.map(form => `<button type="button" data-form="${form}" aria-pressed="${form === 'condense'}">${names[form]}</button>`).join('')}</nav>
      <div class="controls"><label for="repeat">×</label><select id="repeat" aria-label="繰り返し回数"><option value="1">1</option><option value="16">16</option><option value="64" selected>64</option><option value="256">256</option></select><label for="ink">文字色</label><select id="ink" aria-label="追加文字の色"><option value="auto">赤 → 白</option>${Object.keys(COLORS).map(ink => `<option value="${ink}">${INK_NAMES[ink as Ink]}</option>`).join('')}</select></div>
      <p class="help">× は入力した文字の繰り返し。指定した色は今回の文字だけに残ります。</p>
      <div class="controls"><button id="repeat-last" type="button" disabled>もう一度</button><button id="pause" type="button" aria-pressed="false">止める</button><button id="reset" type="button">最初へ</button><button id="close" type="button">閉じる</button></div>
    </details>
    <p class="help keys">Enter で送る　Esc で閉じる</p>
  </section>
  <p id="fatal" role="alert" hidden></p>
`;

const el = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const input = el<HTMLInputElement>('#text-input');
const terminal = el<HTMLElement>('#terminal');
const repeat = el<HTMLSelectElement>('#repeat');
const inkSelect = el<HTMLSelectElement>('#ink');
const status = el<HTMLParagraphElement>('#status');
const repeatLast = el<HTMLButtonElement>('#repeat-last');
const matter = new Matter();
let scene: GlyphScene;
let paused = false, composing = false, introDone = false, awakened = false;
let companion: Awaited<ReturnType<typeof setupCompanion>> | undefined;
let lesson = 0;
const lessons = [
  ['1 / 5　「流れる 球体」で、球の表面全体に文字が流れます。', '流れる 球体'],
  ['2 / 5　「表面 立方体」で、文字が六つの面に沿って流れます。', '表面 立方体'],
  ['3 / 5　色の指定は、今回追加する文字だけに適用されます。', '黄色い文字が立方体の表面を流れる'],
  ['4 / 5　「呼吸する 立方体」「波打つ メビウス」で変形を指定します。動きだけの指定も可能です。「通常」で戻します。', '表面 呼吸する 黄色い立方体'],
  ['5 / 5　「花火」「円 8個」「円環 鎖」も入力できます。ドラッグで回転、スクロールで拡大・縮小します。', '夜空に赤い花火がひらく'],
];
let compositionEnded = -Infinity;
let lastText = '', lastInk: Ink | undefined;
let frameTime = performance.now();
let whisperUntil = 0;

// Original 5×7 bitmap letterforms; no external font download.
const pixels: Record<string, string[]> = {
  p: ['00000','11110','10001','10001','11110','10000','10000'], r: ['00000','10110','11001','10000','10000','10000','00000'],
  e: ['00000','01110','10001','11111','10000','01110','00000'], s: ['00000','01111','10000','01110','00001','11110','00000'],
  n: ['00000','10110','11001','10001','10001','10001','00000'], t: ['00100','11111','00100','00100','00101','00010','00000'],
};
const promptCanvas = el<HTMLCanvasElement>('#prompt-ink');
promptCanvas.width = 65; promptCanvas.height = 7;
const promptContext = promptCanvas.getContext('2d')!; promptContext.fillStyle = '#fff';
[...'press enter'].forEach((char, index) => pixels[char]?.forEach((row, y) => [...row].forEach((on, x) => { if (on === '1') promptContext.fillRect(index * 6 + x, y, 1, 1); })));

function notice(message: string, duration = 6) { el('#whisper').textContent = message; whisperUntil = matter.time + duration; }
function openTerminal() { terminal.hidden = false; el('#whisper').hidden = true; input.focus(); }
function closeTerminal() { terminal.hidden = true; if (!companion?.writer) el('#scene').focus({ preventScroll: true }); }
function selectedInk(): Ink | undefined { return inkSelect.value === 'auto' ? undefined : inkSelect.value as Ink; }
function previewInk() {
  const ink = interpret(input.value, matter.spec).ink ?? selectedInk() ?? 'red';
  input.style.color = `rgb(${COLORS[ink].map(v => Math.round(v * 255)).join(',')})`;
}
function updateUI() {
  el('#actions').hidden = !awakened || Boolean(companion?.viewer);
  el('#lesson').textContent = lessons[lesson][0];
  document.querySelectorAll<HTMLButtonElement>('[data-form]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.form === matter.form)));
  repeatLast.disabled = !lastText || matter.glyphs.length >= MAX_GLYPHS;
  el('#pause').textContent = paused ? '動かす' : '止める';
  el('#pause').setAttribute('aria-pressed', String(paused));
  previewInk();
}

function inputSources(text: string) {
  const rect = input.getBoundingClientRect(), style = getComputedStyle(input);
  const ctx = document.createElement('canvas').getContext('2d')!; ctx.font = style.font;
  let cursor = rect.left - input.scrollLeft;
  const points: { x: number; y: number }[] = [];
  for (const part of new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(text.normalize('NFC'))) {
    const width = ctx.measureText(part.segment).width;
    if (splitGlyphs(part.segment).length) points.push({ x: Math.max(rect.left + 4, Math.min(rect.right - 4, cursor + width / 2)), y: rect.top + rect.height / 2 });
    cursor += width;
  }
  return { points, fontSize: parseFloat(style.fontSize) };
}

function begin() {
  if (companion?.viewer || (companion && !companion.canEdit()) || (document.querySelector<HTMLElement>('#diary')?.hidden === false)) return;
  introDone = true; el('#start-prompt').hidden = true;
  openTerminal(); updateUI();
}

function addText(text: string, times: number, forcedInk?: Ink, writing = false): boolean {
  if (companion && (!companion.canEdit() || !companion.rollover())) return false;
  if (text.length > MAX_INPUT_LENGTH || !splitGlyphs(text).length) {
    status.textContent = text.length > MAX_INPUT_LENGTH ? '入力が長すぎます。短く分けて入力してください。' : '空白以外の文字を入力してください。'; if (!writing) input.focus(); return false;
  }
  let emission = inputSources(text);
  if (writing) {
    const rect = el<HTMLTextAreaElement>('#manuscript').getBoundingClientRect();
    emission = { points: splitGlyphs(text).map((_, i) => ({ x: rect.left + 12 + (i % 24) * 10, y: rect.top + 24 + Math.floor(i / 24) * 24 })), fontSize: 17 };
  }
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]; let pickIndex = 0;
  const parsed = interpretWithModel(text, matter.spec, el<HTMLInputElement>('#learned-shapes').checked, () => randomUnit(seed + pickIndex++));
  const spec = parsed.spec, ink = forcedInk ?? parsed.ink ?? selectedInk(), interpreted = parsed.recognized;
  const result = matter.add(text, times, { ink, seed });
  if (result.added) {
    scene.setSpec(interpreted ? spec : matter.spec); scene.sync(emission.points, emission.fontSize); paused = false;
    lastText = text; lastInk = ink; input.value = '';
    const first = !awakened; awakened = true;
    el('#input-help').textContent = '文字・文章を入力して、Enter で追加。';
    if (first && !writing) notice('Enter で追加入力。? HELP で操作と入力例を表示。', 14);
    const meaning = interpreted ? `${parsed.learned ? '学習した形: ' : ''}${describe(matter.spec, ink)}` : `現在の形に文字を追加しました。`;
    status.textContent = meaning;
    if (!first || writing) notice(meaning, 5);
    if (!writing) companion?.changed();
  }
  if (result.limited) status.textContent = `${result.added.toLocaleString('ja-JP')}文字を追加。合計32,000文字・1,024種類までです。`;
  updateUI();
  if (result.added && !result.limited && !writing) closeTerminal();
  return result.added > 0;
}

async function start() {
  await document.fonts.ready;
  try { scene = new GlyphScene(el('#scene'), matter); }
  catch (error) { el('#fatal').hidden = false; el('#fatal').textContent = '描画を開始できませんでした。WebGL2が使えるブラウザで開いてください。'; console.error(error); return; }
  companion = await setupCompanion(matter, scene, {
    feed: text => addText(text, 1, undefined, true),
    refresh: updateUI,
    pause: value => { paused = value; updateUI(); },
  });
  if (companion.writer || companion.viewer) { introDone = true; awakened = true; el('#start-prompt').hidden = true; }
  const imeActive = (event: KeyboardEvent) => composing || event.isComposing || event.keyCode === 229 || performance.now() - compositionEnded < 80;
  input.addEventListener('input', previewInk); inkSelect.addEventListener('change', previewInk);
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; compositionEnded = performance.now(); previewInk(); });
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.stopPropagation();
    if (composing || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (!imeActive(event) && !event.repeat) void addText(input.value, Number(repeat.value));
  });
  document.addEventListener('keydown', event => {
    if (imeActive(event) || event.repeat || event.ctrlKey || event.metaKey || event.altKey || companion?.viewer || (event.target instanceof HTMLElement && event.target.closest('#writing, #diary'))) return;
    if (document.querySelector<HTMLElement>('#diary')?.hidden === false) return;
    if (event.key === 'Enter' && terminal.hidden && !(event.target instanceof HTMLElement && event.target.closest('button, a, select'))) { event.preventDefault(); begin(); }
    else if (event.key === 'Escape' && !terminal.hidden) { event.preventDefault(); closeTerminal(); }
  });
  el<HTMLFormElement>('#feed-form').addEventListener('submit', event => { event.preventDefault(); if (!composing && performance.now() - compositionEnded >= 80) void addText(input.value, Number(repeat.value)); });
  el('#start-prompt').addEventListener('click', begin);
  el('#write-word').addEventListener('click', begin);
  el('#show-help').addEventListener('click', () => { begin(); el<HTMLDetailsElement>('#guide').open = true; });
  el('#show-diary').addEventListener('click', () => { closeTerminal(); companion?.openGallery(); });
  el('#choose-form').addEventListener('click', () => { el('#quick-forms').hidden = !el('#quick-forms').hidden; });
  document.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach(button => button.addEventListener('click', () => {
    if (companion && !companion.rollover()) return;
    scene.setSpec({ ...matter.spec, shape: button.dataset.shape as Shape, count: 1, arrangement: 'single', deformation: 'gentle' });
    el('#quick-forms').hidden = true; paused = false; updateUI(); companion?.changed();
  }));
  el('#lesson-next').addEventListener('click', () => { lesson = (lesson + 1) % lessons.length; updateUI(); });
  el('#lesson-try').addEventListener('click', () => { input.value = lessons[lesson][1]; previewInk(); input.focus(); });
  el('#scene').addEventListener('open-terminal', begin);
  el('#close').addEventListener('click', closeTerminal);
  repeatLast.addEventListener('click', () => { input.value = lastText; void addText(lastText, Number(repeat.value), lastInk); });
  document.querySelectorAll<HTMLButtonElement>('[data-example]').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.example!; previewInk(); input.focus(); }));
  document.querySelectorAll<HTMLButtonElement>('[data-form]').forEach(button => button.addEventListener('click', () => { if (companion && !companion.rollover()) return; scene.setForm(button.dataset.form as Form); paused = false; updateUI(); closeTerminal(); companion?.changed(); }));
  el('#pause').addEventListener('click', () => { paused = !paused; updateUI(); closeTerminal(); });
  el('#reset').addEventListener('click', () => {
    if (companion && !companion.rollover()) return;
    matter.reset(); scene.reset(); lastText = ''; lastInk = undefined; paused = false; introDone = false; awakened = false; lesson = 0;
    input.value = ''; el<HTMLInputElement>('#learned-shapes').checked = false; repeat.value = '64'; inkSelect.value = 'auto'; status.textContent = ''; whisperUntil = 0;
    el('#start-prompt').hidden = Boolean(companion?.writer || companion?.viewer); el('#quick-forms').hidden = true; awakened = Boolean(companion?.writer); el('#input-help').textContent = '「エンター」と入力して、Enter。文章も入力できます。'; el<HTMLDetailsElement>('#guide').open = false;
    updateUI(); closeTerminal(); companion?.changed();
  });
  el('#scene').addEventListener('webglcontextlost', event => { event.preventDefault(); el('#fatal').hidden = false; el('#fatal').textContent = '描画が中断されました。ページを再読み込みしてください。'; }, true);
  updateUI();
  function frame(now: number) {
    const dt = Math.min((now - frameTime) / 1000, .05); frameTime = now;
    const activeDt = paused || document.hidden ? 0 : dt;
    matter.step(activeDt); scene.render(activeDt);
    el('#whisper').hidden = !terminal.hidden || !introDone || matter.time > whisperUntil || (awakened && matter.time < 3);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (import.meta.env.DEV) {
    (window as unknown as { __GLYPH_ART__: unknown }).__GLYPH_ART__ = {
      inspect: () => ({ ...matter.inspect(), paused, introDone, awakened, terminalOpen: !terminal.hidden, scene: scene.inspect() }),
      pause: (value = true) => { paused = value; updateUI(); },
      step: (ms: number) => { paused = true; matter.step(ms / 1000); scene.render(Math.min(ms / 1000, 1)); updateUI(); },
      reset: (seed = 1) => { matter.reset(seed); scene.reset(); lastText = ''; paused = true; introDone = true; awakened = false; el('#start-prompt').hidden = true; updateUI(); },
      planePose: (yaw: number | null) => { paused = true; scene.testYaw = yaw; scene.render(0); updateUI(); },
    };
  }
}
void start();
