import { describe, expect, it } from 'vitest';
import { WidgetScheduler, type WidgetFrame, type WidgetSchedulerRuntime } from './widget-scheduler';

class FakeClock {
  time = 0;
  private nextId = 0;
  private tasks = new Map<number, { due: number; kind: 'timer' | 'raf'; callback: () => void }>();
  timerCallbacks = 0;
  timerRequests = 0;
  rafCallbacks = 0;
  maximumPending = 0;
  readonly runtime: WidgetSchedulerRuntime;

  constructor(alignRaf = false) {
    this.runtime = {
      now: () => this.time,
      setTimeout: (callback, delay) => this.add(callback, this.time + delay, 'timer'),
      clearTimeout: handle => { this.tasks.delete(handle as number); },
      ...(alignRaf ? {
        requestAnimationFrame: (callback: () => void) => this.add(callback, (Math.floor(this.time / (1000 / 60) + 1e-8) + 1) * (1000 / 60), 'raf'),
        cancelAnimationFrame: (handle: unknown) => { this.tasks.delete(handle as number); },
      } : {}),
    };
  }

  private add(callback: () => void, due: number, kind: 'timer' | 'raf'): number {
    if (kind === 'timer') this.timerRequests++;
    const id = ++this.nextId;
    this.tasks.set(id, { due, kind, callback });
    this.maximumPending = Math.max(this.maximumPending, this.tasks.size);
    return id;
  }

  get pending(): number { return this.tasks.size; }
  peekCallback(): (() => void) | undefined { return [...this.tasks.values()][0]?.callback; }

  advance(ms: number): void {
    const end = this.time + ms;
    let count = 0;
    while (this.tasks.size) {
      const [id, task] = [...this.tasks.entries()].sort((a, b) => a[1].due - b[1].due)[0];
      if (task.due > end + 1e-7) break;
      if (++count > 10000) throw new Error('Unbounded scheduler callbacks');
      this.time = Math.max(this.time, task.due);
      this.tasks.delete(id);
      if (task.kind === 'timer') this.timerCallbacks++; else this.rafCallbacks++;
      task.callback();
    }
    this.time = end;
  }

  /** A timer becomes runnable after a foreground stall; the clock does not rewind. */
  stall(ms: number): void { this.time += ms; this.advance(0); }
}

function setup(options: { paused?: boolean; visible?: boolean; raf?: boolean } = {}) {
  const clock = new FakeClock(options.raf), frames: WidgetFrame[] = [];
  const scheduler = new WidgetScheduler(frame => frames.push(frame), { ...options, runtime: clock.runtime });
  return { clock, frames, scheduler };
}

