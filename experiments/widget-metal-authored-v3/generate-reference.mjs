import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Node's native TS type stripping executes the actual local authored functions.
// There are only type imports in word-surfaces.ts; no runtime model/dependency.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = path.join(root, 'prototypes/glyph-creature/src/word-surfaces.ts');
const { wordSurface, wordSurfacePoint } = await import(source);
const shapeCodes = { sword: 3, vase: 4, jellyfish: 5 };
const frames = [], points = [];
const times = [0, .1, 3.6, 7.2, 24, 100, 3600, 28800];
const ids = [...Array(32).keys(), 42, 79, 385, 1535, 31999];
for (const [shape, code] of Object.entries(shapeCodes)) {
  for (const seed of [1, 42, 123456, 4294967295]) for (const time of times) for (const id of ids) {
    const p = [0, 0, 0], u = [0, 0, 0], v = [0, 0, 0];
    wordSurface(shape, id, time, seed, p, u, v);
    frames.push({ shape: code, name: shape, id, seed, time, p, u, v });
  }
  const parts = shape === 'jellyfish' ? [0, 23, 24, 25, 26, 27, 28, 29, 30, 31]
    : shape === 'sword' ? [0, 6, 7, 8, 9] : [0, 9];
  for (const time of times) for (const part of parts) for (const uCoord of [0, .25, .5, 1, 11.125]) for (const vCoord of [.00001, .1, .5, .9, .99999]) {
    const h = .00001;
    const p = wordSurfacePoint(shape, uCoord, vCoord, time, part);
    const a = wordSurfacePoint(shape, uCoord + h, vCoord, time, part), b = wordSurfacePoint(shape, uCoord - h, vCoord, time, part);
    const c = wordSurfacePoint(shape, uCoord, vCoord + h, time, part), d = wordSurfacePoint(shape, uCoord, vCoord - h, time, part);
    const u = a.map((value, i) => (value - b[i]) / (2 * h));
    const v = c.map((value, i) => (value - d[i]) / (2 * h) * (shape === 'sword' && part >= 7 && part < 9 ? -1 : 1));
    points.push({ shape: code, name: shape, time, part, uCoord, vCoord, p, u, v });
  }
}
const sourceBytes = await readFile(source);
const fixture = { schema: 1, source: 'prototypes/glyph-creature/src/word-surfaces.ts', sourceSHA256: createHash('sha256').update(sourceBytes).digest('hex'), node: process.version,
  semantics: 'Actual authored TS; frames via wordSurface; point differentials central h=1e-5 and authored sword crossguard sign.', shapes: shapeCodes, times, frames, points };
const destination = path.join(root, 'desktop/glyph-metal-lab-v3/Tests/word-surface-reference.json');
await writeFile(destination, JSON.stringify(fixture) + '\n', { flag: 'wx' });
const raw = await readFile(destination);
const record = { fixture: 'desktop/glyph-metal-lab-v3/Tests/word-surface-reference.json', sha256: createHash('sha256').update(raw).digest('hex'), bytes: raw.length, frames: frames.length, points: points.length,
  source: fixture.source, sourceSHA256: fixture.sourceSHA256, node: fixture.node, generatedBeforeCPUAndGPUResults: true };
await writeFile(path.join(root, 'experiments/widget-metal-authored-v3/REFERENCE.json'), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(record));
