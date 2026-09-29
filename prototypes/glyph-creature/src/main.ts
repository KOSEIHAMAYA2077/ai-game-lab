import './style.css';
import { FORMS, MAX_GLYPHS, Matter, type Form } from './model';
import { GlyphScene } from './scene';

const names: Record<Form, string> = { condense: '凝縮', vortex: '渦', orbit: '軌道', mobius: 'メビウス' };

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main id="scene" tabindex="-1" aria-label="文字の空間。Enterで入力を開く"></main>
  <section id="terminal" hidden aria-label="文字のターミナル">
    <form id="feed-form">
      <div class="input-line"><label for="text-input" aria-label="文字を入力">&gt;</label><input id="text-input" type="text" autocomplete="off" spellcheck="false" aria-label="加える文字" aria-describedby="input-help" /><button id="feed" type="submit" aria-label="文字を加える">↵</button></div>
    </form>
    <nav aria-label="形を選ぶ">${FORMS.map(form => `<button type="button" data-form="${form}" aria-pressed="${form === 'condense'}">${names[form]}</button>`).join('')}</nav>
    <div class="controls"><label for="repeat">×</label><select id="repeat" aria-label="繰り返し回数"><option value="1">1</option><option value="16">16</option><option value="64">64</option><option value="256">256</option></select><button id="repeat-last" type="button" disabled>もう一度</button><button id="pause" type="button" aria-pressed="false">止める</button><button id="reset" type="button">最初へ</button><button id="close" type="button">閉じる</button></div>
    <p id="status" role="status" aria-live="polite"></p>
    <p id="input-help">Enter で送る　Esc で閉じる</p>
  </section>
  <p id="fatal" role="alert" hidden></p>
`;

const el = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const input = el<HTMLInputElement>('#text-input');
const terminal = el<HTMLElement>('#terminal');
const repeat = el<HTMLSelectElement>('#repeat');
const status = el<HTMLParagraphElement>('#status');
const repeatLast = el<HTMLButtonElement>('#repeat-last');
const matter = new Matter();
let scene: GlyphScene;
let paused = false;
let composing = false;
let compositionEnded = -Infinity;
let lastText = '';
let frameTime = performance.now();

function openTerminal() { terminal.hidden = false; input.focus(); }
function closeTerminal() { terminal.hidden = true; el('#scene').focus({ preventScroll: true }); }
function updateUI() {
  document.querySelectorAll<HTMLButtonElement>('[data-form]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.form === matter.form));
  });
  repeatLast.disabled = !lastText || matter.glyphs.length >= MAX_GLYPHS;
  el('#pause').textContent = paused ? '動かす' : '止める';
  el('#pause').setAttribute('aria-pressed', String(paused));
}

function addText(text: string, times: number) {
  const result = matter.add(text, times);
  if (result.empty) { status.textContent = '空白以外の文字を入力してください。'; input.focus(); return; }
  if (result.added) {
    lastText = text; scene.sync(); paused = false;
    status.textContent = `${matter.glyphs.length.toLocaleString('ja-JP')} 文字`;
    input.value = '';
  }
  if (result.limited) status.textContent = `${result.added.toLocaleString('ja-JP')}文字を追加。合計32,000文字・1,024種類までです。`;
  if (result.reason === 'input') status.textContent = '入力が長すぎます。短く分けて入力してください。';
  updateUI();
  // Errors stay in the terminal; successful input gives the space back to the letters.
  if (result.added && !result.limited) closeTerminal();
}

async function start() {
  await document.fonts.ready;
  try { scene = new GlyphScene(el('#scene'), matter); }
  catch (error) {
    el('#fatal').hidden = false;
    el('#fatal').textContent = '描画を開始できませんでした。WebGL2が使えるブラウザで開いてください。';
    console.error(error); return;
  }

  const imeActive = (event: KeyboardEvent) => composing || event.isComposing || event.keyCode === 229 || performance.now() - compositionEnded < 80;
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; compositionEnded = performance.now(); });
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.stopPropagation();
    if (composing || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (imeActive(event) || event.repeat) return;
    addText(input.value, Number(repeat.value));
  });
  document.addEventListener('keydown', event => {
    if (imeActive(event) || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Enter' && terminal.hidden) { event.preventDefault(); openTerminal(); }
    else if (event.key === 'Escape' && !terminal.hidden) { event.preventDefault(); closeTerminal(); }
  });
  el<HTMLFormElement>('#feed-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!composing && performance.now() - compositionEnded >= 80) addText(input.value, Number(repeat.value));
  });
  el('#scene').addEventListener('open-terminal', openTerminal);
  el('#close').addEventListener('click', closeTerminal);
  repeatLast.addEventListener('click', () => addText(lastText, Number(repeat.value)));
  document.querySelectorAll<HTMLButtonElement>('[data-form]').forEach(button => button.addEventListener('click', () => {
    scene.setForm(button.dataset.form as Form); paused = false; updateUI(); closeTerminal();
  }));
  el('#pause').addEventListener('click', () => { paused = !paused; updateUI(); closeTerminal(); });
  el('#reset').addEventListener('click', () => {
    matter.reset(); scene.reset(); lastText = ''; paused = false;
    input.value = ''; repeat.value = '1'; status.textContent = '';
    updateUI(); closeTerminal();
  });
  el('#scene').addEventListener('webglcontextlost', event => {
    event.preventDefault(); el('#fatal').hidden = false;
    el('#fatal').textContent = '描画が中断されました。ページを再読み込みしてください。';
  }, true);
  updateUI();

  function frame(now: number) {
    const dt = Math.min((now - frameTime) / 1000, 0.05); frameTime = now;
    const activeDt = paused || document.hidden ? 0 : dt;
    matter.step(activeDt); scene.render(activeDt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (import.meta.env.DEV) {
    (window as unknown as { __GLYPH_ART__: unknown }).__GLYPH_ART__ = {
      inspect: () => ({ ...matter.inspect(), paused, terminalOpen: !terminal.hidden, scene: scene.inspect() }),
      pause: (value = true) => { paused = value; updateUI(); },
      step: (milliseconds: number) => { paused = true; matter.step(milliseconds / 1000); scene.render(Math.min(milliseconds / 1000, 1)); updateUI(); },
      reset: (seed = 1) => { matter.reset(seed); scene.reset(); lastText = ''; paused = true; updateUI(); },
      // A development-only fixture for checking front / edge / back pixel output.
      planePose: (yaw: number | null) => { paused = true; scene.testYaw = yaw; scene.render(0); updateUI(); },
    };
  }
}
void start();
