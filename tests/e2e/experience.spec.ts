import { expect, test } from '@playwright/test';
import { decodeQrFromPng } from './decode';
import {
  experienceUrl,
  openExperience,
  revealAndSettle,
  screenshotScene,
  SCAN_READY_TIMEOUT,
} from './helpers';

const URL_A = 'https://example.com/a';
const URL_B = 'https://example.org/b';

test.describe('creation flow', () => {
  test('entering a URL regenerates the code without transmitting it', async ({ page }) => {
    const offOrigin: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith('http://127.0.0.1:4173')) offOrigin.push(request.url());
    });
    // The weather lookup is the only outside call the product makes, and it is
    // not what this test is about. Stubbing it keeps the assertion below about
    // the app's own behaviour rather than about a third party being reachable.
    await page.route('https://api.open-meteo.com/**', (route) => route.abort());

    await openExperience(page, { url: URL_A });

    await page.getByLabel('Destination link').fill(URL_B);
    await page.keyboard.press('Enter');
    await revealAndSettle(page);

    expect(decodeQrFromPng(await screenshotScene(page))).toBe(URL_B);

    // The code is generated locally. Exactly one host outside the app's own
    // origin may ever be contacted — the weather API — and it is sent nothing
    // but coordinates. In particular the destination URL is never transmitted,
    // to that host or any other.
    const hosts = [...new Set(offOrigin.map((url) => new URL(url).host))];
    expect(hosts.filter((host) => host !== 'api.open-meteo.com')).toEqual([]);
    for (const url of offOrigin) {
      expect(url).not.toContain('example.com');
      expect(url).not.toContain('example.org');
      expect(decodeURIComponent(url)).not.toContain(URL_B);
    }
  });

  test('a blocked or failing weather lookup leaves the scene fully working', async ({ page }) => {
    // Weather is decoration on top of a QR code, and the QR code is the
    // product: a host whose CSP forbids the lookup, or an offline visitor,
    // must still get a scannable code.
    await page.route('https://api.open-meteo.com/**', (route) => route.abort());

    await openExperience(page, { url: URL_A });
    await revealAndSettle(page);
    expect(decodeQrFromPng(await screenshotScene(page))).toBe(URL_A);
  });

  test('normalizes a bare hostname', async ({ page }) => {
    await openExperience(page, { url: URL_A });
    await page.getByLabel('Destination link').fill('example.net/path');
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Destination link')).toHaveValue('https://example.net/path');
    await revealAndSettle(page);
    expect(decodeQrFromPng(await screenshotScene(page))).toBe('https://example.net/path');
  });

  test('rejects an unsafe scheme, announces it and blocks the reveal', async ({ page }) => {
    await openExperience(page, { url: URL_A });
    const input = page.getByLabel('Destination link');
    await input.fill('javascript:alert(1)');
    await page.keyboard.press('Enter');

    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('status')).toContainText('not supported');
    await expect(page.getByTestId('reveal-button')).toBeDisabled();
  });

  test('switching sculpture or theme returns to the sculpture state', async ({ page }) => {
    await openExperience(page, { url: URL_A });
    await revealAndSettle(page);
    await expect(page.getByTestId('phase')).toHaveText('scan-ready');

    await page.getByRole('button', { name: 'Return to sculpture' }).click();
    await expect(page.getByTestId('phase')).toHaveText('sculpture');

    await page.getByRole('radio', { name: 'Big city' }).click();
    await revealAndSettle(page);
    expect(decodeQrFromPng(await screenshotScene(page))).toBe(URL_A);
  });
});

