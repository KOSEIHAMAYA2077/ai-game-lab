import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const testPort = process.env.GLYPH_TEST_PORT ?? '4226';
const baseURL = `http://127.0.0.1:${testPort}`;
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({
  testDir: './tests', workers: 1, timeout: 40_000,
  use: {
    baseURL, viewport: { width: 1440, height: 1000 },
    launchOptions: existsSync(localChrome) ? { executablePath: localChrome } : {},
    trace: 'retain-on-failure',
  },
  webServer: { command: 'npm run dev', url: baseURL, reuseExistingServer: true, timeout: 30_000 },
});
