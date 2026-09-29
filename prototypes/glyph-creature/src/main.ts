import './style.css';
import { FORMS, MAX_GLYPHS, Matter, type Form } from './model';
import { GlyphScene } from './scene';

const details: Record<Form, { name: string; en: string; description: string }> = {
  condense: { name: '凝縮', en: 'CONDENSE', description: '集まり、ほどける。文字でできたひとつの塊。' },
  vortex: { name: '渦', en: 'VORTEX', description: '流れに乗って、内側から外側へ。' },
  orbit: { name: '軌道', en: 'ORBIT', description: 'いくつもの軌道を、文字がめぐる。' },
  mobius: { name: 'メビウス', en: 'MÖBIUS', description: '表と裏を渡りながら、終わりなく循環する。' },
};

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="masthead">
    <div class="brand"><span class="brand-mark">＠</span><div><h1>文字のかたち</h1><p>GLYPH MATTER <span>/</span> CONCEPT STUDY 001</p></div></div>
    <div class="header-meta"><span class="version">P0 · 0.1.0</span><span class="live-indicator">観察中</span></div>
  </header>
  <main>
    <section class="toolbar" aria-label="形の選択">
      <nav class="forms">${FORMS.map((form, i) => `<button type="button" class="form-button ${i === 0 ? 'active' : ''}" data-form="${form}" aria-pressed="${i === 0}"><span class="form-number">0${i + 1}</span>${details[form].name}</button>`).join('')}</nav>
      <div class="transport"><button type="button" id="pause" aria-label="一時停止" aria-pressed="false">Ⅱ <span>一時停止</span></button><button type="button" id="reset" aria-label="最初から">↺ <span>最初から</span></button></div>
    </section>
    <section class="observation" aria-label="文字の観察領域">
      <div id="scene"></div>
      <div class="scene-caption"><span id="form-en">01 / CONDENSE</span><p id="form-description">${details.condense.description}</p></div>
      <div class="counter"><strong id="count">1</strong><span>文字</span><small id="kinds">1 種類</small></div>
      <div class="first-guide" id="first-guide"><p>ひと文字から、かたちへ。</p><span>下の欄から、好きな文字を加えてください。</span><button type="button" id="sample">まず、文字の流れを見る <span>↗</span></button></div>
      <div class="scene-footer"><span>ドラッグで回転 <i>·</i> スクロールで距離</span><span class="color-key"><i class="red-dot"></i>新しい文字<span class="key-arrow">→</span><i class="white-dot"></i>なじんだ文字</span></div>
    </section>
    <section class="console" aria-label="文字を加える">
      <form id="feed-form">
        <label for="text-input" class="console-label">文字を加える<span>日本語 / 英字 / 記号</span></label>
        <div class="input-row"><span class="prompt" aria-hidden="true">&gt;</span><input id="text-input" type="text" autocomplete="off" spellcheck="false" placeholder="あ、a、? … あなたの文字をここに" aria-describedby="input-help" /><button type="submit" id="feed">加える <span>↗</span></button></div>
        <div class="console-bottom"><div class="repeat-control"><label for="repeat">一度に重ねる</label><select id="repeat"><option value="1">1 回</option><option value="16">16 回</option><option value="64">64 回</option><option value="256">256 回</option></select><button type="button" id="repeat-last" disabled>前の文字をもう一度</button></div><span id="input-help">変換を確定してから Enter で追加</span></div>
      </form>
      <div class="status-row"><p id="status" role="status" aria-live="polite">文字を重ねるほど、線や面が現れます。</p><span id="last-feed"></span></div>
    </section>
  </main>
  <footer class="page-footer"><span>文字を材料にした、動くコンセプトアート。</span><span>入力はこの画面の中だけで扱います。</span></footer>