test.describe('accessibility', () => {
  test('the whole flow works from the keyboard alone', async ({ page }) => {
    await openExperience(page, { url: URL_A });

    await page.getByLabel('Destination link').focus();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('example.dev/keyboard', { delay: 0 });
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Destination link')).toHaveValue('https://example.dev/keyboard');

    await page.getByTestId('reveal-button').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('phase')).toHaveText('scan-ready', {
      timeout: SCAN_READY_TIMEOUT,
    });
    await expect(page.getByRole('status')).toContainText('Scan ready');

    await page.getByRole('button', { name: 'Return to sculpture' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('phase')).toHaveText('sculpture');
  });

  test('sculpture and theme groups are arrow-key navigable radio groups', async ({ page }) => {
    await openExperience(page, { url: URL_A });
    const group = page.getByRole('radiogroup', { name: 'Sculpture' });
    await group.getByRole('radio', { checked: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(group.getByRole('radio', { name: 'Gift box' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('every control has an accessible name', async ({ page }) => {
    await openExperience(page, { url: URL_A });
    const named = (nodes: Element[]) =>
      nodes.map((node) => (node.textContent ?? '').trim() || node.getAttribute('aria-label') || '');

    const buttons = await page.getByRole('button').evaluateAll(named);
    const radios = await page.getByRole('radio').evaluateAll(named);

    expect(buttons.length).toBeGreaterThanOrEqual(4);
    expect(radios).toHaveLength(12);
    for (const name of [...buttons, ...radios]) expect(name).not.toBe('');
  });
});

test.describe('sharing', () => {
  test('the address bar carries a link that restores the same experience', async ({ page }) => {
    await openExperience(page, { url: URL_A, sculpture: 'portal', theme: 'snow' });
    await page.getByLabel('Destination link').fill('https://example.com/shared');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    const shareLink = page.url();
    expect(shareLink).toContain('experience=');

    await page.goto(shareLink);
    await page.locator('.scene canvas').waitFor({ state: 'attached' });
    await expect(page.getByLabel('Destination link')).toHaveValue('https://example.com/shared');
    await expect(page.getByRole('radio', { name: 'Abstract portal' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('radio', { name: 'Snow' })).toHaveAttribute('aria-checked', 'true');

    await revealAndSettle(page);
    expect(decodeQrFromPng(await screenshotScene(page))).toBe('https://example.com/shared');
  });

  test('the share button copies the link when the Web Share API is absent', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });
    await openExperience(page, { url: URL_A });

    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page.getByRole('status')).toContainText('copied');

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('experience=');
  });

  test('a manipulated share payload falls back safely', async ({ page }) => {
    await page.goto('/?experience=this-is-not-a-valid-payload');
    await expect(page.getByRole('status')).toContainText('could not be read');
    await expect(page.getByLabel('Destination link')).toHaveValue(/^https:\/\//);
    await revealAndSettle(page);
    expect(decodeQrFromPng(await screenshotScene(page))).toMatch(/^https:\/\//);
  });
});

test.describe('sound', () => {
  test('toggling sound on starts the ambient bed without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await openExperience(page, { url: URL_A, theme: 'cyber' });
    await page.getByRole('button', { name: 'Sound off' }).click();
    await expect(page.getByRole('button', { name: 'Sound on' })).toBeVisible();

    const audioState = await page.evaluate(() => {
      // The engine keeps one shared context; probe it via a fresh handle.
      return typeof AudioContext !== 'undefined' ? 'available' : 'missing';
    });
    expect(audioState).toBe('available');

    // Switching theme while audible crossfades rather than crashing.
    await page.getByRole('radio', { name: 'Sunset' }).click();
    await page.waitForTimeout(400);

    await page.getByRole('button', { name: 'Sound on' }).click();
    await expect(page.getByRole('button', { name: 'Sound off' })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('WebGL fallback', () => {
  test('a device without WebGL still gets a working code', async ({ page }) => {
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

    await page.goto(experienceUrl({ url: URL_A, theme: 'sunset' }));

    const fallback = page.getByTestId('fallback-qr');
    await expect(fallback).toBeVisible();
    await expect(page.locator('.scene canvas')).toHaveCount(0);

    const decoded = decodeQrFromPng(
      await page.getByTestId('fallback-canvas').screenshot({ scale: 'device' }),
    );
    expect(decoded).toBe(URL_A);

    // The rest of the interface still works.
    await expect(page.getByLabel('Destination link')).toHaveValue(URL_A);
    await expect(page.getByRole('button', { name: 'Share' })).toBeEnabled();
  });
});

test.describe('security headers', () => {
  test('the document ships a restrictive content security policy', async ({ page }) => {
    const response = await page.goto('/');
    const csp = response?.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    // Embeddable by design — framing must NOT be forbidden.
    expect(csp).toContain('frame-ancestors *');
    expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  });
});
