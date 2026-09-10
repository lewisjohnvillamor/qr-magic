import { expect, test } from '@playwright/test';
import { decodeQrFromPng } from './decode';
import { experienceUrl, revealAndSettle, screenshotScene } from './helpers';
import { HEART_PNG } from './fixtures';

const URL_VALUE = 'https://voxelqr.example/mine';

async function upload(page: import('@playwright/test').Page) {
  await page.getByTestId('open-config').click();
  const drawer = page.getByTestId('config-drawer');
  await drawer.waitFor();
  await drawer
    .getByTestId('sculpture-file')
    .setInputFiles({ name: 'heart.png', mimeType: 'image/png', buffer: HEART_PNG });
  // Converting a picture is measured in tens of milliseconds, so the button
  // says so; waiting for it to stop is waiting for the real thing.
  await expect(page.getByTestId('upload-sculpture')).not.toHaveText('Building…');
  return drawer;
}

/**
 * A picture someone brought, standing on their code.
 *
 * The sculpture is the decoration and the code is the product, so the test that
 * matters is not "the heart appeared" — it is that an arbitrary uploaded object
 * is absorbed by the reveal exactly like a built-in one, and the code underneath
 * still decodes.
 */
test.describe('a sculpture built from an upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(experienceUrl({ url: URL_VALUE }));
    await page.getByTestId('phase').waitFor({ state: 'attached' });
  });

  test('joins the picker, and the code still decodes', async ({ page }) => {
    const before = await screenshotScene(page);

    const drawer = await upload(page);
    await drawer.getByRole('button', { name: 'Done' }).click();

    // Selected on arrival: nobody waits for a conversion and then goes hunting
    // for the picker.
    const mine = page.getByRole('radio', { name: /Yours/ });
    await expect(mine).toHaveAttribute('aria-checked', 'true');

    const after = await screenshotScene(page);
    expect(Buffer.compare(before, after)).not.toBe(0);

    await revealAndSettle(page);
    expect(decodeQrFromPng(await screenshotScene(page))).toBe(URL_VALUE);
  });

  test('removing it puts the scene back on a built-in', async ({ page }) => {
    const drawer = await upload(page);
    await expect(page.getByTestId('upload-sculpture')).toHaveText('Replace');

    await drawer.getByRole('button', { name: 'Remove' }).first().click();
    await expect(page.getByRole('radio', { name: /Yours/ })).toHaveCount(0);
    await expect(page.getByTestId('upload-sculpture')).toHaveText('Upload a picture');

    await drawer.getByRole('button', { name: 'Done' }).click();
    await revealAndSettle(page);
    expect(decodeQrFromPng(await screenshotScene(page))).toBe(URL_VALUE);
  });

  test('never travels in a share link', async ({ page }) => {
    // The picture stays on the device that chose it, so a link cannot name the
    // sculpture built from it — the recipient would open on nothing.
    const drawer = await upload(page);
    await drawer.getByRole('button', { name: 'Done' }).click();

    await expect
      .poll(() => {
        const encoded = new URL(page.url()).searchParams.get('experience');
        if (!encoded) return null;
        const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8')).sculpture;
      })
      .not.toBe('custom');
  });
});