`;

const el = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const input = el<HTMLInputElement>('#text-input');
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

function updateUI() {
  el('#count').textContent = matter.glyphs.length.toLocaleString('ja-JP');
  el('#kinds').textContent = `${matter.kinds.size} 種類`;
  el('#first-guide').classList.toggle('hidden', matter.glyphs.length > 1);
  el('#form-en').textContent = `0${FORMS.indexOf(matter.form) + 1} / ${details[matter.form].en}`;
  el('#form-description').textContent = details[matter.form].description;
  document.querySelectorAll<HTMLButtonElement>('[data-form]').forEach(button => {
    const active = button.dataset.form === matter.form;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  });
  repeatLast.disabled = !lastText || matter.glyphs.length >= MAX_GLYPHS;
  const pause = el<HTMLButtonElement>('#pause');
  pause.innerHTML = paused ? '▷ <span>動かす</span>' : 'Ⅱ <span>一時停止</span>';
  pause.setAttribute('aria-pressed', String(paused));
  pause.setAttribute('aria-label', paused ? '動かす' : '一時停止');
  el('.live-indicator').textContent = paused ? '静止中' : '観察中';
  el('.live-indicator').classList.toggle('paused', paused);
}

function addText(text: string, times: number) {
  const result = matter.add(text, times);
  if (result.empty) { status.textContent = '空白以外の文字を入力してください。'; input.focus(); return; }
  if (result.added) {
    lastText = text; scene.sync(); paused = false;
    const visible = Array.from(text).slice(0, 28).join('');
    el('#last-feed').textContent = `前の入力「${visible}${Array.from(text).length > 28 ? '…' : ''}」`;
    status.textContent = `${result.added.toLocaleString('ja-JP')}文字を追加しました。赤い文字が流れに混ざっていきます。`;
  }
  if (result.limited) status.textContent = `${result.added.toLocaleString('ja-JP')}文字を追加。この試作は合計32,000文字・1,024種類までです。最初からやり直すと再び追加できます。`;
  if (result.reason === 'input') status.textContent = '一度の入力が長すぎます。文字は追加していません。短く分けて入力してください。';
  updateUI();
}

async function start() {
  await document.fonts.ready;
  try { scene = new GlyphScene(el('#scene'), matter); }
  catch (error) {
    status.textContent = 'このブラウザで描画を開始できませんでした。WebGLが使えるブラウザで開いてください。';
    el('#first-guide').textContent = '描画を開始できませんでした。';
    el<HTMLButtonElement>('#feed').disabled = true;
    console.error(error); return;
  }

  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; compositionEnded = performance.now(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      // Safari can dispatch the confirming Enter just after compositionend.
      if (composing || event.isComposing || event.keyCode === 229) return;
      if (performance.now() - compositionEnded < 80) { event.preventDefault(); return; }
      event.preventDefault(); addText(input.value, Number(repeat.value));
    }
  });
  el<HTMLFormElement>('#feed-form').addEventListener('submit', event => { event.preventDefault(); if (!composing) addText(input.value, Number(repeat.value)); });
  repeatLast.addEventListener('click', () => addText(lastText, Number(repeat.value)));
  el('#sample').addEventListener('click', () => {
    const text = 'あいうえお かたち 流れ 循環 @ abc ? + /';
    input.value = text; repeat.value = '64'; addText(text, 64);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-form]').forEach(button => button.addEventListener('click', () => {
    scene.setForm(button.dataset.form as Form); paused = false; updateUI();
  }));
  el('#pause').addEventListener('click', () => { paused = !paused; updateUI(); });
  el('#reset').addEventListener('click', () => {
    matter.reset(); scene.reset(); lastText = ''; paused = false;
    input.value = ''; repeat.value = '1'; el('#last-feed').textContent = '';
    status.textContent = 'ひと文字から、もう一度。'; updateUI();
  });
  el('#scene').addEventListener('webglcontextlost', event => { event.preventDefault(); status.textContent = '描画が中断されました。ページを再読み込みしてください。'; }, true);
  updateUI();

  function frame(now: number) {
    const dt = Math.min((now - frameTime) / 1000, 0.05); frameTime = now;
    const activeDt = paused || document.hidden ? 0 : dt;
    matter.step(activeDt);
    scene.render(activeDt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (import.meta.env.DEV) {
    (window as unknown as { __GLYPH_ART__: unknown }).__GLYPH_ART__ = {
      inspect: () => ({ ...matter.inspect(), paused, scene: scene.inspect() }),
      pause: (value = true) => { paused = value; updateUI(); },
      step: (milliseconds: number) => { paused = true; matter.step(milliseconds / 1000); scene.render(Math.min(milliseconds / 1000, 1)); updateUI(); },
      reset: (seed = 1) => { matter.reset(seed); scene.reset(); lastText = ''; paused = true; updateUI(); },
    };
  }
}
void start();
