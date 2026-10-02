export type WidgetFrameMode = 'calm' | 'transient' | 'paused';

export type WidgetFrame = {
  /** Monotonic milliseconds, from the same clock used for scheduling. */
  now: number;
  /** Active elapsed seconds. Explicit redraws and wake-up frames have zero delta. */
  dt: number;
  mode: WidgetFrameMode;
  reason: 'tick' | 'invalidate';
};

export interface WidgetSchedulerRuntime {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
  /** Optional alignment at a due frame, never a continuously polled RAF loop. */
  requestAnimationFrame?(callback: () => void): unknown;
  cancelAnimationFrame?(handle: unknown): void;
}

export type WidgetSchedulerOptions = {
  visible?: boolean;
  paused?: boolean;
  calmFps?: number;
  transientFps?: number;
  /** Cap a foreground timer stall without truncating the normal 15 fps delta. */
  maxDeltaSeconds?: number;
  runtime?: WidgetSchedulerRuntime;
};

const browserRuntime: WidgetSchedulerRuntime = {
  now: () => performance.now(),
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: handle => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * One paced timer (and optionally one due RAF) at a time. Visibility is explicit:
 * the caller connects document.visibilitychange or native window visibility.
 */
export class WidgetScheduler {
  private readonly runtime: WidgetSchedulerRuntime;
  private readonly calmInterval: number;
  private readonly transientInterval: number;
  private readonly maxDelta: number;
  private started = false;
  private disposed = false;
  private visible: boolean;
  private paused: boolean;
  private transient = false;
  private boostedUntil = 0;
  private dirty = true;
  private wakeFrame = true;
  private lastAdvanceAt: number | null = null;
  private nextTickAt: number | null = null;
  private timer: unknown;
  private timerPending = false;
  private timerDueAt: number | null = null;
  private raf: unknown;
  private rafPending = false;
  private generation = 0;
  private frames = 0;
  private ticks = 0;
  private redraws = 0;
  private invalidations = 0;
  private timerCallbacks = 0;
  private rafCallbacks = 0;
  private elapsed = 0;
  private lastFrameAt: number | null = null;

  constructor(private readonly onFrame: (frame: WidgetFrame) => void, options: WidgetSchedulerOptions = {}) {
    this.runtime = options.runtime ?? browserRuntime;
    this.visible = options.visible ?? true;
    this.paused = options.paused ?? false;
    const calmFps = options.calmFps ?? 15;
    const transientFps = options.transientFps ?? 30;
    this.maxDelta = options.maxDeltaSeconds ?? .25;
    if (![calmFps, transientFps, this.maxDelta].every(value => Number.isFinite(value) && value > 0)) {
      throw new RangeError('Frame rates and maximum delta must be positive finite numbers');
    }
    if (transientFps < calmFps) throw new RangeError('Transient frame rate must be at least the calm frame rate');
    if (Boolean(this.runtime.requestAnimationFrame) !== Boolean(this.runtime.cancelAnimationFrame)) {
      throw new TypeError('requestAnimationFrame and cancelAnimationFrame must be provided together');
    }
    this.calmInterval = 1000 / calmFps;
    this.transientInterval = 1000 / transientFps;
  }

  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    this.lastAdvanceAt = this.runtime.now();
    this.wakeFrame = true;
    this.dirty = true;
    this.reconcile();
  }

  stop(): void {
    this.started = false;
    this.cancelScheduled();
    this.lastAdvanceAt = null;
    this.nextTickAt = null;
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible || this.disposed) return;
    this.visible = visible;
    this.cancelScheduled();
    this.lastAdvanceAt = null;
    this.nextTickAt = null;
    this.boostedUntil = 0;
    if (visible) {
      this.dirty = true;
      this.wakeFrame = true;
    }
    this.reconcile();
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused || this.disposed) return;
    this.paused = paused;
    this.cancelScheduled();
    this.lastAdvanceAt = null;
    this.nextTickAt = null;
    this.boostedUntil = 0;
    if (!paused) {
      this.dirty = true;
      this.wakeFrame = true;
    }
    this.reconcile();
  }

  /** Intake can remain transient until its animation completes, without an off timer. */
  setTransient(active: boolean): void {
    if (this.transient === active || this.disposed) return;
    const before = this.activeMode(this.runtime.now());
    this.transient = active;
    if (before !== this.activeMode(this.runtime.now())) this.retime();
  }

  /** A drag can extend a short activity window; it does not add a separate timer. */
  boost(durationMs = 250): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) throw new RangeError('Boost duration must be a nonnegative finite number');
    if (this.disposed || !this.visible || this.paused || durationMs === 0) return;
    const now = this.runtime.now(), before = this.activeMode(now);
    this.boostedUntil = Math.max(this.boostedUntil, now + durationMs);
    if (before !== this.activeMode(now)) this.retime();
  }

  /**
   * Paused: coalesce requests into one zero-delta draw. Active: use the next paced
   * frame, so frequent pointer events cannot bypass the 30 fps work budget.
   * Hidden: remember the request but schedule nothing until visible again.
   */
  invalidate(): void {
    if (this.disposed) return;
    this.invalidations++;
    this.dirty = true;
    this.reconcile();
  }

  inspect() {
    const now = this.runtime.now();
    return {
      started: this.started,
      disposed: this.disposed,
      visible: this.visible,
      paused: this.paused,
      mode: !this.started ? 'stopped' : !this.visible ? 'hidden' : this.paused ? 'paused' : this.activeMode(now),
      frames: this.frames,
      ticks: this.ticks,
      redraws: this.redraws,
      invalidations: this.invalidations,
      timerCallbacks: this.timerCallbacks,
      rafCallbacks: this.rafCallbacks,
      elapsedSeconds: this.elapsed,
      lastFrameAt: this.lastFrameAt,
      timerPending: this.timerPending,
      rafPending: this.rafPending,
      pending: Number(this.timerPending) + Number(this.rafPending),
      nextDueAt: this.timerDueAt,
      boostedUntil: this.boostedUntil,
      dirty: this.dirty,
    };
  }

  private activeMode(now: number): 'calm' | 'transient' {
    return this.transient || now < this.boostedUntil ? 'transient' : 'calm';
  }

  private interval(now: number): number {
    return this.activeMode(now) === 'transient' ? this.transientInterval : this.calmInterval;
  }

  private retime(): void {
    if (this.started && this.visible && !this.paused && !this.wakeFrame && this.lastAdvanceAt !== null) {
      this.nextTickAt = this.lastAdvanceAt + this.interval(this.runtime.now());
      this.cancelScheduled();
    }
    this.reconcile();
  }

  private reconcile(): void {
    if (!this.started || this.disposed || !this.visible) return;
    if (this.paused && !this.dirty) return;
    const now = this.runtime.now();
    const dueAt = this.paused || this.wakeFrame ? now : this.nextTickAt ?? now + this.interval(now);
    // Keep a due RAF, and keep an already earlier timer, rather than producing
    // more callbacks when invalidation events arrive repeatedly.
    if (this.rafPending || (this.timerPending && this.timerDueAt !== null && this.timerDueAt <= dueAt)) return;
    this.cancelScheduled();
    const generation = this.generation;
    this.timerPending = true;
    this.timerDueAt = dueAt;
    this.timer = this.runtime.setTimeout(() => {
      if (generation !== this.generation) return;
      this.timerCallbacks++;
      this.timerPending = false;
      this.timerDueAt = null;
      if (!this.started || !this.visible || this.disposed) return;
      if (this.runtime.requestAnimationFrame) {
        this.rafPending = true;
        this.raf = this.runtime.requestAnimationFrame(() => {
          if (generation !== this.generation) return;
          this.rafCallbacks++;
          this.rafPending = false;
          this.draw();
        });
      } else this.draw();
    }, Math.max(0, dueAt - now));
  }

  private draw(): void {
    if (!this.started || !this.visible || this.disposed || (this.paused && !this.dirty)) return;
    const now = this.runtime.now();
    const redraw = this.paused || this.wakeFrame;
    const dt = redraw || this.lastAdvanceAt === null ? 0 : Math.min(this.maxDelta, Math.max(0, (now - this.lastAdvanceAt) / 1000));
    const mode = this.paused ? 'paused' : this.activeMode(now);
    this.dirty = false;
    this.wakeFrame = false;
    this.lastFrameAt = now;
    this.frames++;
    if (redraw) this.redraws++; else this.ticks++;
    this.elapsed += dt;
    this.lastAdvanceAt = this.paused ? null : now;
    this.nextTickAt = this.paused ? null : now + this.interval(now);
    try {
      this.onFrame({ now, dt, mode, reason: redraw ? 'invalidate' : 'tick' });
    } catch (error) {
      this.stop();
      throw error;
    }
    this.reconcile();
  }

  private cancelScheduled(): void {
    this.generation++;
    if (this.timerPending) this.runtime.clearTimeout(this.timer);
    if (this.rafPending) this.runtime.cancelAnimationFrame!(this.raf);
    this.timerPending = false;
    this.rafPending = false;
    this.timerDueAt = null;
  }
}
