import { expect, test } from '@playwright/test';
import { decodeQrFromPng } from './decode';
import { experienceUrl, screenshotScene } from './helpers';

const URL_A = 'https://example.com/widget';

function embedUrl(options: Parameters<typeof experienceUrl>[0]): string {
  return `${experienceUrl(options)}&embed=1`;
}

test.describe('embed mode', () => {
  // A typical blog-embed footprint.
  test.use({ viewport: { width: 420, height: 420 } });

  test('renders chrome-less with attribution and a working reveal', async ({ page }) => {
    await page.goto(embedUrl({ url: URL_A, sculpture: 'island', theme: 'nature' }));
    await page.locator('.scene canvas').waitFor({ state: 'attached' });
    await page.waitForTimeout(500);

    // No control panel, no masthead — the scene is the widget.
    await expect(page.locator('.panel')).toHaveCount(0);
    await expect(page.locator('.masthead')).toHaveCount(0);

    // Attribution links back to the full experience.
    const attribution = page.locator('.embed-attribution');
    await expect(attribution).toBeVisible();
    const href = await attribution.getAttribute('href');
    expect(href).toContain('experience=');
    expect(await attribution.getAttribute('rel')).toContain('noopener');

    // The reveal works and the code decodes at widget size.
    await page.getByTestId('reveal-button').click();
    await page.getByTestId('phase').filter({ hasText: 'scan-ready' }).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(600);
    expect(decodeQrFromPng(await screenshotScene(page))).toBe(URL_A);

    // And reverses.
    await page.getByRole('button', { name: 'Back to sculpture' }).click();
    await page.getByTestId('phase').filter({ hasText: 'sculpture' }).waitFor();
  });

  test('the app can actually be framed by another origin', async ({ page }) => {
    const response = await page.goto('/');
    const csp = response?.headers()['content-security-policy'] ?? '';
    expect(csp).toContain('frame-ancestors *');
    expect(csp).not.toContain("frame-ancestors 'none'");
  });
});

test.describe('embed snippet', () => {
  test('the Embed button copies a ready-to-paste iframe', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(experienceUrl({ url: URL_A, sculpture: 'city', theme: 'cyber' }));
    await page.locator('.scene canvas').waitFor({ state: 'attached' });

    await page.getByRole('button', { name: 'Embed' }).click();
    await expect(page.getByRole('status')).toContainText('Embed code copied');

    const snippet = await page.evaluate(() => navigator.clipboard.readText());
    expect(snippet).toMatch(/^<iframe /);
    expect(snippet).toContain('embed=1');
    expect(snippet).toContain('experience=');
    expect(snippet).toContain('loading="lazy"');
    expect(snippet).toContain('title=');
  });
});
