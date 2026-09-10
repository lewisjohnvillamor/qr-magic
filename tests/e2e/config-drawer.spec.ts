import { expect, test } from '@playwright/test';
import { decodeQrFromPng } from './decode';
import { revealAndSettle, screenshotScene } from './helpers';
import { SHARE_PARAM } from '../../src/sharing/share-codec';

/** Read the payload the app keeps in the address bar. */
function decodePayloadFromUrl(href: string): Record<string, unknown> | null {
  const encoded = new URL(href).searchParams.get(SHARE_PARAM);
  if (!encoded) return null;
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
}

/**
 * The drawer, driven the way a person drives it.
 *
 * The decode matrix proves each setting produces a scannable code; this proves
 * the settings can actually be reached and that choosing one changes the code
 * the app is holding, rather than only the link it would write.
 */
test.describe('code settings drawer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('phase').waitFor({ state: 'attached' });
  });

  test('opens from the top right and closes on Escape', async ({ page }) => {
    const drawer = page.getByTestId('config-drawer');
    await expect(drawer).toHaveCount(0);

    await page.getByTestId('open-config').click();
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('radiogroup', { name: 'Type' })).toBeVisible();
    await expect(drawer.getByRole('radiogroup', { name: 'Modules' })).toBeVisible();
    await expect(drawer.getByRole('radiogroup', { name: 'Corners' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
  });

  test('builds a Wi-Fi code from the drawer alone', async ({ page }) => {
    await page.getByTestId('open-config').click();
    const drawer = page.getByTestId('config-drawer');
    await drawer.getByRole('radio', { name: 'Wi-Fi' }).click();

    await drawer.getByLabel('Network name').fill('Cafe Guest');
    await drawer.getByLabel('Security').selectOption('WPA');
    await drawer.getByLabel('Password', { exact: false }).fill('flat white');
    await drawer.getByRole('button', { name: 'Done' }).click();

    // The headline field follows the kind: the card now asks for the network,
    // not a link.
    await expect(page.getByTestId('payload-input')).toHaveValue('Cafe Guest');

    await revealAndSettle(page);
    expect(decodeQrFromPng(await screenshotScene(page))).toBe(
      'WIFI:T:WPA;S:Cafe Guest;P:flat white;;',
    );
  });

  test('shows every option without a sideways scroll', async ({ page }) => {
    // The rows used to be horizontal scrollers with the scrollbar hidden, which
    // is an affordance only a finger has: a mouse cannot pan a row and a wheel
    // scrolls the page instead, so on a pointer device every option past the
    // faded edge was simply unreachable — and the fade read as broken padding
    // rather than as "there is more this way". They wrap now.
    await page.getByTestId('open-config').click();
    await page.getByTestId('config-drawer').waitFor();

    const rows = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.drawer .chips')).map((row) => {
        const box = row.getBoundingClientRect();
        const chips = Array.from(row.children).map((chip) => chip.getBoundingClientRect());
        return {
          label: row.getAttribute('aria-label'),
          clipped: row.scrollWidth - row.clientWidth,
          widest: Math.max(...chips.map((chip) => chip.right)) - box.right,
        };
      }),
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.clipped, `${row.label} has options scrolled out of reach`).toBeLessThanOrEqual(0);
      expect(row.widest, `${row.label} overflows its own gutter`).toBeLessThanOrEqual(1);
    }
  });

  test('keeps the caret in the field while you type', async ({ page }) => {
    // The drawer re-renders on every keystroke it collects. An effect that
    // moved focus into the panel on each of those renders would pull the caret
    // out of the field after the first character — the field would look like it
    // was dropping input, which is exactly what a person would report.
    await page.getByTestId('open-config').click();
    const drawer = page.getByTestId('config-drawer');
    await drawer.getByRole('radio', { name: 'Wi-Fi' }).click();

    const ssid = drawer.getByLabel('Network name');
    await ssid.click();
    await page.keyboard.type('Cafe Guest');
    await expect(ssid).toBeFocused();
    await expect(ssid).toHaveValue('Cafe Guest');
  });

  test('a shape choice is written through to the experience itself', async ({ page }) => {
    // The decode matrix already proves each shape renders a scannable code.
    // What this proves is that the drawer reaches the state the whole app is
    // built from: the address bar is kept in sync with the live experience, so
    // a payload that names the chosen shape is the evidence it landed.
    await page.getByTestId('open-config').click();
    const drawer = page.getByTestId('config-drawer');
    await drawer
      .getByRole('radiogroup', { name: 'Modules' })
      .getByRole('radio', { name: /^Round / })
      .click();
    await drawer
      .getByRole('radiogroup', { name: 'Corners' })
      .getByRole('radio', { name: /^Circle / })
      .click();
    await drawer.getByRole('button', { name: 'Done' }).click();

    await expect
      .poll(() => decodePayloadFromUrl(page.url()))
      .toMatchObject({ module: 'round', corner: 'dot' });

    await revealAndSettle(page);
    expect(decodeQrFromPng(await screenshotScene(page))).toBeTruthy();
  });

  test('dotted modules raise the error correction, and the code still decodes', async ({
    page,
  }) => {
    await page.getByTestId('open-config').click();
    const drawer = page.getByTestId('config-drawer');
    await drawer
      .getByRole('radiogroup', { name: 'Modules' })
      .getByRole('radio', { name: /^Dots / })
      .click();
    // Dots erode every module, so the app says out loud that it has paid for
    // them with redundancy rather than doing it silently.
    await expect(page.getByRole('status')).toContainText(/error correction/i);
    await drawer.getByRole('button', { name: 'Done' }).click();

    await revealAndSettle(page);
    expect(decodeQrFromPng(await screenshotScene(page))).toBeTruthy();
  });
});
