import type { Page } from '@playwright/test';

export interface ExperienceOptions {
  url: string;
  sculpture?: string;
  theme?: string;
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

/**
 * Wait until the scene stops changing.
 *
 * The phase flips to scan-ready when the timeline completes, but the renderer
 * may still be presenting the last frames — and under a software rasteriser
 * with several workers competing, "a couple of frames" is not a fixed number
 * of milliseconds. Comparing successive captures waits for the thing actually
 * required (a motionless code) rather than guessing at a delay.
 */
export async function waitForStableScene(page: Page, timeoutMs = 15_000): Promise<Buffer> {
  const deadline = Date.now() + timeoutMs;
  let previous = await screenshotScene(page);
  while (Date.now() < deadline) {
    await page.waitForTimeout(150);
    const current = await screenshotScene(page);
    if (Buffer.compare(previous, current) === 0) return current;
    previous = current;
  }
  return previous;
}

/**
 * How long to wait for the reveal timeline to reach scan-ready.
 *
 * The timeline has a fixed duration, but its wall-clock length depends on how
 * fast frames arrive — and under a software rasteriser the heaviest case in
 * the matrix (1920px at DPR 2, so 3840x2160) takes most of 20 seconds on its
 * own, let alone sharing a runner with other workers. A tight budget here does
 * not catch a broken reveal, it just fails the biggest viewport on a busy
 * machine. A stalled timeline still fails, only later.
 */
export const SCAN_READY_TIMEOUT = 45_000;

/**
 * Reveal the QR and wait for the locked, motionless scan-ready state.
 *
 */
export async function revealAndSettle(page: Page): Promise<void> {
  await page.getByTestId('reveal-button').click();
  await page
    .getByTestId('phase')
    .filter({ hasText: 'scan-ready' })
    .waitFor({ timeout: SCAN_READY_TIMEOUT });
  await waitForStableScene(page);
}

/** Screenshot just the WebGL canvas. */
export async function screenshotScene(page: Page): Promise<Buffer> {
  return page.locator('.scene canvas').screenshot({ scale: 'device' });
}
