import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { decodeQrFromPng } from './decode';
import { experienceUrl, revealAndSettle, screenshotScene } from './helpers';

const URL_A = 'https://example.com/weather';

/** Serve a fixed forecast, so the scene is deterministic under test. */
async function stubWeather(page: Page, current: Record<string, unknown>) {
  await page.route('https://api.open-meteo.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        current: { temperature_2m: 12, weather_code: 0, is_day: 1, ...current },
      }),
    }),
  );
}

test.describe('live weather', () => {
  // The scene locates the viewer by time zone. A headless browser reports
  // "UTC", which names an offset rather than a place and correctly yields no
  // weather at all — so these tests have to be somewhere real.
  test.use({ timezoneId: 'Asia/Manila' });

  test('reports the conditions it applied', async ({ page }) => {
    await stubWeather(page, { weather_code: 61, temperature_2m: 17.4, precipitation: 1.2 });
    await page.goto(experienceUrl({ url: URL_A, theme: 'nature' }));

    const badge = page.getByTestId('weather-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Rain');
    // Rounded, so a reading of 17.4 does not put a decimal in the interface.
    await expect(badge).toContainText('17°C');

    // The disclosure rides on the readout, where it is actually read.
    const title = await badge.getAttribute('title');
    expect(title).toContain('Open-Meteo');
    expect(title).toContain('never requested or sent');
  });

  test('stays silent where the time zone names an offset, not a place', async ({ browser }) => {
    // A server, a CI runner or a hardened browser reports UTC. Guessing a
    // position from that would show someone the weather in the ocean.
    const context = await browser.newContext({ timezoneId: 'UTC' });
    const page = await context.newPage();
    let asked = false;
    await page.route('https://api.open-meteo.com/**', (route) => {
      asked = true;
      return route.abort();
    });
    await page.goto(experienceUrl({ url: URL_A }));
    await page.locator('.scene canvas').waitFor({ state: 'attached' });
    await page.waitForTimeout(500);
    await expect(page.getByTestId('weather-badge')).toHaveCount(0);
    expect(asked, 'no lookup should be made without a location').toBe(false);
    await context.close();
  });

  test('says nothing at all when there is nothing to report', async ({ page }) => {
    await page.route('https://api.open-meteo.com/**', (route) => route.abort());
    await page.goto(experienceUrl({ url: URL_A }));
    await page.locator('.scene canvas').waitFor({ state: 'attached' });
    await page.waitForTimeout(400);
    await expect(page.getByTestId('weather-badge')).toHaveCount(0);
  });

  test('a garbled forecast is ignored rather than rendered', async ({ page }) => {
    await page.route('https://api.open-meteo.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"current":{}}' }),
    );
    await page.goto(experienceUrl({ url: URL_A }));
    await page.locator('.scene canvas').waitFor({ state: 'attached' });
    await page.waitForTimeout(400);
    await expect(page.getByTestId('weather-badge')).toHaveCount(0);
  });

  // The whole point of the guard rails: atmosphere is subordinate to the code.
  for (const [name, current] of [
    ['a storm', { weather_code: 95, precipitation: 8, wind_speed_10m: 55, cloud_cover: 100 }],
    ['heavy snow', { weather_code: 75, precipitation: 6, cloud_cover: 100 }],
    ['thick fog at night', { weather_code: 45, cloud_cover: 100, is_day: 0 }],
  ] as const) {
    test(`the code still decodes in ${name}`, async ({ page }) => {
      await stubWeather(page, current);
      await page.goto(experienceUrl({ url: URL_A, theme: 'cyber' }));
      await page.locator('.scene canvas').waitFor({ state: 'attached' });
      await expect(page.getByTestId('weather-badge')).toBeVisible();

      await revealAndSettle(page);
      expect(decodeQrFromPng(await screenshotScene(page))).toBe(URL_A);
    });
  }

  test('weather reaches the embed widget too', async ({ page }) => {
    await stubWeather(page, { weather_code: 71, temperature_2m: -3 });
    await page.goto(`${experienceUrl({ url: URL_A, theme: 'snow' })}&embed=1`);
    await expect(page.getByTestId('weather-badge')).toContainText('Snow');
  });
});