describe('ウィジェットの更新頻度と休止', () => {
  it('通常15fpsで進み、低頻度でも時間を切り捨てず、60Hzの空回りをしない', () => {
    const { clock, frames, scheduler } = setup();
    clock.advance(1000);
    expect(clock.pending).toBe(0);
    expect(frames).toHaveLength(0);
    scheduler.start(); scheduler.start();
    clock.advance(10_000);
    const ticks = frames.filter(frame => frame.reason === 'tick');
    expect(ticks.length).toBeGreaterThanOrEqual(149);
    expect(ticks.length).toBeLessThanOrEqual(150);
    expect(ticks.every(frame => frame.mode === 'calm' && frame.dt > .06)).toBe(true);
    expect(scheduler.inspect().elapsedSeconds).toBeCloseTo(10, 4);
    expect(clock.timerCallbacks).toBe(frames.length);
    expect(scheduler.inspect().timerCallbacks).toBe(frames.length);
    expect(clock.timerCallbacks).toBeLessThanOrEqual(151);
    expect(clock.maximumPending).toBe(1);
  });

  it('吸収中だけ30fpsへ上げ、終わると15fpsへ戻す', () => {
    const { clock, scheduler } = setup();
    scheduler.setTransient(true); scheduler.start(); clock.advance(2000);
    expect(scheduler.inspect().ticks).toBe(60);
    expect(scheduler.inspect().mode).toBe('transient');
    scheduler.setTransient(false);
    const before = scheduler.inspect().ticks;
    clock.advance(2000);
    expect(scheduler.inspect().ticks - before).toBe(30);
    expect(scheduler.inspect().mode).toBe('calm');
    expect(scheduler.inspect().elapsedSeconds).toBeCloseTo(4, 4);
    expect(clock.maximumPending).toBe(1);
  });

  it('停止中は仕事を残さず、リサイズなどの明示要求だけを一度描く', () => {
    const { clock, frames, scheduler } = setup();
    scheduler.start(); clock.advance(1000); scheduler.setPaused(true);
    const before = frames.length, elapsed = scheduler.inspect().elapsedSeconds;
    expect(clock.pending).toBe(0);
    clock.advance(300_000);
    expect(frames).toHaveLength(before);
    scheduler.invalidate(); scheduler.invalidate(); scheduler.invalidate();
    expect(clock.pending).toBe(1);
    clock.advance(0);
    expect(frames).toHaveLength(before + 1);
    expect(frames.at(-1)).toMatchObject({ dt: 0, mode: 'paused', reason: 'invalidate' });
    expect(clock.pending).toBe(0);
    clock.advance(300_000);
    expect(frames).toHaveLength(before + 1);
    expect(scheduler.inspect().elapsedSeconds).toBe(elapsed);
    scheduler.setPaused(false); clock.advance(0);
    expect(frames.at(-1)?.dt).toBe(0);
    clock.advance(1000);
    expect(scheduler.inspect().elapsedSeconds - elapsed).toBeCloseTo(1, 4);
  });

  it('非表示は要求を保留し、30分後も更新・描画せず、復帰の時間差を持ち込まない', () => {
    const { clock, frames, scheduler } = setup();
    scheduler.start(); clock.advance(1000); scheduler.boost(250); scheduler.setVisible(false);
    const before = frames.length, elapsed = scheduler.inspect().elapsedSeconds;
    scheduler.invalidate(); scheduler.invalidate(); scheduler.setTransient(true);
    expect(scheduler.inspect()).toMatchObject({ mode: 'hidden', pending: 0, boostedUntil: 0 });
    clock.advance(1_800_000);
    expect(frames).toHaveLength(before);
    expect(clock.pending).toBe(0);
    scheduler.setTransient(false); scheduler.setVisible(true); clock.advance(0);
    expect(frames).toHaveLength(before + 1);
    expect(frames.at(-1)).toMatchObject({ dt: 0, mode: 'calm', reason: 'invalidate' });
    clock.advance(1000);
    expect(scheduler.inspect().elapsedSeconds - elapsed).toBeCloseTo(1, 4);
  });

  it('停止したまま非表示から戻った時も、一度描いた後は仕事を残さない', () => {
    const { clock, frames, scheduler } = setup({ paused: true, visible: false });
    scheduler.start(); scheduler.invalidate(); clock.advance(10_000);
    expect(frames).toHaveLength(0);
    expect(clock.pending).toBe(0);
    scheduler.setVisible(true); clock.advance(0);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ dt: 0, mode: 'paused' });
    expect(clock.pending).toBe(0);
  });

  it('大量のドラッグ要求も30fps内でまとめ、活動用の別タイマーを増やさない', () => {
    const { clock, frames, scheduler } = setup();
    scheduler.start(); clock.advance(0);
    for (let i = 0; i < 1000; i++) {
      clock.advance(1); scheduler.boost(250); scheduler.invalidate();
    }
    expect(frames.length).toBeGreaterThanOrEqual(30);
    expect(frames.length).toBeLessThanOrEqual(31);
    expect(clock.maximumPending).toBe(1);
    expect(clock.timerRequests).toBeLessThanOrEqual(34);
    clock.advance(1250);
    expect(scheduler.inspect().mode).toBe('calm');
    const before = scheduler.inspect().ticks;
    clock.advance(1000);
    expect(scheduler.inspect().ticks - before).toBe(15);
  });

  it('任意のRAF整列を使っても、期限が来るまではRAFを呼ばず、非表示で取消す', () => {
    const { clock, frames, scheduler } = setup({ raf: true });
    scheduler.start(); clock.advance(0);
    expect(scheduler.inspect()).toMatchObject({ timerPending: false, rafPending: true, pending: 1 });
    clock.advance(17);
    expect(frames).toHaveLength(1);
    const afterFirstRaf = clock.rafCallbacks;
    clock.advance(40);
    expect(clock.rafCallbacks).toBe(afterFirstRaf);
    clock.advance(30);
    expect(scheduler.inspect().rafPending).toBe(true);
    const before = frames.length;
    scheduler.setVisible(false);
    expect(clock.pending).toBe(0);
    clock.advance(1000);
    expect(frames).toHaveLength(before);
    expect(clock.maximumPending).toBe(1);
  });

  it('取り消した古いtimer callbackが後から届いても、追加描画や予約をしない', () => {
    const { clock, frames, scheduler } = setup();
    scheduler.start(); clock.advance(0);
    const stale = clock.peekCallback();
    scheduler.setVisible(false);
    stale!();
    expect(frames).toHaveLength(1);
    expect(scheduler.inspect().pending).toBe(0);
    scheduler.setVisible(true); clock.advance(0);
    const staleAfterDispose = clock.peekCallback();
    scheduler.dispose(); staleAfterDispose!(); scheduler.start(); scheduler.invalidate(); scheduler.boost();
    expect(scheduler.inspect()).toMatchObject({ started: false, disposed: true, pending: 0 });
    expect(clock.pending).toBe(0);
  });

  it('大きなforeground stallを一度だけ制限し、直後に追いつくループをしない', () => {
    const { clock, frames, scheduler } = setup();
    scheduler.start(); clock.advance(0); clock.stall(10_000);
    expect(frames).toHaveLength(2);
    expect(frames.at(-1)?.dt).toBe(.25);
    expect(clock.pending).toBe(1);
    clock.advance(1000 / 15);
    expect(frames.at(-1)?.dt).toBeCloseTo(1 / 15, 6);
  });

  it('描画callbackから停止しても、次の更新を勝手に予約しない', () => {
    const clock = new FakeClock();
    let scheduler: WidgetScheduler;
    scheduler = new WidgetScheduler(() => scheduler.setPaused(true), { runtime: clock.runtime });
    scheduler.start(); clock.advance(0);
    expect(scheduler.inspect()).toMatchObject({ frames: 1, paused: true, pending: 0 });
    expect(clock.pending).toBe(0);
  });

  it('更新頻度・delta・RAFの不完全な設定を拒否する', () => {
    expect(() => new WidgetScheduler(() => {}, { calmFps: 0 })).toThrow(RangeError);
    expect(() => new WidgetScheduler(() => {}, { transientFps: NaN })).toThrow(RangeError);
    expect(() => new WidgetScheduler(() => {}, { maxDeltaSeconds: -1 })).toThrow(RangeError);
    expect(() => new WidgetScheduler(() => {}, { calmFps: 30, transientFps: 15 })).toThrow(RangeError);
    const clock = new FakeClock();
    expect(() => new WidgetScheduler(() => {}, { runtime: { ...clock.runtime, requestAnimationFrame: () => 1 } })).toThrow(TypeError);
  });
});
