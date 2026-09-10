import { describe, expect, it } from 'vitest';
import {
  PAYLOAD_KINDS,
  PAYLOAD_TYPES,
  createDraft,
  describePayload,
  draftFor,
  encodePayload,
} from '../../src/qr/payloads';

describe('payload encoders', () => {
  it('normalizes a bare host for the link kind', () => {
    const result = encodePayload('url', { url: 'example.com/a' });
    expect(result.ok && result.value).toBe('https://example.com/a');
  });

  it('encodes plain text exactly as typed', () => {
    const result = encodePayload('text', { text: '  Meet me at the pier  ' });
    expect(result.ok && result.value).toBe('Meet me at the pier');
  });

  it('encodes a Wi-Fi network in the format a camera recognises', () => {
    const result = encodePayload('wifi', {
      wifiSsid: 'Cafe Guest',
      wifiSecurity: 'WPA',
      wifiPassword: 'flat white',
      wifiHidden: '',
    });
    expect(result.ok && result.value).toBe('WIFI:T:WPA;S:Cafe Guest;P:flat white;;');
  });

  it('escapes the separators that would otherwise truncate a network', () => {
    // A password of `p;a:s"s` is legal and, unescaped, ends the payload at the
    // first `;` — the phone then fails to join, silently and for no visible
    // reason.
    const result = encodePayload('wifi', {
      wifiSsid: 'Bar, Grill',
      wifiSecurity: 'WPA',
      wifiPassword: 'p;a:s"s',
    });
    expect(result.ok && result.value).toBe('WIFI:T:WPA;S:Bar\\, Grill;P:p\\;a\\:s\\"s;;');
  });

  it('marks a hidden network and omits the password on an open one', () => {
    const hidden = encodePayload('wifi', {
      wifiSsid: 'Back office',
      wifiSecurity: 'WPA',
      wifiPassword: 'x',
      wifiHidden: '1',
    });
    expect(hidden.ok && hidden.value).toContain(';H:true;');

    const open = encodePayload('wifi', { wifiSsid: 'Library', wifiSecurity: 'nopass' });
    expect(open.ok && open.value).toBe('WIFI:T:nopass;S:Library;;');
  });

  it('refuses a secured network with no password', () => {
    const result = encodePayload('wifi', { wifiSsid: 'Cafe', wifiSecurity: 'WPA' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toMatch(/password/i);
  });

  it('builds a vCard with CRLF lines and escaped values', () => {
    const result = encodePayload('contact', {
      contactName: 'Ada Lovelace',
      contactOrg: 'Analytical, Engines',
      contactPhone: '+44 20 7946 0000',
      contactEmail: 'ada@example.com',
      contactUrl: 'example.com',
    });
    expect(result.ok).toBe(true);
    const value = result.ok ? result.value : '';
    expect(value.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true);
    expect(value).toContain('FN:Ada Lovelace');
    expect(value).toContain('N:Lovelace;Ada;;;');
    expect(value).toContain('ORG:Analytical\\, Engines');
    expect(value).toContain('TEL;TYPE=CELL:+442079460000');
    expect(value).toContain('URL:https://example.com/');
    expect(value.endsWith('END:VCARD\r\n')).toBe(true);
  });

  it('rejects a contact with an address that is not one', () => {
    const result = encodePayload('contact', {
      contactName: 'Ada',
      contactEmail: 'not an address',
    });
    expect(result.ok).toBe(false);
  });

  it('encodes an email with its subject and body percent-escaped', () => {
    const result = encodePayload('email', {
      emailTo: 'hello@example.com',
      emailSubject: 'Hello & goodbye',
      emailBody: 'Line one',
    });
    expect(result.ok && result.value).toBe(
      'mailto:hello@example.com?subject=Hello%20%26%20goodbye&body=Line%20one',
    );
  });

  it('uses SMSTO, the form both phone cameras read', () => {
    const withBody = encodePayload('sms', { smsTo: '+44 7700 900000', smsBody: 'on my way' });
    expect(withBody.ok && withBody.value).toBe('SMSTO:+447700900000:on my way');
    const bare = encodePayload('sms', { smsTo: '+44 7700 900000' });
    expect(bare.ok && bare.value).toBe('SMSTO:+447700900000');
  });

  it('strips a phone number down to what a dialer accepts', () => {
    const result = encodePayload('phone', { phone: '+44 (20) 7946-0000' });
    expect(result.ok && result.value).toBe('tel:+442079460000');
  });

  it('rejects a number that is not one', () => {
    expect(encodePayload('phone', { phone: 'call me' }).ok).toBe(false);
  });

  it('asks for the missing thing when a kind has nothing to encode', () => {
    for (const kind of PAYLOAD_KINDS) {
      const result = encodePayload(kind, createDraft(''));
      expect(result.ok).toBe(false);
      expect(!result.ok && result.message.length).toBeGreaterThan(0);
    }
  });

  it('every kind names a primary field that it actually has', () => {
    for (const kind of PAYLOAD_KINDS) {
      const type = PAYLOAD_TYPES[kind];
      expect(type.fields.some((field) => field.key === type.primary)).toBe(true);
    }
  });

  it('narrows a draft to the kind in use, so nothing else travels in a link', () => {
    const draft = { url: 'https://example.com/', wifiPassword: 'secret', wifiSsid: 'Cafe' };
    expect(draftFor('url', draft)).toEqual({ url: 'https://example.com/' });
    expect(draftFor('wifi', draft)).not.toHaveProperty('url');
  });

  it('describes what the code carries without reading out the payload', () => {
    expect(describePayload('wifi', { wifiSsid: 'Cafe Guest' }, 'WIFI:...')).toBe(
      'Wi-Fi — Cafe Guest',
    );
    expect(describePayload('contact', { contactName: 'Ada' }, 'BEGIN:VCARD')).toBe('Contact — Ada');
  });
});
