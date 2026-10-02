import { validateProgram, type Program } from './scaffold-program';
export type ProgramResolution = { program: Program | null; source: 'semantic-model' | 'unchanged'; modelMs: number; reason: string; evidence?: Record<string, unknown>[]; relationCandidates?: {kind: string; score: number}[] };

export type ModelProgress = { stage: 'download' | 'verify' | 'initialize' | 'ready'; file?: string; loaded?: number; total?: number };
export type ProgramModelInfo = { model: string; revision: string; provider: 'wasm'; modelLoadMs: number; downloadedBytes: number; cacheUsed: boolean; maxTokens: number };
type Pending = { resolve: (value: unknown) => void; reject: (reason: Error) => void; progress?: (value: ModelProgress) => void };
let worker: Worker | null = null;
let requestId = 0;
const pending = new Map<number, Pending>();
let loaded: Promise<ProgramModelInfo> | null = null;

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./scaffold-model.worker.ts', import.meta.url), { type: 'module', name: 'glyph-program-model' });
  worker.addEventListener('message', (event: MessageEvent) => {
    const message = event.data;
    const request = pending.get(message.id);
    if (!request) return;
    if (message.kind === 'progress') {
      request.progress?.(message.progress);
      return;
    }
    pending.delete(message.id);
    if (message.kind === 'error') request.reject(new Error(String(message.error ?? '端末内モデルを確認できませんでした。')));
    else request.resolve(message.result);
  });
  worker.addEventListener('error', () => {
    for (const request of pending.values()) request.reject(new Error('端末内モデルの処理が停止しました。'));
    pending.clear();
    worker?.terminate();
    worker = null;
    loaded = null;
  });
  return worker;
}

function request(kind: 'load' | 'interpret', data: Record<string, unknown>, progress?: (value: ModelProgress) => void, signal?: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const id = ++requestId;
    const abort = () => {
      pending.delete(id);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const settle = (callback: () => void) => {
      signal?.removeEventListener('abort', abort);
      callback();
    };
    pending.set(id, {
      resolve: (value) => settle(() => resolve(value)),
      reject: (error) => settle(() => reject(error)),
      progress,
    });
    signal?.addEventListener('abort', abort, { once: true });
    getWorker().postMessage({ id, kind, ...data });
  });
}

export function loadProgramModel(progress?: (value: ModelProgress) => void): Promise<ProgramModelInfo> {
  if (!loaded) {
    loaded = request('load', {}, progress).then((value) => value as ProgramModelInfo).catch((error) => {
      loaded = null;
      throw error;
    });
  }
  return loaded;
}

export async function resolveProgram(text: string, signal: AbortSignal, previous: Program | null = null): Promise<ProgramResolution> {
  const raw = await request('interpret', { text, previous }, undefined, signal) as ProgramResolution;
  if (!['semantic-model', 'unchanged'].includes(raw.source) || !Number.isFinite(raw.modelMs) || raw.modelMs < 0) throw new Error('端末内モデルの応答を確認できませんでした。');
  const program = raw.program === null ? null : validateProgram(raw.program);
  if (raw.program !== null && !program) throw new Error('形の値が範囲外でした。');
  return { ...raw, program };
}

// Aliases keep the module easy to use without requiring an API server.
export const scaffoldModel = { load: loadProgramModel, interpret: resolveProgram };
