import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  base: './',
  build: { rolldownOptions: { input: {
    main: fileURLToPath(new URL('./index.html', import.meta.url)),
    strokes: fileURLToPath(new URL('./strokes.html', import.meta.url)),
    skeleton: fileURLToPath(new URL('./skeleton.html', import.meta.url)),
  } } },
});
