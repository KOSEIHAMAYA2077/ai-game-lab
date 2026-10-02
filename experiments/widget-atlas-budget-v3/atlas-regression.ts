import { GlyphScene as Candidate } from '/src/scene.ts';
import { GlyphScene as Baseline } from '/.local/widget-atlas-baseline.ts';
import { Matter } from '/src/model.ts';
import { DEFAULT_SPEC } from '/src/language.ts';

const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const hosts = ['baseline', 'candidate'].map(id => document.getElementById(id)!);
const matters = [new Matter(), new Matter()];
const options = { pixelRatio: 1, antialias: false, preserveDrawingBuffer: false, maxDrawnGlyphs: 1536 };
const scenes = [new Baseline(hosts[0], matters[0], options), new Candidate(hosts[1], matters[1], { ...options, dynamicAtlas: true })];
const boundaries = [1, 32, 33, 64, 65, 128, 129, 256, 257, 512, 513, 1024];
const corpus = ['@', 'a', 'A', '0', '?', 'あ', 'い', '漢', 'e\u0301', '⛄️', '👩‍💻', '🇯🇵', '1️⃣', '🧑🏽‍🚀', 'Ω'].map(x => x.normalize('NFC'));
for (let point = 0x4e00; corpus.length < 1024; point++) {
  const glyph = String.fromCodePoint(point);
  if (!corpus.includes(glyph)) corpus.push(glyph);
}

function addUntil(kinds: number) {
  const current = matters[0].kinds.size;
  assert(current <= kinds, 'fixture must only grow');
  if (current < kinds) for (const matter of matters) matter.add(corpus.slice(current, kinds).join(''), 1, { ink: current % 2 ? 'blue' : 'white', seed: current * 751 + 89 });
}

function draw(time: number) {
  for (let i = 0; i < scenes.length; i++) { matters[i].time = time; scenes[i].render(1 / 15); }
}

function identity() {
  assert(JSON.stringify(matters[0].glyphs) === JSON.stringify(matters[1].glyphs), 'original ID/text/color/birth changed');
  assert(JSON.stringify(matters[0].batches) === JSON.stringify(matters[1].batches), 'stored input changed');
  assert(JSON.stringify([...scenes[0].atlas.ids]) === JSON.stringify([...scenes[1].atlas.ids]), 'atlas tile IDs changed');
  for (const field of ['positions', 'morphTargets', 'origins', 'sources', 'frames', 'born', 'phases', 'inks', 'birthSizes']) {
    const size = ({ positions: 3, morphTargets: 3, origins: 3, sources: 3, frames: 4, born: 1, phases: 1, inks: 4, birthSizes: 1 })[field];
    for (let i = 0; i < scenes[0].count * size; i++) assert(scenes[0][field][i] === scenes[1][field][i] && Number.isFinite(scenes[1][field][i]), `${field}[${i}] differs`);
  }
}

function canvasPixels() {
  const a = scenes[0].atlas.ctx.getImageData(0, 0, 2048, scenes[1].atlas.canvas.height).data;
  const b = scenes[1].atlas.ctx.getImageData(0, 0, 2048, scenes[1].atlas.canvas.height).data;
  let differingChannels = 0, maximum = 0;
  for (let i = 0; i < a.length; i++) { const error = Math.abs(a[i] - b[i]); if (error) differingChannels++; maximum = Math.max(maximum, error); }
  assert(differingChannels === 0, `canvas glyph pixels changed: ${differingChannels} channels, max ${maximum}`);
  return { differingChannels, maxChannelDifference: maximum, comparedChannels: a.length };
}

