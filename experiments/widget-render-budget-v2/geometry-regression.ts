import { GlyphScene as Candidate } from '/src/scene.ts';
import { GlyphScene as Baseline } from '/.local/widget-render-budget-baseline.ts';
import { Matter } from '/src/model.ts';
import { DEFAULT_SPEC, SHAPES } from '/src/language.ts';
import { defaultSkeletonSpec } from '/src/skeleton-surface.ts';

const hosts = ['baseline', 'candidate'].map(id => document.getElementById(id)!);
const matters = [new Matter(), new Matter()];
const options = { pixelRatio: 1, antialias: false, preserveDrawingBuffer: false, maxDrawnGlyphs: 1536 };
const scenes = [new Baseline(hosts[0], matters[0], options), new Candidate(hosts[1], matters[1], options)];
const fields = ['positions', 'morphTargets', 'origins', 'sources', 'frames', 'born', 'uv', 'inks', 'birthSizes'] as const;
const sizes = { positions: 3, morphTargets: 3, origins: 3, sources: 3, frames: 4, born: 1, uv: 2, inks: 4, birthSizes: 1 };
const errors: { case: string; field: string; index: number; baseline: number; candidate: number }[] = [];
let compared = 0, frames = 0, maxError = 0;
const gpuRender = scenes.map(scene => scene.renderer.render.bind(scene.renderer));
const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

function add(count: number, ink: 'white' | 'blue' = 'white') {
  const symbols = ['あ', 'A', '?', 'é', '⛄️', '👩‍💻'];
  let remaining = count;
  while (remaining > 0) {
    const take = Math.min(1024, remaining);
    const text = Array.from({ length: take }, (_, i) => symbols[i % symbols.length]).join('');
    for (const matter of matters) matter.add(text, 1, { ink, seed: 918 + remaining });
    remaining -= take;
  }
}

function reset(count: number, initialShape = 'condense') {
  for (const matter of matters) { matter.reset(7); matter.spec = { ...DEFAULT_SPEC, shape: initialShape } as typeof matter.spec; }
  for (const scene of scenes) scene.reset();
  const first = Math.floor((count - 1) / 2);
  add(first); add(count - 1 - first, 'blue');
  for (const scene of scenes) scene.sync([{ x: 170, y: 390 }, { x: 225, y: 390 }], 16);
}

function compare(name: string, phases = true) {
  const [a, b] = scenes;
  assert(a.count === b.count, `${name}: instance count changed`);
  assert(JSON.stringify(a.displayedGlyphs) === JSON.stringify(b.displayedGlyphs), `${name}: glyph identity/text/ink changed`);
  assert(JSON.stringify(matters[0].batches) === JSON.stringify(matters[1].batches), `${name}: stored input changed`);
  for (const field of [...fields, ...(phases ? ['phases' as const] : [])]) {
    const count = a.count * (field === 'phases' ? 1 : sizes[field]);
    for (let i = 0; i < count; i++) {
      const av = a[field][i], bv = b[field][i];
      assert(Number.isFinite(av) && Number.isFinite(bv), `${name}: nonfinite ${field}[${i}]`);
      const error = Math.abs(av - bv); maxError = Math.max(maxError, error); compared++;
      if (av !== bv && errors.length < 20) errors.push({ case: name, field, index: i, baseline: av, candidate: bv });
    }
  }
  for (const field of ['formation', 'scale', 'distance', 'seedFocus']) assert(a[field as 'formation'] === b[field as 'formation'], `${name}: ${field} changed`);
  frames++;
}

function advance(time: number, name: string, phases = true) {
  for (let i = 0; i < scenes.length; i++) { const dt = time - matters[i].time; matters[i].time = time; scenes[i].render(Math.max(0, Math.min(.06666666666666667, dt))); }
  compare(name, phases);
}

