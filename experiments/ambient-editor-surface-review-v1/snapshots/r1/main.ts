import { createAdapter } from '../ambient-editor-adapter-v1/adapter-r2.mjs';
import { createFrameGate } from './projection.mjs';
import { SurfaceScene } from './surface-scene';
import type { Shape } from './surface';
const host = document.querySelector<HTMLElement>('#space')!;
const editor = document.querySelector<HTMLTextAreaElement>('#editor')!;
const placeholder = document.querySelector<HTMLElement>('#placeholder')!;
const status = document.querySelector<HTMLElement>('#status')!;
const pause = document.querySelector<HTMLButtonElement>('#pause')!;
const inputToggle = document.querySelector<HTMLButtonElement>('#input-toggle')!;
const helpToggle = document.querySelector<HTMLButtonElement>('#help-toggle')!;
const terminal = document.querySelector<HTMLElement>('#terminal')!;
const help = document.querySelector<HTMLElement>('#help')!;
const ink = document.querySelector<HTMLSelectElement>('#ink')!;
const clock = () => Math.floor(performance.now());
const adapter = createAdapter({ element: editor, clock, ink: 'blue', shapeMode: 'inline' });
let paused = false, hidden = document.hidden, retired = false, scene: SurfaceScene | null = null;
function showStatus() {
  const s = adapter.snapshot();
  const message = paused ? '停止中' : s.unsupported ? '入力を保留' : s.pendingRetry || s.status === 'held' || s.status === 'document-limit' ? '保留' : s.compositionPhase ? '変換中' : s.status === 'unknown' || s.status === 'cancelled' ? '未確認' : '';
  if (status.textContent !== message) status.textContent = message;
}
const gate = createFrameGate({ clock, schedule: (fn: () => void, ms: number) => window.setTimeout(fn, ms), cancel: (id: number) => window.clearTimeout(id),
  frame: ({ wall, time, dt }: { wall: number; time: number; dt: number }) => {
    if (!scene) { try { scene = new SurfaceScene(host); } catch { status.textContent = '描画を確認できません'; gate.setActive(false); return; } }
    const s = adapter.advance(wall);
    scene.draw(adapter.readBody(), s.presentedCount, s.shape as Shape, time, dt);
    placeholder.hidden = s.presentedCount > 0; showStatus();
  } });
function exposure() {
  if (retired) return;
  // Stop before receiver controls; resume starts with zero visual dt.
  gate.setActive(false); adapter.setPaused(paused, clock()); adapter.setVisible(!hidden, clock());
  gate.setActive(!paused && !hidden); showStatus();
}
for (const type of ['input', 'compositionstart', 'compositionupdate', 'compositionend', 'blur']) editor.addEventListener(type, showStatus);
ink.addEventListener('change', () => { adapter.setInk(ink.value); });
inputToggle.addEventListener('click', () => { terminal.hidden = !terminal.hidden; inputToggle.setAttribute('aria-expanded', String(!terminal.hidden)); if (!terminal.hidden) editor.focus(); });
helpToggle.addEventListener('click', () => { help.hidden = !help.hidden; helpToggle.setAttribute('aria-expanded', String(!help.hidden)); });
pause.addEventListener('click', () => { paused = !paused; pause.textContent = paused ? 'RESUME' : 'PAUSE'; pause.setAttribute('aria-pressed', String(paused)); exposure(); });
document.addEventListener('visibilitychange', () => { hidden = document.hidden; exposure(); });
window.addEventListener('pagehide', event => { hidden = true; exposure(); if (!event.persisted) { retired = true; gate.destroy(); adapter.destroy(); scene?.destroy(); } });
window.addEventListener('pageshow', () => { if (!retired) { hidden = document.hidden; exposure(); } });
// Public QA has aggregates/controls only, no text/readBody/identity/serialization APIs.
Object.defineProperty(window, 'ambientSurfaceLab', { value: Object.freeze({
  inspect: () => ({ adapter: adapter.snapshot(), frame: gate.inspect(), surface: scene?.inspect() ?? { drawnMaterial: 0, placeholder: true }, paused, hidden, retired }),
  pause: (value: boolean) => { if (typeof value !== 'boolean' || retired) return; paused = value; pause.textContent = paused ? 'RESUME' : 'PAUSE'; pause.setAttribute('aria-pressed', String(paused)); exposure(); },
  exportOff: () => adapter.exportState(),
}), writable: false });
exposure();
