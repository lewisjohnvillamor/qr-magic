import { mkdirSync, writeFileSync } from 'node:fs';
import { test } from '@playwright/test';
import { experienceUrl, openExperience, SCAN_READY_TIMEOUT } from './helpers';

/**
 * Regenerates the README's images from the running app.
 *
 * Opt-in (`npm run media`) rather than part of the suite: it writes files into
 * the working tree, which a test run should never do. Keeping it as a spec
 * rather than a loose script means the screenshots are captured by exactly the
 * same harness as the tests, so a README picture can never drift from what the
 * product does.
 */
const CAPTURE = process.env.CAPTURE_MEDIA === '1';
const OUT = 'docs/media';
const LINK = 'https://voxelqr.example/hello';
/** Photographic-ish shots ship as JPEG; anything showing modules stays lossless. */
const JPEG = { type: 'jpeg' as const, quality: 82 };

const GALLERY = [
  { sculpture: 'island', theme: 'nature', label: 'sculpture-island-nature' },
  { sculpture: 'city', theme: 'cyber', label: 'sculpture-city-cyber' },
  { sculpture: 'crystal', theme: 'crystal', label: 'sculpture-crystal' },
  { sculpture: 'gift', theme: 'sunset', label: 'sculpture-gift-sunset' },
  { sculpture: 'portal', theme: 'snow', label: 'sculpture-portal-snow' },
  { sculpture: 'cube', theme: 'brand', label: 'sculpture-cube-brand' },
];

test.skip(!CAPTURE, 'Set CAPTURE_MEDIA=1 (npm run media) to regenerate README images.');
test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

test.describe('gallery', () => {
  test.use({ viewport: { width: 1000, height: 640 } });

  for (const item of GALLERY) {
    test(`media ${item.label}`, async ({ page }) => {
      await openExperience(page, { url: LINK, ...item });
      await page.waitForTimeout(800);
      writeFileSync(`${OUT}/${item.label}.jpg`, await page.screenshot(JPEG));
    });
  }

  test('media reveal and scan', async ({ page }) => {
    await openExperience(page, { url: LINK, sculpture: 'island', theme: 'nature' });
    await page.waitForTimeout(700);
    writeFileSync(`${OUT}/app-idle.jpg`, await page.screenshot(JPEG));

    await page.getByTestId('reveal-button').click();
    await page.waitForTimeout(950);
    writeFileSync(`${OUT}/reveal-midway.jpg`, await page.screenshot(JPEG));

    await page
      .getByTestId('phase')
      .filter({ hasText: 'scan-ready' })
      .waitFor({ timeout: SCAN_READY_TIMEOUT });
    await page.waitForTimeout(700);
    // Lossless: the README shows this one as a working code.
    writeFileSync(`${OUT}/app-scan-ready.png`, await page.screenshot());
  });
});

test.describe('weather', () => {
  test.use({ viewport: { width: 1000, height: 640 }, timezoneId: 'Asia/Manila' });

  // Stubbed rather than live, so the README shows the feature instead of
  // whatever the sky happened to be doing when the images were regenerated.
  const CONDITIONS = [
    {
      label: 'weather-rain',
      theme: 'nature',
      sculpture: 'island',
      current: {
        weather_code: 63,
        precipitation: 3,
        wind_speed_10m: 28,
        cloud_cover: 90,
        temperature_2m: 21,
      },
    },
    {
      label: 'weather-snow',
      theme: 'crystal',
      sculpture: 'portal',
      current: {
        weather_code: 75,
        precipitation: 4,
        wind_speed_10m: 10,
        cloud_cover: 100,
        temperature_2m: -4,
      },
    },
    {
      label: 'weather-storm',
      theme: 'cyber',
      sculpture: 'city',
      current: {
        weather_code: 95,
        precipitation: 8,
        wind_speed_10m: 55,
        cloud_cover: 100,
        temperature_2m: 19,
        is_day: 0,
      },
    },
  ];

  for (const item of CONDITIONS) {
    test(`media ${item.label}`, async ({ page }) => {
      await page.route('https://api.open-meteo.com/**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ current: { is_day: 1, ...item.current } }),
        }),
      );
      await openExperience(page, { url: LINK, sculpture: item.sculpture, theme: item.theme });
      await page.getByTestId('weather-badge').waitFor();
      await page.waitForTimeout(1600);
      writeFileSync(`${OUT}/${item.label}.jpg`, await page.screenshot(JPEG));
    });
  }
});

test.describe('widget', () => {
  test.use({ viewport: { width: 420, height: 420 } });
  test('media embed', async ({ page }) => {
    await page.goto(
      `${experienceUrl({ url: LINK, sculpture: 'island', theme: 'nature' })}&embed=1`,
    );
    await page.locator('.scene canvas').waitFor({ state: 'attached' });
    await page.waitForTimeout(900);
    writeFileSync(`${OUT}/embed-widget.jpg`, await page.screenshot(JPEG));
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 380, height: 760 } });
  test('media mobile', async ({ page }) => {
    await openExperience(page, { url: LINK, sculpture: 'gift', theme: 'sunset' });
    await page.waitForTimeout(900);
    writeFileSync(`${OUT}/mobile.jpg`, await page.screenshot(JPEG));
  });
});