const times = [0, .016, .5, 1.59, 1.61, 3.699999, 3.7, 3.700001, 8, 137.7];
const part = (id: string, primitive: string, twist = .8) => ({ id, primitive, height: 1.2, width: .7, depth: .45, bend: .4, twist });

async function geometryRegression() {
  for (const scene of scenes) scene.renderer.render = () => {};
  for (const shape of SHAPES) {
    reset(256, shape);
    for (const time of times) advance(time, `${shape}/surface/${time}`);
  }
  for (const count of [1, 8, 16, 1536]) {
    reset(count, 'mobius');
    for (const time of times) advance(time, `count-${count}/${time}`);
  }
  for (const motion of ['breathe', 'wave'] as const) for (const shape of ['condense', 'cube', 'mobius', 'jellyfish', 'bird', 'fish', 'snake'] as const) {
    reset(256, shape);
    for (const matter of matters) matter.spec.motion = motion;
    for (const time of times) advance(time, `${shape}/${motion}/${time}`);
  }
  for (const spec of [
    { shape: 'mobius', count: 1, deformation: 'omega', arrangement: 'single', mode: 'flow' },
    { shape: 'ring', count: 8, deformation: 'gentle', arrangement: 'swarm', mode: 'surface' },
    { shape: 'cube', count: 4, deformation: 'gentle', arrangement: 'chain', mode: 'surface' },
    { shape: 'condense', count: 1, deformation: 'double', arrangement: 'single', mode: 'flow' },
  ]) {
    reset(256);
    for (const scene of scenes) scene.setSpec({ ...DEFAULT_SPEC, ...spec } as typeof matters[0]['spec']);
    for (const time of times) advance(time, `arrangement-${JSON.stringify(spec)}/${time}`);
  }
  for (const family of ['sphere', 'cube', 'mobius', 'ring', 'vase', 'sword'] as const) {
    reset(256);
    for (const scene of scenes) scene.setSkeleton({ ...defaultSkeletonSpec(family), bend: .4, twist: .8, neck: .6 });
    for (const time of times) advance(time, `skeleton-${family}/${time}`);
  }
  for (const primitive of ['sphere', 'box', 'tube', 'blade', 'ring', 'vase']) {
    reset(256);
    for (const scene of scenes) assert(scene.setProgram({ version: 1, parts: [part('body', primitive)] } as Parameters<typeof Candidate.prototype.setProgram>[0]), 'invalid program fixture');
    for (const time of times) advance(time, `program-${primitive}/${time}`);
  }
  for (const kind of ['end', 'above', 'through'] as const) {
    reset(256);
    for (const scene of scenes) assert(scene.setProgram({ version: 1, parts: [part('base', 'box', .5), part('child', kind === 'end' ? 'sphere' : 'ring', -.4)], relation: { kind, parent: 'base', child: 'child' } } as Parameters<typeof Candidate.prototype.setProgram>[0]), 'invalid relation fixture');
    for (const time of times) advance(time, `relation-${kind}/${time}`);
  }
  // New letters still in transit while old letters change shape and time stops.
  reset(256, 'condense'); advance(9, 'morph-setup');
  add(128, 'blue'); for (const scene of scenes) { scene.sync([{ x: 70, y: 410 }], 16); scene.setSpec({ ...DEFAULT_SPEC, shape: 'mobius' }); }
  for (const time of [9, 9.01, 9.8, 10.59, 10.61, 11.8, 12.7, 12.7, 20]) advance(time, `intake-morph/${time}`);
  // Same stored inputs and sampled IDs; free-spin phase intentionally gains stable IDs.
  reset(32000, 'bird');
  for (const time of [0, .2, 1.7, 3.7, 40]) advance(time, `saved-cap/${time}`, false);
  assert(matters[1].glyphs.length === 32000 && scenes[1].count === 1536, 'history truncated instead of sampled');
  const oldPhases = new Map(scenes[1].displayedGlyphs.map((g, i) => [g.id, scenes[1].phases[i]]));
  // Re-run the actual sampler with fewer stored glyphs to make its membership shift.
  // These are artificial states only; the application never removes this history.
  reset(16000, 'fish');
  const phaseBefore = new Map(scenes[1].displayedGlyphs.map((g, i) => [g.id, scenes[1].phases[i]]));
  add(1000, 'blue'); for (const scene of scenes) scene.sync();
  let retained = 0;
  scenes[1].displayedGlyphs.forEach((g, i) => { if (phaseBefore.has(g.id)) { assert(scenes[1].phases[i] === phaseBefore.get(g.id), `resampled glyph ${g.id} changed phase`); retained++; } });
  assert(retained > 100, 'insufficient retained glyphs for phase check');
  for (const time of [0, 1, 4, 50]) advance(time, `sampler-growth/${time}`, false);
  for (let i = 0; i < scenes.length; i++) scenes[i].renderer.render = gpuRender[i];
  assert(errors.length === 0, `geometry changed: ${JSON.stringify(errors)}`);
  return { frames, comparedComponents: compared, maxAbsoluteError: maxError, exact: errors.length === 0, errors, phaseRetained: retained, previousCapPhaseCount: oldPhases.size, shapes: SHAPES.length };
}

