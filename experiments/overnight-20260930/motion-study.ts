/** Independent numerical study; not imported by the application. Run with Node 26. */
import assert from 'node:assert/strict';

type V3 = [number, number, number];
const TAU = Math.PI * 2;
const fract = (x: number) => x - Math.floor(x);
const smooth = (x: number) => { const a = Math.max(0, Math.min(1, x)); return a * a * (3 - 2 * a); };
const norm = (p: V3) => Math.hypot(...p);
const distance = (a: V3, b: V3) => norm(a.map((v, i) => v - b[i]) as V3);

/** A global similarity transform: angles, straight edges, and proportions survive. */
export function breathing(p: V3, t: number, phase = 0): V3 {
  const scale = Math.exp(.12 * Math.sin(.75 * t + phase));
  return p.map(x => x * scale) as V3;
}

/** A smooth invertible twist: no per-glyph noise, so coincident seam points stay coincident. */
export function wave(p: V3, t: number, inverse = false): V3 {
  const angle = .20 * Math.sin(1.7 * p[1] - .8 * t) * (inverse ? -1 : 1);
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c * p[0] - s * p[2], p[1], s * p[0] + c * p[2]];
}

/** Sphere-only descending surface flow; the north/south teleport happens at opacity zero. */
export function rainSphere(id: number, t: number, seed = 1): { point: V3; opacity: number; phase: number } {
  const phase = fract((id + seed * .27) * .754877666246693 + .12 * t);
  const azimuth = (id + seed * .13) * 2.399963229728653 + .12 * t;
  const y = 1 - 2 * phase;
  const radial = Math.sqrt(Math.max(0, 1 - y * y));
  return {
    point: [1.2 * radial * Math.cos(azimuth), 1.2 * y, 1.2 * radial * Math.sin(azimuth)],
    opacity: smooth(phase / .055) * smooth((1 - phase) / .055),
    phase,
  };
}

/** Bonus: three equal spheres, vertically stacked, with no new text labels learned. */
export function dango(id: number, t: number, seed = 1): V3 {
  const group = id % 3;
  const local = Math.floor(id / 3);
  const a = fract((local + seed * .13) * .618033988749895);
  const b = fract((local + seed * .27) * .754877666246693);
  const y = 1 - 2 * b, radial = Math.sqrt(1 - y * y);
  const angle = a * TAU + t * (.22 + group * .025);
  const r = .46, center = (group - 1) * .88;
  return [r * radial * Math.cos(angle), center + r * y, r * radial * Math.sin(angle)];
}

let breathingMin = Infinity, breathingMax = 0, waveInverseError = 0, waveRadiusError = 0;
let rainRadiusError = 0, rainVisible = 0, rainSamples = 0, rainDownward = 0, rainComparisons = 0;
let dangoRadiusError = 0;
const probe: V3 = [.8, -.6, 1];
for (let k = 0; k <= 1200; k++) {
  const t = k / 60;
  const breathed = breathing(probe, t), ratio = norm(breathed) / norm(probe);
  breathingMin = Math.min(breathingMin, ratio); breathingMax = Math.max(breathingMax, ratio);
  assert(Math.abs(breathed[0] / probe[0] - breathed[1] / probe[1]) < 1e-12);
  for (let id = 0; id < 256; id++) {
    const p: V3 = [Math.cos(id), 1.4 * Math.sin(id * .71), Math.sin(id)];
    const q = wave(p, t);
    waveInverseError = Math.max(waveInverseError, distance(wave(q, t, true), p));
    waveRadiusError = Math.max(waveRadiusError, Math.abs(norm(q) - norm(p)));
    const rain = rainSphere(id, t), next = rainSphere(id, t + .001);
    rainRadiusError = Math.max(rainRadiusError, Math.abs(norm(rain.point) - 1.2));
    rainSamples++; if (rain.opacity > .5) rainVisible++;
    if (next.phase > rain.phase) { rainComparisons++; if (next.point[1] < rain.point[1]) rainDownward++; }
    const ball = dango(id, t), center = (id % 3 - 1) * .88;
    dangoRadiusError = Math.max(dangoRadiusError, Math.abs(norm([ball[0], ball[1] - center, ball[2]]) - .46));
    assert(q.every(Number.isFinite) && rain.point.every(Number.isFinite) && ball.every(Number.isFinite));
  }
}
assert(waveInverseError < 1e-12 && waveRadiusError < 1e-12 && rainRadiusError < 1e-12 && dangoRadiusError < 1e-12);
assert(rainDownward === rainComparisons);
assert.deepEqual(rainSphere(25, 312, 13), rainSphere(25, 312, 13));
console.log(JSON.stringify({
  sampleCount: rainSamples,
  breathingScaleRange: [breathingMin, breathingMax],
  waveInverseError, waveRadiusError,
  rainRadiusError, rainVisibleFraction: rainVisible / rainSamples,
  rainDownward, rainComparisons,
  dangoRadiusError,
  caveat: 'Numerical checks only. This independent file is not connected to the app and has not been visually playtested.',
}, null, 2));
