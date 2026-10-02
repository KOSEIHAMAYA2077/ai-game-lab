import { createAdapter } from './adapter-r2.mjs';
const editor = document.querySelector('#editor');
const adapter = createAdapter({ element: editor, ink: 'blue' });
const projection = document.querySelector('#projection'), empty = document.querySelector('#empty');
const nodes = new Map(); // DOM projection keyed only by receiver IDs; no material allocator.
const shapes = { sphere: '球', box: '箱', ring: '輪' };
const messages = {
  ready: '入力を待っています。', known: '確認できた入力を素材に加えました。',
  composition: '変換中です。素材への追加を待っています。',
  'waiting-final-input': '変換後の入力を照合しています。まだ素材に加えていません。',
  cancelled: '変換の確定を確認できなかったため、素材へ追加しませんでした。',
  unknown: '確定の経路を確認できなかった入力は、素材に加えていません。',
  deferred: '素材の受取りを一時保留しています。入力欄は再送が終わるまで読み取り専用です。',
  held: '素材の上限で、今回の入力全体を保留しました。入力欄の文章は残っています。',
  unsupported: '入力の順序が対応範囲を外れたため、素材への追加を停止しました。',
  ignored: '蓄積済みの素材を保持しています。',
  detached: 'この入力欄との接続を終了しました。',
  'document-limit': '入力欄の対応上限を超えています。素材には追加しません。',
};
function render() {
  const state = adapter.snapshot();
  document.querySelector('#count').textContent = String(state.bodyCount);
  document.querySelector('#presented').textContent = String(state.presentedCount);
  document.querySelector('#known').textContent = String(state.counters.known);
  document.querySelector('#unknown').textContent = String(state.counters.unknown + state.counters.cancelled);
  document.querySelector('#shape').textContent = shapes[state.shape];
  document.querySelector('#status').textContent = messages[state.status] ?? messages.unknown;
  empty.hidden = state.presentedCount > 0;
  let shown = 0;
  for (const unit of adapter.readBody()) {
    if (shown++ >= state.presentedCount) break;
    if (nodes.has(unit.id)) continue;
    const node = document.createElement('span'); node.className = 'unit';
    node.dataset.materialId = String(unit.id); node.dataset.ink = unit.ink;
    node.textContent = unit.text; projection.append(node); nodes.set(unit.id, node);
  }
}
document.querySelector('#ink').addEventListener('change', event => adapter.setInk(event.target.value));
for (const type of ['input', 'compositionstart', 'compositionupdate', 'compositionend', 'blur']) editor.addEventListener(type, render);
document.addEventListener('visibilitychange', () => {
  adapter.setVisible(!document.hidden); if (!document.hidden) render();
});
const interval = setInterval(() => { if (!document.hidden) { adapter.advance(Math.floor(performance.now())); render(); } }, 100);
window.addEventListener('pagehide', event => {
  if (event.persisted) adapter.setVisible(false);
  else { clearInterval(interval); adapter.destroy(); }
});
window.addEventListener('pageshow', event => { if (event.persisted) { adapter.setVisible(!document.hidden); render(); } });
// Aggregate-only local inspection/control for the parent-owned QA harness.
// No volatile body/document text is exposed through this object or logged.
window.ambientEditorView = Object.freeze({
  snapshot: () => adapter.snapshot(), exportState: () => adapter.exportState(),
  admissionReady: ready => { adapter.setAdmissionReady(ready); render(); },
  retry: () => { adapter.retry(); render(); },
  pause: paused => { adapter.setPaused(paused); render(); },
});
render();
