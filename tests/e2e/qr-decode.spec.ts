import { expect, test } from '@playwright/test';
import { decodeQrFromPng } from './decode';
import { openExperience, revealAndSettle, screenshotScene } from './helpers';
import type { ExperienceOptions } from './helpers';
import { THEME_IDS } from '../../src/themes/themes';
import { SCULPTURE_IDS } from '../../src/voxel/types';

const SHORT_URL = 'https://example.com/hi';
const TYPICAL_URL = 'https://voxelqr.example/campaign/spring-2026?ref=poster&utm_source=print';
const LONG_URL = `https://voxelqr.example/c/${'segment/'.repeat(18)}end`;

/** Reveal the code and assert it decodes to exactly the destination. */
async function expectDecodes(
  page: import('@playwright/test').Page,
  options: ExperienceOptions,
): Promise<void> {
  await openExperience(page, options);
  await revealAndSettle(page);
  const decoded = decodeQrFromPng(await screenshotScene(page));
  expect(decoded, `expected the rendered code to decode to ${options.url}`).toBe(options.url);
}

/**
 * The QR reliability matrix (spec §18).
 *
 * These are the build gate: a beautiful transformation that produces an
 * undecodable code is a failed build, not a cosmetic issue.
 */
test.describe('viewport and pixel-density matrix', () => {
  const viewports = [
    { name: '320px mobile', width: 320, height: 640, dpr: 1 },
    { name: '375px mobile', width: 375, height: 667, dpr: 2 },
    { name: '430px mobile', width: 430, height: 932, dpr: 3 },
    { name: '768px tablet', width: 768, height: 1024, dpr: 2 },
    { name: '1280px desktop', width: 1280, height: 800, dpr: 1 },
    { name: '1920px desktop', width: 1920, height: 1080, dpr: 2 },
  ];

  for (const viewport of viewports) {
    test.describe(viewport.name, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.dpr,
      });

      test(`decodes at ${viewport.width}px @${viewport.dpr}x`, async ({ page }) => {
        await expectDecodes(page, { url: TYPICAL_URL });
      });
    });
  }
});

// Driven from the product's own lists rather than copies of them, so adding a
// theme or a sculpture cannot ship without a decode test covering it.
test.describe('every theme produces a scannable code', () => {
  for (const theme of THEME_IDS) {
    test(`theme: ${theme}`, async ({ page }) => {
      await expectDecodes(page, { url: SHORT_URL, theme });
    });
  }
});

test.describe('every sculpture produces a scannable code', () => {
  for (const sculpture of SCULPTURE_IDS) {
    test(`sculpture: ${sculpture}`, async ({ page }) => {
      await expectDecodes(page, { url: SHORT_URL, sculpture });
    });
  }
});

test.describe('URL length', () => {
  test('short URL', async ({ page }) => {
    await expectDecodes(page, { url: SHORT_URL });
  });

  test('long URL produces a dense but decodable code', async ({ page }) => {
    await expectDecodes(page, { url: LONG_URL });
  });
});

test.describe('motion preference', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('reduced motion still reaches an exact scan-ready state', async ({ page }) => {
    await expectDecodes(page, { url: TYPICAL_URL, theme: 'cyber' });
  });
});

test.describe('stability', () => {
  test('the code does not move once scan-ready', async ({ page }) => {
    await openExperience(page, { url: SHORT_URL });
    await revealAndSettle(page);

    const first = await screenshotScene(page);
    await page.waitForTimeout(1200);
    const second = await screenshotScene(page);

    expect(decodeQrFromPng(second)).toBe(SHORT_URL);
    // Byte-identical frames prove nothing is animating inside the QR region.
    expect(Buffer.compare(first, second)).toBe(0);
  });

  test('returning and revealing again produces a decodable code', async ({ page }) => {
    await openExperience(page, { url: SHORT_URL });
    await revealAndSettle(page);
    expect(decodeQrFromPng(await screenshotScene(page))).toBe(SHORT_URL);

    await page.getByRole('button', { name: 'Return to sculpture' }).click();
    await page.getByTestId('phase').filter({ hasText: 'sculpture' }).waitFor();
    await revealAndSettle(page);

    // The plinth may settle at a different right angle after a second spin, so
    // the frames need not be identical — but the code must still decode.
    expect(decodeQrFromPng(await screenshotScene(page))).toBe(SHORT_URL);
  });
});
