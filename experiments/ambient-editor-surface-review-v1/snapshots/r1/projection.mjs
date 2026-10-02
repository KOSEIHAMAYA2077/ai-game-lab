// Render metadata only. The receiver owns every material unit and identity.
export const CAPACITY = 256;
export function createProjection() {
  const ids = new Uint32Array(CAPACITY), tiles = new Uint16Array(CAPACITY);
  const inks = new Array(CAPACITY), born = new Float64Array(CAPACITY);
  let count = 0;
  return {
    ids, tiles, inks, born,
    sync(body, presented, time, atlasTile) {
      if (!Number.isSafeInteger(presented) || presented < count || presented > CAPACITY || !Number.isFinite(time)) throw new Error('invalid bounded view');
      let index = 0;
      for (const unit of body) {
        if (index >= presented) break;
        if (!Number.isSafeInteger(unit.id) || unit.id < 1 || unit.id > CAPACITY) throw new Error('invalid receiver identity');
        if (index < count) {
          if (ids[index] !== unit.id || inks[index] !== unit.ink) throw new Error('append view mutated');
        } else {
          ids[index] = unit.id; inks[index] = unit.ink; born[index] = time;
          tiles[index] = atlasTile(unit.text);
        }
        index++;
      }
      if (index !== presented) throw new Error('presented exceeds receiver body');
      const previous = count; count = presented;
      return { previous, count, placeholder: count === 0 };
    },
    get count() { return count; },
    inspect() { return { drawnMaterial: count, placeholder: count === 0, capacity: CAPACITY }; },
  };
}

// A cancellable 15fps timer: inactive periods advance neither callbacks nor visual time.
export function createFrameGate({ clock, schedule, cancel, frame }) {
  const interval = 1000 / 15;
  let timer = null, active = false, destroyed = false, last = null, visual = 0, frames = 0;
  function tick() {
    timer = null;
    if (!active || destroyed) return;
    const now = clock();
    const dt = last === null ? 0 : Math.max(0, Math.min(.25, (now - last) / 1000));
    last = now; visual += dt; frames++;
    frame({ wall: Math.floor(now), time: visual, dt });
    if (active && !destroyed) timer = schedule(tick, interval);
  }
  return {
    setActive(value) {
      if (destroyed || active === value) return;
      active = value; last = null;
      if (timer !== null) cancel(timer);
      timer = active ? schedule(tick, 0) : null;
    },
    destroy() { active = false; destroyed = true; last = null; if (timer !== null) cancel(timer); timer = null; },
    inspect() { return { active, destroyed, frames, visualSeconds: visual, timerPending: timer !== null, fpsLimit: 15 }; },
  };
}
