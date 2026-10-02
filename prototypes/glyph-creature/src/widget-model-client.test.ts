import { describe, it, expect, vi, afterEach } from 'vitest';
import { WidgetModelClient } from './widget-model-client';

class MockWorker extends EventTarget {
  static all: MockWorker[] = [];
  terminated = false;
  messages: { id: number; kind: string }[] = [];
  constructor() { super(); MockWorker.all.push(this); }
  postMessage(value: { id: number; kind: string }) {
    this.messages.push(value);
    queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: { id: value.id, kind: 'result', result: value.kind === 'load' ? { modelLoadMs: 10 } : { program: null, source: 'unchanged', modelMs: 1, reason: 'background' } } })));
  }
  terminate() { this.terminated = true; }
}
afterEach(() => { vi.unstubAllGlobals(); MockWorker.all = []; });
describe('widget model lifetime', () => {
  it('ends the Worker after preparation and uses a fresh one for each interpretation', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new WidgetModelClient(), signal = new AbortController().signal;
    await client.prepare(signal); await client.interpret('普通の文', signal, null); await client.interpret('別の文', signal, null);
    expect(MockWorker.all).toHaveLength(3); expect(MockWorker.all.every(w => w.terminated)).toBe(true);
    expect(MockWorker.all[1].messages.map(m => m.kind)).toEqual(['load','interpret']);
    expect(client.inspect()).toMatchObject({ workerActive: false, workerCount: 0, started: 3, stopped: 3 });
  });
  it('abort during loading terminates the worker and cannot apply a late response', async () => {
    class DelayedWorker extends MockWorker { override postMessage(value: {id:number;kind:string}) { this.messages.push(value); } }
    vi.stubGlobal('Worker', DelayedWorker);
    const client = new WidgetModelClient(), controller = new AbortController();
    const pending = client.interpret('球', controller.signal, null);
    const worker = MockWorker.all[0]; controller.abort();
    await expect(pending).rejects.toHaveProperty('name','AbortError');
    worker.dispatchEvent(new MessageEvent('message', { data: { id: 1, kind: 'result', result: { modelLoadMs: 1 } } }));
    expect(client.inspect()).toMatchObject({ workerActive: false, started: 1, stopped: 1, lastInfo: null }); expect(worker.terminated).toBe(true);
  });
  it('a failure while initializing also releases model ownership', async () => {
    class FailedWorker extends MockWorker { override postMessage(value: {id:number;kind:string}) { queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: { id: value.id, kind: 'error' } }))); } }
    vi.stubGlobal('Worker', FailedWorker);
    const client = new WidgetModelClient(); await expect(client.prepare(new AbortController().signal)).rejects.toThrow();
    expect(client.inspect().workerActive).toBe(false); expect(MockWorker.all[0].terminated).toBe(true);
  });
});
