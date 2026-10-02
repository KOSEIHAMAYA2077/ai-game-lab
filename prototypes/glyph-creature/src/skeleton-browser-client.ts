import { validateSkeletonSpec, type SkeletonSpec } from './skeleton-surface';
import type { Resolution } from './skeleton-client';

export type ModelProgress = { stage: 'download' | 'verify' | 'initialize' | 'ready'; file?: string; loaded?: number; total?: number };
export type BrowserModelInfo = { model: string; revision: string; provider: 'wasm'; modelLoadMs: number; downloadedBytes: number; cacheUsed: boolean; maxTokens: number };
type Pending = { resolve: (value: unknown) => void; reject: (reason: Error) => void; progress?: (value: ModelProgress) => void };
let worker: Worker | null = null;
let requestId = 0;
const pending = new Map<number, Pending>();
let loaded: Promise<BrowserModelInfo> | null = null;

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./skeleton-browser-model.worker.ts', import.meta.url), { type: 'module', name: 'glyph-local-model' });
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

export function loadBrowserModel(progress?: (value: ModelProgress) => void): Promise<BrowserModelInfo> {
  if (!loaded) {
    loaded = request('load', {}, progress).then((value) => value as BrowserModelInfo).catch((error) => {
      loaded = null;
      throw error;
    });
  }
  return loaded;
}

export async function browserModelResolution(text: string, signal: AbortSignal, previous: SkeletonSpec | null = null): Promise<Resolution> {
  const raw = await request('interpret', { text, previous }, undefined, signal) as Resolution;
  if (!['semantic-model', 'unchanged'].includes(raw.source) || !Number.isFinite(raw.modelMs) || raw.modelMs < 0) throw new Error('端末内モデルの応答を確認できませんでした。');
  const spec = raw.spec === null ? null : validateSkeletonSpec(raw.spec);
  if (raw.spec !== null && !spec) throw new Error('形の値が範囲外でした。');
  return { ...raw, spec };
}

// Aliases keep the module easy to use without requiring an API server.
export const browserModel = { load: loadBrowserModel, interpret: browserModelResolution };
