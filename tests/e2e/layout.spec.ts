import { expect, test } from '@playwright/test';
import { experienceUrl, revealAndSettle } from './helpers';

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

      // The support link is the only actionable part of the masthead, so it
      // must survive the narrow layout rather than being elided away.
      const support = page.getByRole('link', { name: /Buy me a coffee/ });
      await expect(support).toBeVisible();
      await expect(support).toHaveAttribute('href', 'https://buymeacoffee.com/lewisjohnvil');
      // Opens away from the app, and cannot reach back into it.
      await expect(support).toHaveAttribute('rel', /noopener/);
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

/**
 * The scan-ready bar has to fit, and getting out of it has to be possible.
 *
 * It used to carry a 185px "Return to sculpture" button, which pushed the row
 * 41px past the right edge of a 390px phone — so the one control that left
 * scan mode was partly off-screen and untappable. The button is gone: the code
 * itself is the way back, the same surface that revealed it.
 */
test.describe('scan-ready on a phone', () => {
  for (const viewport of [
    { width: 320, height: 640 },
    { width: 390, height: 700 },
    { width: 440, height: 956 },
  ]) {
    test(`the bar fits and the code goes back at ${viewport.width}px`, async ({ page }) => {
      await page.route('https://api.open-meteo.com/**', (route) => route.abort());
      await page.setViewportSize(viewport);
      await page.goto(experienceUrl({ url: LINK, theme: 'cyber', sculpture: 'gift' }));
      await page.locator('.scene canvas').waitFor({ state: 'attached' });
      await revealAndSettle(page);

      const fit = await page.evaluate(() => {
        const panel = document.querySelector('.panel') as HTMLElement;
        const card = document.querySelector('.panel-card') as HTMLElement;
        const children = Array.prototype.slice.call(card.children) as HTMLElement[];
        return {
          panelOverflows: panel.scrollWidth > panel.clientWidth,
          cardOverflows: card.scrollWidth > card.clientWidth,
          rightmost: Math.max(...children.map((child) => child.getBoundingClientRect().right)),
        };
      });
      expect(fit.panelOverflows, 'panel must not scroll sideways').toBe(false);
      expect(fit.cardOverflows, 'card must not clip its own contents').toBe(false);
      expect(fit.rightmost, 'nothing may sit past the edge of the screen').toBeLessThanOrEqual(
        viewport.width,
      );

      // No long button any more — pressing the code is the way back.
      await expect(page.locator('.panel').getByRole('button', { name: /Return/ })).toHaveCount(0);
      await page.getByTestId('reveal-button').click();
      await page.getByTestId('phase').filter({ hasText: 'sculpture' }).waitFor();
    });
  }
});
