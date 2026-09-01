import { expect, test } from '@playwright/test';
import { decodeQrFromPng } from './decode';
import { downscalePng } from './degrade';
import { openExperience, revealAndSettle, screenshotScene } from './helpers';

const SHORT = 'https://voxelqr.example/hello';
const LONG = `https://voxelqr.example/c/${'segment/'.repeat(18)}end`;

/**
 * Smallest fraction of the captured frame that still decodes.
 *
 * Shrinking the capture stands in for scanning from further away or with a
 * poorer sensor, so this is a number for how much room the code has before it
 * stops working — not merely whether it works at full size.
 */
async function scanMargin(page: import('@playwright/test').Page, url: string): Promise<number> {
  await openExperience(page, { url });
  await revealAndSettle(page);
  const full = await screenshotScene(page);
  expect(decodeQrFromPng(full), 'the full-size capture must decode').toBe(url);

  let smallest = 1;
  for (const factor of [0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1]) {
    if (decodeQrFromPng(downscalePng(full, factor)) !== url) break;
    smallest = factor;
  }
  return smallest;
}

test.describe('scanning headroom', () => {
  test('a short link decodes far below capture resolution', async ({ page }) => {
    const margin = await scanMargin(page, SHORT);
    expect(margin, `short link decoded down to ${margin * 100}%`).toBeLessThanOrEqual(0.15);
  });

  /**
   * The regression this guards.
   *
   * At a fixed error-correction level of H a 173-character URL needs 69
   * modules and had *no* headroom at all — it decoded only at full capture
   * size. Choosing the strongest level that still fits the module budget
   * brings it to 53 modules and restores a real margin. If someone pins the
   * level back to H, this fails.
   */
  test('a long link keeps real headroom, not just a full-size pass', async ({ page }) => {
    const margin = await scanMargin(page, LONG);
    expect(margin, `long link decoded down to ${margin * 100}%`).toBeLessThanOrEqual(0.3);
  });
});
