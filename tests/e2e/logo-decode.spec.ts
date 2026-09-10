import { expect, test } from '@playwright/test';
import { decodeQrFromPng } from './decode';
import { experienceUrl, revealAndSettle, screenshotScene } from './helpers';
import { LOGO_PNG } from './fixtures';

const URL_VALUE = 'https://voxelqr.example/logo';

/**
 * A logo covers modules, which is only safe because error correction pays for
 * it. That trade is either true or it is not, and the only way to know is to
 * decode a capture of the real thing with the real picture in the middle of it.
 *
 * The logo is added through the drawer rather than a link, because it never
 * travels in one: it stays on the device that chose it.
 */
test('a code with a centre logo still decodes', async ({ page }) => {
  await page.goto(experienceUrl({ url: URL_VALUE }));
  await page.getByTestId('phase').waitFor({ state: 'attached' });

  await page.getByTestId('open-config').click();
  const drawer = page.getByTestId('config-drawer');
  await drawer.waitFor();
  await drawer.getByTestId('logo-file').setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: LOGO_PNG,
  });

  // The logo forces the strongest error correction, which rebuilds the matrix
  // and resets the reveal — so the drawer closes only once that has settled.
  await expect(drawer.locator('img.logo-preview')).toBeVisible();
  await drawer.getByRole('button', { name: 'Done' }).click();
  await page.locator('.scene canvas').waitFor({ state: 'attached' });
  await page.waitForTimeout(400);

  await revealAndSettle(page);
  expect(decodeQrFromPng(await screenshotScene(page))).toBe(URL_VALUE);
});
