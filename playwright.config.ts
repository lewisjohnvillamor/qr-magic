import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Some CI images ship a prebuilt Chromium at a fixed path rather than the
 * revision Playwright would download. Prefer it when it exists.
 */
const PREINSTALLED_CHROMIUM = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].find((candidate): candidate is string => Boolean(candidate) && existsSync(candidate as string));

/** SwiftShader gives headless Chromium a working WebGL implementation. */
const WEBGL_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--disable-lcd-text',
  '--force-device-scale-factor=1',
  '--hide-scrollbars',
];

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    launchOptions: {
      args: WEBGL_ARGS,
      ...(PREINSTALLED_CHROMIUM ? { executablePath: PREINSTALLED_CHROMIUM } : {}),
    },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
