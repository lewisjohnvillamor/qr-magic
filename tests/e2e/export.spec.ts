import { expect, test } from '@playwright/test';
import { decodeQrFromPng } from './decode';
import { openExperience, revealAndSettle } from './helpers';

const URL_A = 'https://example.com/newsletter';

test.describe('PNG export', () => {
  test('the scan-ready export is itself a scannable image', async ({ page }) => {
    await openExperience(page, { url: URL_A, sculpture: 'island', theme: 'nature' });
    await revealAndSettle(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save image' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('voxelqr-code.png');
    const path = await download.path();
    const { readFileSync } = await import('node:fs');
    // The exported picture must decode on its own — that is what makes it
    // usable inside an email, where no script can run.
    expect(decodeQrFromPng(readFileSync(path))).toBe(URL_A);
    await expect(page.getByRole('status')).toContainText('scannable');
  });

  test('the sculpture export names itself after the configuration', async ({ page }) => {
    await openExperience(page, { url: URL_A, sculpture: 'city', theme: 'cyber' });
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save image' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('voxelqr-city-cyber.png');
  });
});
