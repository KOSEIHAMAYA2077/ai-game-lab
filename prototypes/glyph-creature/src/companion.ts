import type { Matter } from './model';
import type { GlyphScene } from './scene';
import { captureDay, localDay, readDays, restoreDay, validDay, writeDay, type Day } from './diary';

type Handlers = { feed: (text: string) => boolean; refresh: () => void; pause: (value: boolean) => void };
export function setupCompanion(matter: Matter, scene: GlyphScene, handlers: Handlers) {
  const params = new URLSearchParams(location.search);
  const writer = params.has('write'), viewer = params.has('companion');
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('glyph-matter:writing:v1') : null;
  let day = localDay(), lastSavedAt = -100, displayingArchive = false;
  let beforeArchive: Day | undefined;
  let selectedDate = day;
  const root = document.createElement('section'); root.id = 'writing'; root.hidden = !writer;
  root.innerHTML = `<a href="./">← 空間へ</a><p class="writing-title">きょうのことば</p><p class="help">書いている文字が、隣に届く。<br>Enter でその行を取り込む。Shift + Enter は改行。</p><textarea id="manuscript" aria-label="執筆する文章" spellcheck="false" placeholder="今日は、どんなことを考えた？"></textarea><div class="controls"><button id="writing-feed">この行を渡す ↵</button><button id="floating">別窓で眺める ↗</button><button id="writing-history">日記</button></div><p id="writing-status" role="status" class="help"></p><p class="help">下書き欄は再読込で消えます。Enterで渡した文章と形を、このブラウザに保存します（14日分）。他のアプリの入力は受け取りません。ページを閉じる前に日記を保存・書き出せます。</p>`;
  document.querySelector('#app')!.append(root);
  const draft = document.createElement('p'); draft.id = 'draft-preview'; draft.hidden = !writer && !viewer;
  document.querySelector('#app')!.append(draft);
  const gallery = document.createElement('section'); gallery.id = 'diary'; gallery.hidden = true;
  gallery.setAttribute('aria-label', '日ごとの形');
  gallery.innerHTML = `<p>日ごとの形</p><p class="help">端末の日付で一区切り。最近14日分を、このブラウザに保存。選ぶと、その日の姿に戻ります。</p><div id="days"></div><div class="controls"><button id="save-today">いまの形を残す</button><button id="export-day">日記を書き出す</button><button id="export-image">画像にする</button><button id="diary-close">戻る</button></div><p id="diary-status" role="status" class="help"></p>`;
  document.querySelector('#app')!.append(gallery);
  const textarea = root.querySelector<HTMLTextAreaElement>('textarea')!;
  const message = (text: string) => { root.querySelector('#writing-status')!.textContent = text; gallery.querySelector('#diary-status')!.textContent = text; };
  const thumbnail = () => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 180;
    const ctx = canvas.getContext('2d')!, source = scene.renderer.domElement;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 180, 180);
    const fit = Math.min(180 / source.width, 180 / source.height);
    ctx.drawImage(source, (180 - source.width * fit) / 2, (180 - source.height * fit) / 2, source.width * fit, source.height * fit);
    return canvas.toDataURL('image/webp', .72);
  };
  const restore = (value: Day) => { restoreDay(matter, value); scene.reset(); scene.render(1); handlers.refresh(); };
  const snapshot = () => captureDay(matter, day, thumbnail());
  const publish = () => channel?.postMessage({ type: 'shape', day: captureDay(matter, day) });
  const save = () => {
    if (viewer || displayingArchive) return false;
    try { writeDay(snapshot()); lastSavedAt = matter.time; message(`${day} · ${matter.glyphs.length.toLocaleString()}文字の姿を保存しました。${matter.glyphs.length >= 32000 ? '文字の上限です。続きの行は執筆欄に残ります。' : ''}`); return true; }
    catch { message('保存できませんでした。容量・ブラウザの設定を確認し、日記を書き出してください。'); return false; }
  };
  const rollover = () => {
    if (!writer || displayingArchive || day === localDay()) return true;
    if (!save()) return false;
    day = localDay(); matter.reset(); scene.reset(); lastSavedAt = -100;
    handlers.refresh(); publish(); message('日付が変わりました。昨日の形を残して、新しい @ から始まります。'); return true;
  };
  const leaveArchive = () => {
    if (displayingArchive && beforeArchive) restore(beforeArchive);
    displayingArchive = false; beforeArchive = undefined; handlers.pause(false); rollover();
  };
  const refreshGallery = () => {
    const list = gallery.querySelector('#days')!; list.replaceChildren();
    try {
      for (const entry of readDays()) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'day';
        if (entry.thumbnail) { const img = document.createElement('img'); img.src = entry.thumbnail; img.alt = ''; button.append(img); }
        const label = document.createElement('span'); label.textContent = `${entry.date} / ${1 + entry.batches.reduce((n, b) => n + b.added, 0)}文字`; button.append(label);
        button.addEventListener('click', () => {
          if (!displayingArchive) beforeArchive = captureDay(matter, day);
          displayingArchive = true; selectedDate = entry.date; restore(entry); handlers.pause(true); message(`${entry.date} の姿。戻ると今日の続きです。`);
        }); list.append(button);
      }
      if (!list.childElementCount) list.textContent = 'まだありません。「いまの形を残す」で最初の一日を。';
    } catch { message('保存された日記を読み込めませんでした。'); }
  };
  const lockEditing = (locked: boolean) => {
    for (const id of ['actions', 'terminal', 'quick-forms']) (document.getElementById(id) as HTMLElement).inert = locked;
  };
  const openGallery = () => { rollover(); gallery.hidden = false; lockEditing(true); refreshGallery(); };
  const download = (url: string, name: string) => { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); };
  gallery.querySelector('#save-today')!.addEventListener('click', () => { leaveArchive(); save(); refreshGallery(); });
  gallery.querySelector('#export-day')!.addEventListener('click', () => {
    const data = captureDay(matter, displayingArchive ? selectedDate : day);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    download(url, `glyph-diary-${data.date}.json`); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  gallery.querySelector('#export-image')!.addEventListener('click', () => download(scene.renderer.domElement.toDataURL('image/png'), `glyph-${displayingArchive ? selectedDate : day}.png`));
  gallery.querySelector('#diary-close')!.addEventListener('click', () => { leaveArchive(); gallery.hidden = true; lockEditing(false); });
  root.querySelector('#writing-history')!.addEventListener('click', openGallery);
  if (writer) {
    document.body.classList.add('writing');
    try { const today = readDays().find(d => d.date === day); if (today) restore(today); }
    catch { message('日記を読み込めませんでした。新しい @ で始めます。'); }
    let composing = false, ended = -Infinity;
    const currentLine = () => {
      const start = textarea.value.lastIndexOf('\n', Math.max(0, textarea.selectionStart - 1)) + 1;
      const end = textarea.value.indexOf('\n', textarea.selectionStart);
      return { start, end: end < 0 ? textarea.value.length : end, text: textarea.value.slice(start, end < 0 ? textarea.value.length : end) };
    };
    const preview = () => { const text = currentLine().text.slice(-240); draft.textContent = text; channel?.postMessage({ type: 'draft', text }); };
    const feed = () => {
      if (composing || performance.now() - ended < 80) return;
      leaveArchive(); gallery.hidden = true; lockEditing(false);
      const canReceive = rollover();
      const line = currentLine();
      const received = Boolean(line.text.trim()) && canReceive && handlers.feed(line.text);
      {
        textarea.setSelectionRange(line.end, line.end); textarea.setRangeText('\n', line.end, line.end, 'end');
        preview();
        if (received) { publish(); save(); }
        else if (line.text.trim()) message('この行は形に追加できませんでした。文章は執筆欄に残っています。文字数の上限、日記の保存容量を確認してください。');
      }
      textarea.focus();
    };
    textarea.addEventListener('compositionstart', () => { composing = true; });
    textarea.addEventListener('compositionend', () => { composing = false; ended = performance.now(); preview(); });
    textarea.addEventListener('input', () => { rollover(); if (!composing) preview(); });
    textarea.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing || composing || event.keyCode === 229) return;
      event.preventDefault(); if (!event.repeat && performance.now() - ended >= 80) feed();
    });
    root.querySelector('#writing-feed')!.addEventListener('click', feed);
    root.querySelector('#floating')!.addEventListener('click', async () => {
      save();
      const api = (window as unknown as { documentPictureInPicture?: { requestWindow: (options: { width: number; height: number }) => Promise<Window> } }).documentPictureInPicture;
      try {
        if (api) {
          const win = await api.requestWindow({ width: 460, height: 480 });
          win.document.body.style.cssText = 'margin:0;background:#000;height:100vh';
          const iframe = win.document.createElement('iframe'); iframe.src = new URL('./?companion', location.href).href; iframe.title = '執筆の横の文字';
          iframe.style.cssText = 'border:0;width:100%;height:100%'; win.document.body.append(iframe);
          message('小窓を開きました。この執筆ページを開いたまま使います。');
        } else {
          const popup = window.open('./?companion', 'glyph-companion', 'popup,width=460,height=480');
          message(popup ? '別窓を開きました。最前面への固定はブラウザによります。' : '別窓がブロックされました。ブラウザで許可してからもう一度どうぞ。');
        }
      } catch { message('小窓を開けませんでした。対応するブラウザでお試しください。'); }
    });
    setInterval(rollover, 10_000);
    setInterval(() => { rollover(); if (!displayingArchive && matter.batches.length && matter.time - lastSavedAt > 15) save(); }, 5000);
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', () => { rollover(); if (document.hidden) save(); });
    channel?.addEventListener('message', event => { if (event.data?.type === 'ready') { publish(); preview(); } });
    textarea.focus();
  }
  if (viewer) {
    document.body.classList.add('companion');
    try { const today = readDays().find(d => d.date === day); if (today) restore(today); } catch { /* Empty view can still receive live state. */ }
    channel?.addEventListener('message', event => {
      if (event.data?.type === 'shape' && validDay(event.data.day)) restore(event.data.day);
      if (event.data?.type === 'draft' && typeof event.data.text === 'string') draft.textContent = event.data.text.slice(-240);
    });
    channel?.postMessage({ type: 'ready' });
  }
  return { openGallery, save, publish, writer, viewer, rollover };
}
