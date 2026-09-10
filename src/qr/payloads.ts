/**
 * What a code can carry.
 *
 * A QR code is just a string, so "supporting Wi-Fi" is really "knowing the
 * string a phone's camera recognises as a network". Each kind below owns its
 * own field set and its own encoder, and every encoder is pure: given the same
 * draft it returns the same string, so the matrix, the sculpture and the share
 * link can never drift apart.
 *
 * The encoders are also the only place escaping happens. A password containing
 * `;` and a contact name containing `,` are ordinary inputs that silently break
 * a naively concatenated payload, so each format's own escape rules are applied
 * here rather than trusted to the caller.
 */

import { normalizeUrl, MAX_URL_LENGTH } from './normalize-url';

export const PAYLOAD_KINDS = ['url', 'text', 'wifi', 'contact', 'email', 'sms', 'phone'] as const;

export type PayloadKind = (typeof PAYLOAD_KINDS)[number];

export const DEFAULT_PAYLOAD_KIND: PayloadKind = 'url';

/**
 * Longest string any kind may encode.
 *
 * Shared with links deliberately: past this the code is too dense to scan
 * comfortably at any of the sizes this app presents it at, whatever it holds.
 */
export const MAX_PAYLOAD_LENGTH = MAX_URL_LENGTH;

/** Encoded values above this still work, but produce a visually dense code. */
export const DENSE_PAYLOAD_LENGTH = 300;

export function isPayloadKind(value: unknown): value is PayloadKind {
  return typeof value === 'string' && (PAYLOAD_KINDS as readonly string[]).includes(value);
}

/** How a single field is collected. `select` carries its own option list. */
export interface PayloadField {
  key: string;
  label: string;
  placeholder?: string;
  control?: 'text' | 'textarea' | 'select' | 'checkbox';
  inputMode?: 'text' | 'url' | 'email' | 'tel' | 'numeric';
  options?: readonly { value: string; label: string }[];
  maxLength?: number;
  /** Optional fields may be left blank without failing validation. */
  optional?: boolean;
}

export interface PayloadType {
  id: PayloadKind;
  label: string;
  hint: string;
  /** The field shown in the main card; the rest live in the config drawer. */
  primary: string;
  fields: readonly PayloadField[];
}

export const PAYLOAD_TYPES: Record<PayloadKind, PayloadType> = {
  url: {
    id: 'url',
    label: 'Link',
    hint: 'Opens a web address',
    primary: 'url',
    fields: [
      {
        key: 'url',
        label: 'Destination link',
        placeholder: 'example.com/your-page',
        inputMode: 'url',
        maxLength: MAX_URL_LENGTH,
      },
    ],
  },
  text: {
    id: 'text',
    label: 'Text',
    hint: 'Shows a plain message',
    primary: 'text',
    fields: [
      {
        key: 'text',
        label: 'Message',
        placeholder: 'Anything you like',
        control: 'textarea',
        maxLength: MAX_PAYLOAD_LENGTH,
      },
    ],
  },
  wifi: {
    id: 'wifi',
    label: 'Wi-Fi',
    hint: 'Joins a network',
    primary: 'wifiSsid',
    fields: [
      { key: 'wifiSsid', label: 'Network name', placeholder: 'Cafe Guest', maxLength: 64 },
      {
        key: 'wifiSecurity',
        label: 'Security',
        control: 'select',
        options: [
          { value: 'WPA', label: 'WPA / WPA2 / WPA3' },
          { value: 'WEP', label: 'WEP' },
          { value: 'nopass', label: 'Open (no password)' },
        ],
      },
      {
        key: 'wifiPassword',
        label: 'Password',
        placeholder: 'Leave blank for an open network',
        maxLength: 128,
        optional: true,
      },
      { key: 'wifiHidden', label: 'Hidden network', control: 'checkbox', optional: true },
    ],
  },
  contact: {
    id: 'contact',
    label: 'Contact',
    hint: 'Saves a contact card',
    primary: 'contactName',
    fields: [
      { key: 'contactName', label: 'Full name', placeholder: 'Ada Lovelace', maxLength: 96 },
      {
        key: 'contactOrg',
        label: 'Organisation',
        placeholder: 'Analytical Engines',
        maxLength: 96,
        optional: true,
      },
      {
        key: 'contactTitle',
        label: 'Job title',
        placeholder: 'Mathematician',
        maxLength: 96,
        optional: true,
      },
      {
        key: 'contactPhone',
        label: 'Phone',
        placeholder: '+44 20 7946 0000',
        inputMode: 'tel',
        maxLength: 40,
        optional: true,
      },
      {
        key: 'contactEmail',
        label: 'Email',
        placeholder: 'ada@example.com',
        inputMode: 'email',
        maxLength: 128,
        optional: true,
      },
      {
        key: 'contactUrl',
        label: 'Website',
        placeholder: 'example.com',
        inputMode: 'url',
        maxLength: 200,
        optional: true,
      },
    ],
  },
  email: {
    id: 'email',
    label: 'Email',
    hint: 'Opens a pre-filled message',
    primary: 'emailTo',
    fields: [
      {
        key: 'emailTo',
        label: 'To',
        placeholder: 'hello@example.com',
        inputMode: 'email',
        maxLength: 128,
      },
      { key: 'emailSubject', label: 'Subject', maxLength: 160, optional: true },
      {
        key: 'emailBody',
        label: 'Message',
        control: 'textarea',
        maxLength: 600,
        optional: true,
      },
    ],
  },
  sms: {
    id: 'sms',
    label: 'SMS',
    hint: 'Opens a pre-filled text',
    primary: 'smsTo',
    fields: [
      {
        key: 'smsTo',
        label: 'Number',
        placeholder: '+44 7700 900000',
        inputMode: 'tel',
        maxLength: 40,
      },
      { key: 'smsBody', label: 'Message', control: 'textarea', maxLength: 400, optional: true },
    ],
  },
  phone: {
    id: 'phone',
    label: 'Phone',
    hint: 'Starts a call',
    primary: 'phone',
    fields: [
      {
        key: 'phone',
        label: 'Number',
        placeholder: '+44 20 7946 0000',
        inputMode: 'tel',
        maxLength: 40,
      },
    ],
  },
};