function gpuPixels(scene: InstanceType<typeof Candidate>) {
  const gl = scene.renderer.getContext(), buffer = new Uint8Array(400 * 440 * 4);
  gl.readPixels(0, 0, 400, 440, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
  return buffer;
}

function compareGpu(label: string) {
  const images = scenes.map(gpuPixels);
  let maximum = 0, sum = 0, differing = 0, colored = 0;
  for (let i = 0; i < images[0].length; i++) {
    const error = Math.abs(images[0][i] - images[1][i]);
    maximum = Math.max(maximum, error); sum += error; if (error) differing++;
    if (i % 4 !== 3 && images[1][i] > 0) colored++;
  }
  const mean = sum / images[0].length;
  assert(maximum <= 2 && mean <= .01, `${label}: visible texture changed: max ${maximum}, mean ${mean}`);
  assert(colored > 100, `${label}: empty screen`);
  assert(scenes.every(scene => scene.renderer.getContext().getError() === 0), `${label}: WebGL error`);
  assert(scenes.every(scene => scene.renderer.info.memory.textures === 1), `${label}: old GPU atlas retained`);
  return { maxChannelDifference: maximum, meanChannelDifference: mean, differingChannels: differing, coloredChannels: colored, gpuTextureCounts: scenes.map(scene => scene.renderer.info.memory.textures) };
}

function syncWithDisposeCheck() {
  const previous = scenes[1].atlas.texture, oldRows = scenes[1].atlas.rows;
  let disposed = false; previous.addEventListener('dispose', () => { disposed = true; });
  const start = performance.now(); scenes.forEach(scene => scene.sync([{ x: 170, y: 390 }], 16));
  const syncMs = performance.now() - start;
  const changed = scenes[1].atlas.texture !== previous;
  assert(changed === disposed, 'texture replacement did not release exactly the previous GPU atlas');
  assert(!changed || scenes[1].atlas.rows > oldRows, 'growth unexpectedly shrank atlas');
  return { changed, oldRows, rows: scenes[1].atlas.rows, disposed, combinedSyncMs: syncMs };
}

async function run() {
  const checkpoints = [];
  for (const count of boundaries) {
    addUntil(count);
    const replacement = syncWithDisposeCheck();
    const expectedRows = 2 ** Math.ceil(Math.log2(Math.max(1, Math.ceil(count / 32))));
    assert(scenes[1].atlas.rows === expectedRows, `wrong rows at ${count} kinds`);
    assert(scenes[1].material.uniforms.atlasRows.value === expectedRows && scenes[1].material.uniforms.atlas.value === scenes[1].atlas.texture, 'shader uses an old atlas');
    for (let i = 0; i < scenes[1].count; i++) {
      const tile = scenes[1].atlas.ids.get(scenes[1].displayedGlyphs[i].text)!;
      assert(scenes[1].uv[i * 2] === (tile % 32) / 32 && scenes[1].uv[i * 2 + 1] === 1 - (Math.floor(tile / 32) + 1) / expectedRows, 'old UV not rescaled');
    }
    const canvas = canvasPixels(); draw(50 + count); identity();
    const gpu = compareGpu(`kinds-${count}`);
    checkpoints.push({ kinds: count, rows: expectedRows, pixelBytes: 2048 * 64 * expectedRows * 4, replacement, canvas, gpu });
  }

  const forms = [];
  // Shrink and regrow at reset boundaries, keeping the fixed baseline intact.
  for (const count of [1, 33, 257, 1024, 1]) {
    const oldTexture = scenes[1].atlas.texture;
    let disposed = false; oldTexture.addEventListener('dispose', () => { disposed = true; });
    for (let i = 0; i < scenes.length; i++) { matters[i].reset(19); scenes[i].reset(); }
    assert(scenes[1].atlas.rows === 1 && scenes[1].atlas.ids.size === 1 && scenes[0].atlas.canvas.height === 2048, 'reset does not restore independent capacity');
    if (oldTexture !== scenes[1].atlas.texture) assert(disposed, 'shrinking atlas retains old texture');
    addUntil(count); syncWithDisposeCheck();
    canvasPixels();
    for (const shape of ['condense', 'cube', 'mobius', 'jellyfish', 'bird', 'fish', 'snake']) {
      for (const scene of scenes) scene.setSpec({ ...DEFAULT_SPEC, shape } as typeof matters[0]['spec']);
      draw(75); identity(); const gpu = compareGpu(`reset-${count}/${shape}`);
      forms.push({ kinds: count, shape, rows: scenes[1].atlas.rows, gpu });
    }
  }

  // Grow twice before a single draw: every old/new UV must use the final rows.
  for (let i = 0; i < scenes.length; i++) { matters[i].reset(31); scenes[i].reset(); }
  draw(5); addUntil(33); syncWithDisposeCheck(); addUntil(65); syncWithDisposeCheck();
  const pending = scenes[1].geometry.getAttribute('atlasOffset').updateRanges.map(range => ({ ...range }));
  assert(pending.length === 1 && pending[0].start === 0 && pending[0].count === 65 * 2, 'deferred growth dropped old UV updates');
  draw(5.7); identity(); const deferredGpu = compareGpu('deferred-grow'); canvasPixels();

  // Stored history reaches its cap; resampling does not require a new atlas or lose text.
  addUntil(1024); syncWithDisposeCheck();
  const text = corpus.slice(1).join('');
  for (const matter of matters) matter.add(text, 32, { ink: 'blue', seed: 77881 });
  scenes.forEach(scene => scene.sync()); draw(20); identity(); compareGpu('stored-cap');
  assert(matters.every(m => m.glyphs.length === 32000) && scenes.every(s => s.count === 1536), 'stored history was deleted');

  // A third scene without the new option must retain the frozen fixed mode.
  const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:0;top:0;width:400px;height:440px'; document.body.appendChild(host);
  const fixed = new Candidate(host, new Matter(), options);
  assert(fixed.atlas.rows === 32 && !fixed.atlas.dynamic && fixed.atlas.canvas.height === 2048, 'default became dynamic');
  fixed.render(0); assert(fixed.renderer.getContext().getError() === 0, 'fixed shader failed');
  matters[0].reset(); scenes[0].reset(); scenes[0].render(0);
  const frozenFixedPixels = gpuPixels(scenes[0]), currentFixedPixels = gpuPixels(fixed);
  assert(frozenFixedPixels.every((channel, i) => channel === currentFixedPixels[i]), 'unchanged fixed mode differs on GPU');
  fixed.resizeObserver.disconnect(); fixed.renderer.dispose(); fixed.geometry.dispose(); fixed.material.dispose(); fixed.atlas.texture.dispose(); host.remove();
  return { checkpoints, forms, deferred: { kinds: 65, rows: 4, pending, gpu: deferredGpu }, storedHistory: 32000, drawn: 1536, defaultRows: 32, defaultPixelsExact: true, tolerance: { maxChannelDifference: 2, meanChannelDifference: .01 }, diskOrUserFilesDeleted: false, metric: 'Canvas RGBA logical bytes and renderer-owned texture count; not process RAM or GPU-memory measurement', userAgent: navigator.userAgent };
}

(window as unknown as { runAtlasBudget: () => Promise<unknown> }).runAtlasBudget = run;
