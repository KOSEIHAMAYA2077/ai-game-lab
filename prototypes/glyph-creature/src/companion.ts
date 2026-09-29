import type { Matter } from './model';
import type { GlyphScene } from './scene';
import { captureDay, localDay, readDays, restoreDay, validDay, writeDay, readDraft, writeDraft, recoverDays, recoverDraft, type Day } from './diary';

type Handlers = { feed: (text: string) => boolean; refresh: () => void; pause: (value: boolean) => void };
const WRITER_LOCK = 'glyph-matter:journal-owner:v1';
export async function setupCompanion(matter: Matter, scene: GlyphScene, handlers: Handlers) {
  const params = new URLSearchParams(location.search);
  const writer = params.has('write'), viewer = params.has('companion');
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('glyph-matter:writing:v1') : null;
  let day = localDay(), lastSavedAt = -100, displayingArchive = false, ownsWriter = false, acquiring = false, draftDamaged = false;
  let releaseWriter: (() => void) | undefined, draftTimer: ReturnType<typeof setTimeout> | undefined;
  let beforeArchive: Day | undefined;
  let selectedDate = day;
  const root = document.createElement('section'); root.id = 'writing'; root.hidden = !writer;
  root.innerHTML = `<a href="./">← 空間へ</a><p class="writing-title">きょうのことば</p><p class="help">書いている文字が、隣に届く。<br>Enter でその行を取り込む。Shift + Enter は改行。</p><textarea id="manuscript" aria-label="執筆する文章" spellcheck="false" placeholder="今日は、どんなことを考えた？"></textarea><div class="controls"><button id="writing-feed">この行を渡す ↵</button><button id="floating">別窓で眺める ↗</button><button id="writing-history">日記</button><button id="export-manuscript">原稿を書き出す</button><button id="resume-writing" hidden>ここで続きを書く</button></div><p id="draft-status" class="help"></p><p id="writing-status" role="status" class="help"></p><p class="help">原稿は自動保存。日付が変わっても、書きかけの文章は残ります。Enterで渡した文章と形も、このブラウザに保存します（14日分）。他のアプリの入力は受け取りません。保存は一つの執筆タブから行います。</p>`;
  document.querySelector('#app')!.append(root);
  const draft = document.createElement('p'); draft.id = 'draft-preview'; draft.hidden = !writer && !viewer;
  document.querySelector('#app')!.append(draft);
  const gallery = document.createElement('section'); gallery.id = 'diary'; gallery.hidden = true;
  gallery.setAttribute('aria-label', '日ごとの形');
  gallery.innerHTML = `<p>日ごとの形</p><p class="help">端末の日付で一区切り。最近14日分を、このブラウザに保存。選ぶと、その日の姿に戻ります。</p><div id="days"></div><div class="controls"><button id="save-today">いまの形を残す</button><button id="export-day">日記を書き出す</button><button id="export-image">画像にする</button><button id="recover-diary" hidden>壊れた保存を退避して再開</button><button id="diary-close">戻る</button></div><p id="diary-status" role="status" class="help"></p>`;
  document.querySelector('#app')!.append(gallery);
  const textarea = root.querySelector<HTMLTextAreaElement>('textarea')!;
  const message = (text: string) => { root.querySelector('#writing-status')!.textContent = text; gallery.querySelector('#diary-status')!.textContent = text; };
  const download = (url: string, name: string) => { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); };
  const downloadText = (text: string, name: string, type = 'text/plain') => { const url = URL.createObjectURL(new Blob([text], { type })); download(url, name); setTimeout(() => URL.revokeObjectURL(url), 1000); };
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
  const publish = () => { if (writer && ownsWriter && !displayingArchive) channel?.postMessage({ type: 'shape', day: captureDay(matter, day) }); };
  const checkRecovery = () => { try { readDays(); } catch { (gallery.querySelector('#recover-diary') as HTMLButtonElement).hidden = false; } };
  const saveNow = () => {
    if (viewer || displayingArchive || (writer && !ownsWriter)) return false;
    try { writeDay(snapshot()); lastSavedAt = matter.time; message(`${day} · ${matter.glyphs.length.toLocaleString()}文字の姿を保存しました。${matter.glyphs.length >= 32000 ? '文字の上限です。続きの行は原稿に残ります。' : ''}`); return true; }
    catch { checkRecovery(); message('保存できませんでした。容量・ブラウザの設定を確認し、日記を書き出してください。'); return false; }
  };
  // Writer holds this lock for its lifetime. Art-only tabs borrow it for an explicit save.
  const withSaveAccess = async (action: () => boolean) => {
    if (viewer || (writer && !ownsWriter)) { message('保存は別の執筆タブが担当しています。「ここで続きを書く」で引き継げます。'); return false; }
    if (ownsWriter) return action();
    if (!navigator.locks) { message('このブラウザでは保存の競合を防げません。日記を書き出して残してください。'); return false; }
    try { return await navigator.locks.request(WRITER_LOCK, { ifAvailable: true }, lock => { if (!lock) { message('執筆タブを開いている間は、そちらから保存します。この形は書き出せます。'); return false; } return action(); }); }
    catch { message('保存を開始できませんでした。日記を書き出して残してください。'); return false; }
  };
  const save = () => withSaveAccess(() => { if (!writer) day = localDay(); return saveNow(); });
  const saveDraft = () => {
    if (!writer || !ownsWriter) return;
    clearTimeout(draftTimer);
    if (draftDamaged) { root.querySelector('#draft-status')!.textContent = '原稿の保存が壊れています。日記から退避して再開できます。今の文章は書き出せます。'; return; }
    try { writeDraft({ version: 1, text: textarea.value, start: textarea.selectionStart, end: textarea.selectionEnd }); root.querySelector('#draft-status')!.textContent = '原稿を保存しました。'; }
    catch { root.querySelector('#draft-status')!.textContent = '原稿を保存できません。「原稿を書き出す」で手元に残せます。'; }
  };
  const scheduleDraft = () => { if (!ownsWriter) return; clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 400); };
  const rollover = () => {
    if (!writer || !ownsWriter || displayingArchive || day === localDay()) return !writer || ownsWriter;
    if (!saveNow()) return false;
    day = localDay(); matter.reset(); scene.reset(); lastSavedAt = -100;
    handlers.refresh(); publish(); message('日付が変わりました。昨日の形を残して、新しい @ から始まります。原稿はそのままです。'); return true;
  };
  const lockEditing = () => {
    const locked = displayingArchive || !gallery.hidden || (writer && !ownsWriter);
    for (const id of ['actions', 'terminal', 'quick-forms']) (document.getElementById(id) as HTMLElement).inert = locked;
    textarea.readOnly = writer && !ownsWriter;
    (root.querySelector('#writing-feed') as HTMLButtonElement).disabled = writer && !ownsWriter;
    (root.querySelector('#resume-writing') as HTMLButtonElement).hidden = !writer || ownsWriter;
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
          try {
            const current = displayingArchive ? beforeArchive : captureDay(matter, day);
            restore(entry); beforeArchive = current; displayingArchive = true; selectedDate = entry.date;
            handlers.pause(true); message(`${entry.date} の姿。戻ると今日の続きです。`);
          } catch { checkRecovery(); message('この日の文字を復元できません。現在の形は保持しています。'); }
        }); list.append(button);
      }
      if (!list.childElementCount) list.textContent = 'まだありません。「いまの形を残す」で最初の一日を。';
    } catch { checkRecovery(); message('保存された日記を読み込めませんでした。「壊れた保存を退避して再開」で原本を残して復旧できます。'); }
  };
  const openGallery = () => { rollover(); gallery.hidden = false; lockEditing(); refreshGallery(); };
  gallery.querySelector('#save-today')!.addEventListener('click', async () => { leaveArchive(); await save(); refreshGallery(); });
  gallery.querySelector('#export-day')!.addEventListener('click', () => {
    const data = captureDay(matter, displayingArchive ? selectedDate : day);
    downloadText(JSON.stringify(data, null, 2), `glyph-diary-${data.date}.json`, 'application/json');
  });
  gallery.querySelector('#export-image')!.addEventListener('click', () => download(scene.renderer.domElement.toDataURL('image/png'), `glyph-${displayingArchive ? selectedDate : day}.png`));
  gallery.querySelector('#recover-diary')!.addEventListener('click', async () => {
    await withSaveAccess(() => {
      try {
        try { readDays(); } catch { const result = recoverDays(); downloadText(result.raw, `glyph-diary-recovery-${localDay()}.json`, 'application/json'); }
        if (draftDamaged) { const raw = recoverDraft({ version: 1, text: textarea.value, start: textarea.selectionStart, end: textarea.selectionEnd }); downloadText(raw, `glyph-manuscript-recovery-${localDay()}.json`, 'application/json'); draftDamaged = false; saveDraft(); }
        (gallery.querySelector('#recover-diary') as HTMLButtonElement).hidden = true; refreshGallery();
        message('元の保存を退避し、読み取れる日を残しました。今の形は「いまの形を残す」で保存できます。'); return true;
      } catch { message('退避用の空き容量が足りないか、保存が許可されていません。現在の原稿と日記を書き出してください。'); return false; }
    });
  });
  gallery.querySelector('#diary-close')!.addEventListener('click', () => { leaveArchive(); gallery.hidden = true; lockEditing(); });
  root.querySelector('#writing-history')!.addEventListener('click', openGallery);
  root.querySelector('#export-manuscript')!.addEventListener('click', () => downloadText(textarea.value, `glyph-manuscript-${localDay()}.txt`));
  const loadToday = () => { day = localDay(); try { const today = readDays().find(d => d.date === day); if (today) restore(today); else { matter.reset(); scene.reset(); handlers.refresh(); } } catch { checkRecovery(); message('日記を読み込めませんでした。現在の形は保持し、原本を退避して復旧できます。'); } };
  let preview = () => {};
  const acquireWriter = async () => {
    if (ownsWriter || acquiring) return;
    acquiring = true;
    let acquired = false;
    if (navigator.locks) {
      acquired = await new Promise<boolean>(resolve => {
        void navigator.locks.request(WRITER_LOCK, { ifAvailable: true }, async lock => {
          if (!lock) { resolve(false); return; }
          ownsWriter = true;
          const released = new Promise<void>(release => { releaseWriter = () => { ownsWriter = false; release(); }; });
          resolve(true); await released;
        }).catch(() => resolve(false));
      });
    }
    acquiring = false;
    if (acquired) {
      loadToday();
      try { const saved = readDraft(); if (saved) { textarea.value = saved.text; textarea.setSelectionRange(saved.start, saved.end); root.querySelector('#draft-status')!.textContent = '保存した原稿から続けられます。未送信の行は、そのままです。'; } }
      catch { draftDamaged = true; (gallery.querySelector('#recover-diary') as HTMLButtonElement).hidden = false; root.querySelector('#draft-status')!.textContent = '保存した原稿を読み込めませんでした。日記から原本を退避して再開できます。今の文章は書き出せます。'; }
      publish(); preview();
    } else message(navigator.locks ? '別のタブで執筆中です。そちらを閉じて「ここで続きを書く」を押してください。今は読むだけです。' : 'このブラウザは保存の競合防止に対応していません。対応ブラウザで開いてください。');
    lockEditing();
  };
  if (writer) {
    document.body.classList.add('writing');
    let composing = false, ended = -Infinity;
    const currentLine = () => {
      const start = textarea.selectionStart === 0 ? 0 : textarea.value.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
      const end = textarea.value.indexOf('\n', textarea.selectionStart);
      return { start, end: end < 0 ? textarea.value.length : end, text: textarea.value.slice(start, end < 0 ? textarea.value.length : end) };
    };
    preview = () => { const text = currentLine().text.slice(-240); draft.textContent = text; if (ownsWriter) channel?.postMessage({ type: 'draft', text }); };
    const feed = () => {
      if (!ownsWriter || composing || performance.now() - ended < 80) return;
      leaveArchive(); gallery.hidden = true; lockEditing();
      const canReceive = rollover(), line = currentLine();
      const received = Boolean(line.text.trim()) && canReceive && handlers.feed(line.text);
      textarea.setSelectionRange(line.end, line.end); textarea.setRangeText('\n', line.end, line.end, 'end');
      preview(); saveDraft();
      if (received) { publish(); saveNow(); }
      else if (line.text.trim()) message('この行は形に追加できませんでした。原稿は残っています。文字数の上限、日記の保存容量を確認してください。');
      textarea.focus();
    };
    textarea.addEventListener('compositionstart', () => { composing = true; });
    textarea.addEventListener('compositionend', () => { composing = false; ended = performance.now(); preview(); scheduleDraft(); });
    textarea.addEventListener('input', () => { if (!ownsWriter) return; rollover(); scheduleDraft(); if (!composing) preview(); });
    textarea.addEventListener('select', scheduleDraft);
    textarea.addEventListener('click', () => { preview(); scheduleDraft(); });
    textarea.addEventListener('keyup', event => { if (event.key.startsWith('Arrow')) { preview(); scheduleDraft(); } });
    textarea.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing || composing || event.keyCode === 229) return;
      event.preventDefault(); if (!event.repeat && performance.now() - ended >= 80) feed();
    });
    root.querySelector('#writing-feed')!.addEventListener('click', feed);
    root.querySelector('#resume-writing')!.addEventListener('click', () => { void acquireWriter(); });
    root.querySelector('#floating')!.addEventListener('click', async () => {
      if (ownsWriter) saveNow();
      const api = (window as unknown as { documentPictureInPicture?: { requestWindow: (options: { width: number; height: number }) => Promise<Window> } }).documentPictureInPicture;
      try {
        if (api) {
          const win = await api.requestWindow({ width: 460, height: 480 }); win.document.body.style.cssText = 'margin:0;background:#000;height:100vh';
          const iframe = win.document.createElement('iframe'); iframe.src = new URL('./?companion', location.href).href; iframe.title = '執筆の横の文字';
          iframe.style.cssText = 'border:0;width:100%;height:100%'; win.document.body.append(iframe); message('小窓を開きました。この執筆ページを開いたまま使います。');
        } else {
          const popup = window.open('./?companion', 'glyph-companion', 'popup,width=460,height=480');
          message(popup ? '別窓を開きました。最前面への固定はブラウザによります。' : '別窓がブロックされました。ブラウザで許可してからもう一度どうぞ。');
        }
      } catch { message('小窓を開けませんでした。対応するブラウザでお試しください。'); }
    });
    setInterval(rollover, 10_000);
    setInterval(() => { rollover(); if (ownsWriter && !displayingArchive && matter.batches.length && matter.time - lastSavedAt > 15) saveNow(); }, 5000);
    window.addEventListener('pagehide', () => { if (ownsWriter) { saveDraft(); saveNow(); releaseWriter?.(); } });
    window.addEventListener('pageshow', event => { if (event.persisted) void acquireWriter(); });
    document.addEventListener('visibilitychange', () => { rollover(); if (document.hidden && ownsWriter) { saveDraft(); saveNow(); } });
    channel?.addEventListener('message', event => { if (event.data?.type === 'ready' && ownsWriter) { publish(); preview(); } });
    await acquireWriter();
    if (ownsWriter) textarea.focus();
  }
  if (viewer || (writer && !ownsWriter)) {
    if (viewer) document.body.classList.add('companion');
    loadToday();
  }
  channel?.addEventListener('message', event => {
    if (!(viewer || (writer && !ownsWriter)) || displayingArchive) return;
    try { if (event.data?.type === 'shape' && validDay(event.data.day)) restore(event.data.day); } catch { /* Keep current state when a message is invalid. */ }
    if (event.data?.type === 'draft' && typeof event.data.text === 'string') draft.textContent = event.data.text.slice(-240);
  });
  if (viewer || (writer && !ownsWriter)) channel?.postMessage({ type: 'ready' });
  const changed = () => { if (writer && ownsWriter && !displayingArchive) { publish(); saveNow(); } };
  return { openGallery, save, publish, changed, writer, viewer, rollover, canEdit: () => !writer || ownsWriter };
}