function pixels(scene: InstanceType<typeof Candidate>) {
  const gl = scene.renderer.getContext();
  const pixels = new Uint8Array(400 * 440 * 4);
  gl.readPixels(0, 0, 400, 440, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return pixels;
}

function captureUploads(scene: InstanceType<typeof Candidate>) {
  const gl = scene.renderer.getContext(), calls: { bytes: number; range: boolean }[] = [];
  const original = gl.bufferSubData.bind(gl);
  gl.bufferSubData = ((...args: unknown[]) => {
    const array = args[2] as Float32Array;
    const count = typeof args[4] === 'number' ? args[4] as number : array.length;
    calls.push({ bytes: count * array.BYTES_PER_ELEMENT, range: args.length > 3 });
    return (original as (...values: unknown[]) => void)(...args);
  }) as typeof gl.bufferSubData;
  return { calls, restore() { gl.bufferSubData = original; } };
}

async function gpuRegression() {
  const results = [];
  for (const shape of ['condense', 'cube', 'mobius', 'jellyfish', 'bird', 'fish', 'snake']) {
    reset(1536, shape);
    for (const matter of matters) matter.time = 20;
    for (const scene of scenes) scene.render(.06666666666666667);
    // Second draw uploads only changing center/frame, not input-time attributes.
    const captures = scenes.map(captureUploads);
    const images = scenes.map(scene => { scene.render(.06666666666666667); return pixels(scene); });
    captures.forEach(capture => capture.restore());
    let differingChannels = 0, nonblack = 0;
    for (let i = 0; i < images[0].length; i++) { if (images[0][i] !== images[1][i]) differingChannels++; if (i % 4 !== 3 && images[1][i] > 0) nonblack++; }
    assert(differingChannels === 0, `${shape}: screenshot differs despite exact geometry`);
    assert(nonblack > 100, `${shape}: no rendered body`);
    assert(scenes.every(scene => scene.renderer.getContext().getError() === 0), `${shape}: WebGL error`);
    results.push({ shape, differingChannels, nonblack, uploadBytes: captures.map(capture => capture.calls.reduce((n, call) => n + call.bytes, 0)), drawCalls: scenes.map(scene => scene.renderer.info.render.calls) });
  }
  // Two syncs without drawing must upload BOTH accepted batches and correct UV/color.
  reset(32, 'mobius'); advance(10, 'deferred-setup');
  add(17, 'blue'); for (const scene of scenes) scene.sync();
  add(23, 'white'); for (const scene of scenes) scene.sync();
  const pending = scenes[1].geometry.getAttribute('inkColor').updateRanges.map(range => ({ ...range }));
  assert(pending.length === 1 && pending[0].start <= 32 * 4 && pending[0].start + pending[0].count >= 72 * 4, 'deferred input lost its upload range');
  for (const matter of matters) matter.time = 11;
  const images = scenes.map(scene => { scene.render(.06666666666666667); return pixels(scene); });
  assert(images[0].every((value, i) => value === images[1][i]), 'deferred input differs on GPU');
  // The unbounded entry point retains its historical buffer defaults.
  const host = document.createElement('div'); host.style.cssText = 'position:absolute;width:400px;height:440px;left:0;top:0'; document.body.appendChild(host);
  const full = new Candidate(host, new Matter(), { pixelRatio: 1, antialias: false, preserveDrawingBuffer: false });
  assert(full.capacity === 32000 && full.positions.length === 96000, 'original default capacity changed');
  full.render(0); assert(full.renderer.getContext().getError() === 0, 'default scene WebGL error');
  full.resizeObserver.disconnect(); full.renderer.dispose(); full.geometry.dispose(); full.material.dispose(); full.atlas.texture.dispose(); host.remove();
  return { shapes: results, deferredInputs: { count: 72, pendingRange: pending, pixelsExact: true }, defaultCapacity: 32000, maxVertexAttributes: scenes[1].renderer.getContext().getParameter(scenes[1].renderer.getContext().MAX_VERTEX_ATTRIBS) };
}

const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
async function benchmark() {
  const rows = [];
  for (const geometryOnly of [true, false]) for (const shape of ['condense', 'cube', 'mobius', 'jellyfish', 'bird', 'fish', 'snake', 'program-vase']) {
    reset(1536, shape === 'program-vase' ? 'condense' : shape);
    if (shape === 'program-vase') for (const scene of scenes) scene.setProgram({ version: 1, parts: [part('vase', 'vase')] } as Parameters<typeof Candidate.prototype.setProgram>[0]);
    const runs: { scene: string; msMean: number; msP50: number; msP95: number; samples: number }[] = [];
    // Alternating AB / BA avoids assigning every warm-start advantage to one version.
    for (const index of [0, 1, 1, 0]) {
      const scene = scenes[index], matter = matters[index];
      scene.renderer.render = geometryOnly ? () => {} : gpuRender[index];
      matter.time = 20;
      for (let frame = 0; frame < 90; frame++) { matter.time += 1 / 15; scene.render(1 / 15); }
      const values = [];
      for (let frame = 0; frame < 180; frame++) {
        if (!geometryOnly && frame % 15 === 0) await new Promise<void>(requestAnimationFrame);
        matter.time += 1 / 15; const started = performance.now(); scene.render(1 / 15); values.push(performance.now() - started);
      }
      runs.push({ scene: index === 0 ? 'baseline' : 'candidate', msMean: values.reduce((a, b) => a + b, 0) / values.length, msP50: percentile(values, .5), msP95: percentile(values, .95), samples: values.length });
    }
    for (let i = 0; i < scenes.length; i++) scenes[i].renderer.render = gpuRender[i];
    rows.push({ shape, geometryOnly, runs });
  }
  const byteFields = [...fields, 'phases' as const];
  return { viewport: [400, 440], pixelRatio: 1, displayed: 1536, logicalFps: 15, timing: 'performance.now around render: JS geometry or JS plus WebGL command submission, not process CPU or completed GPU time', cpuArrayBytes: scenes.map(scene => byteFields.reduce((n, field) => n + scene[field].byteLength, 0)), rows };
}

(window as unknown as { runRenderBudget: () => Promise<unknown> }).runRenderBudget = async () => {
  const started = performance.now();
  const geometry = await geometryRegression();
  const gpu = await gpuRegression();
  const timings = await benchmark();
  return { geometry, gpu, timings, elapsedMs: performance.now() - started, userAgent: navigator.userAgent };
};
