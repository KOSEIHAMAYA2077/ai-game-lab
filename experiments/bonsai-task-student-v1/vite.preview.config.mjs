import {defineConfig} from '../../prototypes/glyph-creature/node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
export default defineConfig({
  root:fileURLToPath(new URL('../../prototypes/glyph-creature/src/task-student-v1/',import.meta.url)),
  base:'./',
  build:{emptyOutDir:false,outDir:fileURLToPath(new URL('../../.local/bonsai-task-student-v1/web-build/',import.meta.url)),rolldownOptions:{input:fileURLToPath(new URL('../../prototypes/glyph-creature/src/task-student-v1/preview.html',import.meta.url))}},
});
