import { mkdirSync, writeFileSync } from 'node:fs';
import { test } from '@playwright/test';
import { experienceUrl, openExperience } from './helpers';

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

    await page.getByTestId('phase').filter({ hasText: 'scan-ready' }).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(700);
    // Lossless: the README shows this one as a working code.
    writeFileSync(`${OUT}/app-scan-ready.png`, await page.screenshot());
  });
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
