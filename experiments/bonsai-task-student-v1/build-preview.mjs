import { build } from '../../prototypes/glyph-creature/node_modules/vite/dist/node/index.js';
import config from './vite.preview.config.mjs';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
await build({ ...config, configFile: false });
const out = new URL('../../.local/bonsai-task-student-v1/web-build/', import.meta.url);
mkdirSync(new URL('licenses/', out), { recursive: true });
for (const [source, target] of [
  ['../../prototypes/glyph-creature/node_modules/three/LICENSE', 'licenses/three-LICENSE.txt'],
  ['./static-candidate/assets/LICENSE-MIT.txt', 'licenses/static-model-MIT.txt'],
  ['./static-candidate/assets/NOTICE.md', 'licenses/static-model-NOTICE.md'],
  ['../../prototypes/glyph-creature/src/task-student-v1/static-runtime/NOTICE.md', 'licenses/static-runtime-NOTICE.md'],
  ['../native-static-japanese-v1/upstream/LICENSE', 'licenses/tokenizers-Apache-2.0.txt'],
]) copyFileSync(new URL(source, import.meta.url), new URL(target, out));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: new URL('../../', import.meta.url), encoding: 'utf8' }).trim();
writeFileSync(new URL('version.json', out), JSON.stringify({ ref: 'glyph-matter-v0.15.0-task-student.1', commit, default: 'static-seed', scope: 'Separate experimental 60 authored surfaces plus learned bounded attributes; negative text failures remain; no external text transmission or persistence' }, null, 2) + '\n');