/** Every field of every kind, so one flat draft object can hold them all. */
export type PayloadDraft = Record<string, string>;

export function createDraft(url: string): PayloadDraft {
  const draft: PayloadDraft = {};
  for (const type of Object.values(PAYLOAD_TYPES)) {
    for (const field of type.fields) {
      draft[field.key] = field.control === 'select' ? (field.options?.[0]?.value ?? '') : '';
    }
  }
  draft.url = url;
  return draft;
}

export type PayloadResult =
  { ok: true; value: string; dense: boolean } | { ok: false; message: string };

function fail(message: string): PayloadResult {
  return { ok: false, message };
}

function done(value: string): PayloadResult {
  if (value.length > MAX_PAYLOAD_LENGTH) {
    return fail(`That is too long to encode — keep it under ${MAX_PAYLOAD_LENGTH} characters.`);
  }
  return { ok: true, value, dense: value.length > DENSE_PAYLOAD_LENGTH };
}

const read = (draft: PayloadDraft, key: string) => (draft[key] ?? '').trim();

/**
 * Escape for the `WIFI:` format, whose separators are `;` and `:`.
 *
 * A password of `p;a:s"s` is perfectly legal and, unescaped, truncates the
 * payload at the first `;` — the network then silently fails to join.
 */
function escapeWifi(value: string): string {
  return value.replace(/([;,:"])/g, '\\$1');
}

/** Escape for vCard text values: `\`, `;`, `,` and newlines are structural. */
function escapeVcard(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Digits, `+`, and the punctuation dialers tolerate. */
const PHONE_PATTERN = /^\+?[0-9 ().-]{4,}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Strip a dialable number down to what belongs after `tel:`. */
function dialable(value: string): string {
  const compact = value.replace(/[^\d+]/g, '');
  return compact.startsWith('+') ? `+${compact.slice(1).replace(/\+/g, '')}` : compact;
}

/**
 * Turn a draft into the exact string the code will carry.
 *
 * Returns a message rather than throwing: every failure here is something a
 * person mistyped, and the UI shows it under the field.
 */
export function encodePayload(kind: PayloadKind, draft: PayloadDraft): PayloadResult {
  switch (kind) {
    case 'url': {
      const result = normalizeUrl(draft.url ?? '');
      if (!result.ok) return fail(result.message);
      return { ok: true, value: result.url, dense: result.dense };
    }

    case 'text': {
      const text = (draft.text ?? '').trim();
      if (text.length === 0) return fail('Enter some text to turn into a sculpture.');
      return done(text);
    }

    case 'wifi': {
      const ssid = read(draft, 'wifiSsid');
      if (ssid.length === 0) return fail('Enter the network name.');
      const security = read(draft, 'wifiSecurity') || 'WPA';
      const password = draft.wifiPassword ?? '';
      if (security !== 'nopass' && password.length === 0) {
        return fail('Enter the password, or set the security to Open.');
      }
      const hidden = read(draft, 'wifiHidden') === '1';
      const parts = [
        `T:${security}`,
        `S:${escapeWifi(ssid)}`,
        security === 'nopass' ? '' : `P:${escapeWifi(password)}`,
        hidden ? 'H:true' : '',
      ].filter((part) => part.length > 0);
      return done(`WIFI:${parts.join(';')};;`);
    }

    case 'contact': {
      const name = read(draft, 'contactName');
      if (name.length === 0) return fail('Enter the contact’s name.');
      const email = read(draft, 'contactEmail');
      if (email.length > 0 && !EMAIL_PATTERN.test(email)) {
        return fail('That contact email address does not look right.');
      }
      const website = read(draft, 'contactUrl');
      let normalizedSite = '';
      if (website.length > 0) {
        const parsed = normalizeUrl(website);
        if (!parsed.ok) return fail('That contact website does not look right.');
        normalizedSite = parsed.url;
      }
      // vCard 3.0: the version every phone camera has understood for a decade.
      // Lines are CRLF-terminated because the spec says so and some importers
      // are strict about it.
      const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escapeVcard(name)}`];
      const surname = name.split(/\s+/).slice(-1)[0] ?? name;
      const forenames = name.split(/\s+/).slice(0, -1).join(' ');
      lines.push(`N:${escapeVcard(surname)};${escapeVcard(forenames)};;;`);
      const org = read(draft, 'contactOrg');
      if (org.length > 0) lines.push(`ORG:${escapeVcard(org)}`);
      const title = read(draft, 'contactTitle');
      if (title.length > 0) lines.push(`TITLE:${escapeVcard(title)}`);
      const phone = read(draft, 'contactPhone');
      if (phone.length > 0) {
        if (!PHONE_PATTERN.test(phone))
          return fail('That contact phone number does not look right.');
        lines.push(`TEL;TYPE=CELL:${dialable(phone)}`);
      }
      if (email.length > 0) lines.push(`EMAIL;TYPE=INTERNET:${escapeVcard(email)}`);
      if (normalizedSite.length > 0) lines.push(`URL:${escapeVcard(normalizedSite)}`);
      lines.push('END:VCARD');
      return done(`${lines.join('\r\n')}\r\n`);
    }

    case 'email': {
      const to = read(draft, 'emailTo');
      if (to.length === 0) return fail('Enter the address to send to.');
      if (!EMAIL_PATTERN.test(to)) return fail('That email address does not look right.');
      const query: string[] = [];
      const subject = read(draft, 'emailSubject');
      if (subject.length > 0) query.push(`subject=${encodeURIComponent(subject)}`);
      const body = draft.emailBody ?? '';
      if (body.trim().length > 0) query.push(`body=${encodeURIComponent(body)}`);
      const suffix = query.length > 0 ? `?${query.join('&')}` : '';
      return done(`mailto:${encodeURIComponent(to).replace(/%40/g, '@')}${suffix}`);
    }

    case 'sms': {
      const to = read(draft, 'smsTo');
      if (to.length === 0) return fail('Enter the number to text.');
      if (!PHONE_PATTERN.test(to)) return fail('That number does not look right.');
      const body = (draft.smsBody ?? '').trim();
      // `SMSTO:` is the form both iOS and Android camera apps recognise; the
      // `sms:` URI is read inconsistently once a body is attached.
      return done(body.length > 0 ? `SMSTO:${dialable(to)}:${body}` : `SMSTO:${dialable(to)}`);
    }

    case 'phone': {
      const number = read(draft, 'phone');
      if (number.length === 0) return fail('Enter a number to call.');
      if (!PHONE_PATTERN.test(number)) return fail('That number does not look right.');
      return done(`tel:${dialable(number)}`);
    }
  }
}

/**
 * Just the fields the current kind uses.
 *
 * The draft holds every field of every kind so switching back and forth never
 * loses typing — which means it can be holding a Wi-Fi password while the code
 * encodes a link. A share link must not carry that, so anything leaving the app
 * is narrowed to the kind actually in use first.
 */
export function draftFor(kind: PayloadKind, draft: PayloadDraft): PayloadDraft {
  const narrowed: PayloadDraft = {};
  for (const field of PAYLOAD_TYPES[kind].fields) {
    const value = draft[field.key];
    if (value !== undefined && value !== '') narrowed[field.key] = value;
  }
  return narrowed;
}

/** A one-line, human summary of what the code currently carries. */
export function describePayload(kind: PayloadKind, draft: PayloadDraft, value: string): string {
  switch (kind) {
    case 'url':
      return value;
    case 'text':
      return read(draft, 'text');
    case 'wifi':
      return `Wi-Fi — ${read(draft, 'wifiSsid')}`;
    case 'contact':
      return `Contact — ${read(draft, 'contactName')}`;
    case 'email':
      return `Email — ${read(draft, 'emailTo')}`;
    case 'sms':
      return `SMS — ${read(draft, 'smsTo')}`;
    case 'phone':
      return `Call — ${read(draft, 'phone')}`;
  }
}
