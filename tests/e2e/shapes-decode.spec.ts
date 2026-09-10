import { expect, test } from '@playwright/test';
import { decodeQrFromPng } from './decode';
import { openExperience, revealAndSettle, screenshotScene } from './helpers';
import type { ExperienceOptions } from './helpers';
import { SHAPE_IDS } from '../../src/qr/shapes';
import { encodePayload } from '../../src/qr/payloads';
import type { PayloadDraft, PayloadKind } from '../../src/qr/payloads';

const URL_VALUE = 'https://voxelqr.example/shapes?ref=matrix';

async function expectDecodes(
  page: import('@playwright/test').Page,
  options: ExperienceOptions,
): Promise<void> {
  await openExperience(page, options);
  await revealAndSettle(page);
  const decoded = decodeQrFromPng(await screenshotScene(page));
  expect(decoded, `expected the rendered code to decode to ${options.url}`).toBe(options.url);
}

/**
 * Shapes are a scanning risk, so they are a build gate.
 *
 * Rounding a module throws away dark area and detaching one throws away more.
 * The only honest test of "still scannable" is decoding a real capture of the
 * real renderer, so each shape gets one — driven from the product's own list,
 * which means a new shape cannot ship without a decode test covering it.
 */
test.describe('every module shape produces a scannable code', () => {
  for (const module of SHAPE_IDS) {
    test(`modules: ${module}`, async ({ page }) => {
      await expectDecodes(page, { url: URL_VALUE, module });
    });
  }
});

test.describe('every corner shape produces a scannable code', () => {
  for (const corner of SHAPE_IDS) {
    test(`corners: ${corner}`, async ({ page }) => {
      await expectDecodes(page, { url: URL_VALUE, corner });
    });
  }
});

test('the softest combination available still decodes', async ({ page }) => {
  // Detached dots inside circular finder rings: the least dark area and the
  // least conventional detection pattern this app can produce at once.
  await expectDecodes(page, { url: URL_VALUE, module: 'dot', corner: 'dot' });
});

/**
 * Every payload kind, end to end.
 *
 * The value is produced by the app's own encoder rather than written out here,
 * so the test proves the whole path — encode, matrix, voxels, reveal, capture,
 * decode — returns the exact bytes a phone would act on. A vCard's CRLF line
 * endings and a Wi-Fi payload's escapes are the sort of thing that survives
 * every unit test and dies in a real code.
 */
const KINDS: Array<{ kind: PayloadKind; fields: PayloadDraft }> = [
  { kind: 'url', fields: { url: URL_VALUE } },
  { kind: 'text', fields: { text: 'Meet me at the pier at six.' } },
  {
    kind: 'wifi',
    fields: {
      wifiSsid: 'Cafe Guest',
      wifiSecurity: 'WPA',
      wifiPassword: 'p;a:s"s',
      wifiHidden: '1',
    },
  },
  {
    kind: 'contact',
    fields: {
      contactName: 'Ada Lovelace',
      contactOrg: 'Analytical, Engines',
      contactPhone: '+44 20 7946 0000',
      contactEmail: 'ada@example.com',
    },
  },
  {
    kind: 'email',
    fields: { emailTo: 'hello@example.com', emailSubject: 'Hello & goodbye' },
  },
  { kind: 'sms', fields: { smsTo: '+44 7700 900000', smsBody: 'on my way' } },
  { kind: 'phone', fields: { phone: '+44 20 7946 0000' } },
];

test.describe('every payload kind produces a scannable code', () => {
  for (const { kind, fields } of KINDS) {
    test(`payload: ${kind}`, async ({ page }) => {
      const encoded = encodePayload(kind, fields);
      expect(encoded.ok, `the ${kind} fixture must encode`).toBe(true);
      if (!encoded.ok) return;
      await expectDecodes(page, { url: encoded.value, kind, fields });
    });
  }
});
