import type { Page } from '@playwright/test';

export interface ExperienceOptions {
  url: string;
  sculpture?: string;
  theme?: string;
  foreground?: string;
  background?: string;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Build the same share link the app produces, without going through the UI. */
export function experienceUrl(options: ExperienceOptions): string {
  const payload: Record<string, unknown> = {
    v: 1,
    url: options.url,
    sculpture: options.sculpture ?? 'crystal',
    theme: options.theme ?? 'nature',
  };
  if (options.foreground) payload.foreground = options.foreground;
  if (options.background) payload.background = options.background;
  return `/?experience=${toBase64Url(JSON.stringify(payload))}`;
}

/** Open an experience and wait for the scene (or fallback) to be ready. */
export async function openExperience(page: Page, options: ExperienceOptions): Promise<void> {
  await page.goto(experienceUrl(options));
  await page.getByTestId('phase').waitFor({ state: 'attached' });
  await page.locator('.scene canvas').waitFor({ state: 'attached' });
  // Let the first frames of the idle sculpture render.
  await page.waitForTimeout(400);
}

/** Reveal the QR and wait for the locked, motionless scan-ready state. */
export async function revealAndSettle(page: Page): Promise<void> {
  await page.getByTestId('reveal-button').click();
  await page.getByTestId('phase').filter({ hasText: 'scan-ready' }).waitFor({ timeout: 20_000 });
  // The timeline has finished; give the renderer a couple of frames to present
  // the final state before the screenshot is taken.
  await page.waitForTimeout(600);
}

/** Screenshot just the WebGL canvas. */
export async function screenshotScene(page: Page): Promise<Buffer> {
  return page.locator('.scene canvas').screenshot({ scale: 'device' });
}
