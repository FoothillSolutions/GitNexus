import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5175',
    headless: true,
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--enable-webgl', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
