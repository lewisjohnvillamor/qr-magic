import { expect, test } from '@playwright/test';
import { decodeQrFromPng } from './decode';
import { experienceUrl, waitForStableScene } from './helpers';

const DESTINATION = 'https://example.com/shared-with-you';

/** The link an author hands out: the same payload, flagged read-only. */
function viewerUrl(options: Parameters<typeof experienceUrl>[0]): string {
  return `${experienceUrl(options)}&view=1`;
}

test.describe('viewer mode', () => {
  test('a recipient gets the experience without the authoring controls', async ({ page }) => {
    await page.goto(viewerUrl({ url: DESTINATION, sculpture: 'island', theme: 'nature' }));
    await page.getByTestId('viewer-panel').waitFor();
    await page.locator('.scene canvas').waitFor({ state: 'attached' });

    // Nothing here can change what was shared.
    await expect(page.locator('#destination-url')).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Theme' })).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Sculpture' })).toHaveCount(0);

    // What is left: where it goes, and the three things worth doing with it.
    await expect(page.locator('.viewer-destination')).toHaveText(DESTINATION);
    await expect(page.getByRole('button', { name: 'Share' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Embed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save image' })).toBeVisible();
  });

  test('the reveal still works and the code decodes', async ({ page }) => {
    await page.goto(viewerUrl({ url: DESTINATION, sculpture: 'crystal', theme: 'cyber' }));
    await page.locator('.scene canvas').waitFor({ state: 'attached' });

    await page.getByTestId('reveal-button').click();
    await page.getByTestId('phase').filter({ hasText: 'scan-ready' }).waitFor({ timeout: 20_000 });
    expect(decodeQrFromPng(await waitForStableScene(page))).toBe(DESTINATION);

    await page.getByRole('button', { name: 'Return to sculpture' }).click();
    await page.getByTestId('phase').filter({ hasText: 'sculpture' }).waitFor();
  });

  test('the read-only flag survives a reload rather than unlocking the editor', async ({
    page,
  }) => {
    await page.goto(viewerUrl({ url: DESTINATION }));
    await page.getByTestId('viewer-panel').waitFor();
    // The address bar sync is what could strip the flag; it must not run here.
    await page.waitForTimeout(400);
    expect(page.url()).toContain('view=1');

    await page.reload();
    await expect(page.getByTestId('viewer-panel')).toBeVisible();
  });

  test('an author sharing from the editor hands out a read-only link', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(experienceUrl({ url: DESTINATION }));
    await page.locator('.scene canvas').waitFor({ state: 'attached' });

    await page.getByRole('button', { name: 'Share' }).click();
    const shared = await page.evaluate(() => navigator.clipboard.readText());
    expect(shared).toContain('view=1');

    // The author's own address keeps the editor.
    expect(page.url()).not.toContain('view=1');
    await expect(page.locator('#destination-url')).toBeVisible();
  });
});
