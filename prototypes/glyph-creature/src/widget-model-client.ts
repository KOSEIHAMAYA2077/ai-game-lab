import { validateProgram, type Program } from './scaffold-program';
import type { ModelProgress, ProgramModelInfo, ProgramResolution } from './scaffold-model-client';

type Progress = (value: ModelProgress) => void;
export class WidgetModelClient {
  private worker: Worker | null = null;
  private serial = 0;
  private started = 0;
  private stopped = 0;
  private lastInfo: ProgramModelInfo | null = null;
  private cancelled: (() => void) | null = null;

  inspect() { return { workerActive: this.worker !== null, workerCount: Number(this.worker !== null), started: this.started, stopped: this.stopped, lastInfo: this.lastInfo }; }
  cancel() { this.cancelled?.(); }
  private async withWorker<T>(signal: AbortSignal, operation: (worker: Worker) => Promise<T>): Promise<T> {
    signal.throwIfAborted();
    if (this.worker) throw new Error('形の解釈を処理中です');
    const worker = new Worker(new URL('./scaffold-model.worker.ts', import.meta.url), { type: 'module', name: 'glyph-widget-model' });
    this.worker = worker; this.started++;
    try { return await operation(worker); }
    finally {
      worker.terminate(); this.stopped++;
      if (this.worker === worker) this.worker = null;
      this.cancelled = null;
    }
  }
  private request(worker: Worker, kind: 'load' | 'interpret', data: Record<string, unknown>, signal: AbortSignal, progress?: Progress): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.serial;
      const cleanup = () => { worker.removeEventListener('message', message); worker.removeEventListener('error', error); signal.removeEventListener('abort', abort); this.cancelled = null; };
      const abort = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
      const error = () => { cleanup(); reject(new Error('端末内モデルを処理できませんでした')); };
      const message = (event: MessageEvent) => {
        if (event.data.id !== id) return;
        if (event.data.kind === 'progress') { progress?.(event.data.progress); return; }
        cleanup();
        if (event.data.kind === 'error') reject(new Error('端末内モデルを処理できませんでした'));
        else resolve(event.data.result);
      };
      if (signal.aborted) { abort(); return; }
      this.cancelled = abort;
      worker.addEventListener('message', message); worker.addEventListener('error', error);
      signal.addEventListener('abort', abort, { once: true });
      worker.postMessage({ id, kind, ...data });
    });
  }
  async prepare(signal: AbortSignal, progress?: Progress): Promise<ProgramModelInfo> {
    return this.withWorker(signal, async worker => {
      const info = await this.request(worker, 'load', {}, signal, progress) as ProgramModelInfo;
      signal.throwIfAborted(); this.lastInfo = info; return info;
    });
  }
  async interpret(text: string, signal: AbortSignal, previous: Program | null, progress?: Progress): Promise<ProgramResolution> {
    return this.withWorker(signal, async worker => {
      this.lastInfo = await this.request(worker, 'load', {}, signal, progress) as ProgramModelInfo;
      signal.throwIfAborted();
      const raw = await this.request(worker, 'interpret', { text, previous }, signal) as ProgramResolution;
      if (!['semantic-model', 'unchanged'].includes(raw.source) || !Number.isFinite(raw.modelMs) || raw.modelMs < 0) throw new Error('形の応答が範囲外です');
      const program = raw.program === null ? null : validateProgram(raw.program);
      if (raw.program !== null && !program) throw new Error('形の値が範囲外です');
      return { ...raw, program };
    });
  }
}
