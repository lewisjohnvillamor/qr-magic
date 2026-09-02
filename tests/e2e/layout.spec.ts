import { expect, test } from '@playwright/test';
import { experienceUrl } from './helpers';

const LINK = 'https://voxelqr.example/hello';

/**
 * Everything must be reachable on a phone.
 *
 * The theme and sculpture rows once sat below the fold with no way to scroll to
 * them, because the app sized itself against the *large* viewport — the one
 * measured with the browser toolbars hidden — and clipped whatever landed under
 * the address bar. These assert the controls are actually on screen at the
 * sizes phones really report, toolbars and all.
 */
test.describe('mobile reach', () => {
  for (const viewport of [
    { width: 440, height: 956 },
    { width: 390, height: 700 },
    { width: 360, height: 620 },
  ]) {
    test(`every control is reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.route('https://api.open-meteo.com/**', (route) => route.abort());
      await page.setViewportSize(viewport);
      await page.goto(experienceUrl({ url: LINK, theme: 'nature', sculpture: 'island' }));
      await page.locator('.scene canvas').waitFor({ state: 'attached' });

      for (const name of ['Theme', 'Sculpture']) {
        const group = page.getByRole('radiogroup', { name });
        await expect(group, name).toBeVisible();
        const box = await group.boundingBox();
        expect(box, `${name} has a box`).not.toBeNull();
        // Fully inside the viewport, not merely present in the document.
        expect(box!.y + box!.height, `${name} bottom within viewport`).toBeLessThanOrEqual(
          viewport.height + 1,
        );
        expect(box!.y, `${name} top within viewport`).toBeGreaterThanOrEqual(0);
      }

      // The contact address is the only actionable part of the masthead, so it
      // must survive the narrow layout rather than being elided away.
      await expect(page.getByRole('link', { name: /lewisvillamor26@gmail\.com/ })).toBeVisible();
    });
  }
});

test.describe('the brand monogram', () => {
  test('renders as its own sculpture and is offered in the picker', async ({ page }) => {
    await page.route('https://api.open-meteo.com/**', (route) => route.abort());
    await page.goto(experienceUrl({ url: LINK, sculpture: 'brand', theme: 'sunset' }));
    await page.locator('.scene canvas').waitFor({ state: 'attached' });

    const sculptures = page.getByRole('radiogroup', { name: 'Sculpture' });
    await expect(sculptures.getByRole('radio', { name: 'Brand' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // Brand is a sculpture now, not a theme.
    await expect(
      page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Brand' }),
    ).toHaveCount(0);
  });
});
