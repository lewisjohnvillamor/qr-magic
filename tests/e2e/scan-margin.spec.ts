import { expect, test } from '@playwright/test';
import { decodeQrFromPng } from './decode';
import { downscalePng } from './degrade';
import { experienceUrl, openExperience, revealAndSettle, screenshotScene } from './helpers';

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

  return shrinkUntilUnreadable(full, url);
}

/** Smallest fraction of `image` that still decodes to `url`. */
function shrinkUntilUnreadable(image: Buffer, url: string): number {
  let smallest = 1;
  for (const factor of [0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1]) {
    if (decodeQrFromPng(downscalePng(image, factor)) !== url) break;
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

test.describe('the 2D fallback', () => {
  /**
   * The fallback renders where WebGL could not — the weakest devices, often
   * the poorest screens — so it drops the theme mosaic for the solid
   * contrast-guaranteed pair (15:1 or better against the mosaic's 7:1 floor).
   * This asserts the result is comfortably readable, not merely decodable.
   */
  test('is high-contrast and readable well below capture resolution', async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function patched(
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
      ) {
        if (type.includes('webgl')) return null;
        return (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });

    await page.goto(experienceUrl({ url: SHORT, theme: 'nature' }));
    await page.getByTestId('fallback-qr').waitFor();
    const shot = await page.getByTestId('fallback-canvas').screenshot({ scale: 'device' });

    expect(decodeQrFromPng(shot)).toBe(SHORT);
    const margin = shrinkUntilUnreadable(shot, SHORT);
    expect(margin, `fallback decoded down to ${margin * 100}%`).toBeLessThanOrEqual(0.35);
  });
});
