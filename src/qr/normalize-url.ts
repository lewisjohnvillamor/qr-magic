/**
 * URL normalization and validation.
 *
 * The QR code is only as trustworthy as the string it encodes, so this module is
 * deliberately strict: it accepts http(s) destinations, normalizes them to a
 * canonical form, and rejects everything else with a message the UI can show.
 */

export const MAX_URL_LENGTH = 1200;

/** URL lengths above this still encode, but produce a visually dense code. */
export const DENSE_URL_LENGTH = 300;

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** Schemes that are worth naming explicitly in the error message. */
const UNSAFE_SCHEMES = [
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'blob:',
  'about:',
  'chrome:',
  'mailto:',
  'tel:',
  'ftp:',
  'ws:',
  'wss:',
];

export type UrlValidation =
  | { ok: true; url: string; dense: boolean }
  | { ok: false; reason: UrlErrorReason; message: string };

export type UrlErrorReason = 'empty' | 'too-long' | 'unsafe-scheme' | 'malformed' | 'missing-host';

/**
 * A scheme is only recognised when it is followed by `//`. Without this,
 * `sub.example.co.uk:8443/path` parses as the scheme `sub.example.co.uk`.
 * Schemeless dangerous inputs are already rejected by the list above.
 */
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

/**
 * A bare host such as `example.com` or `sub.example.co.uk/path`. Requires at
 * least one dot and a 2+ character TLD so that typos like `helloworld` are
 * rejected rather than silently turned into `https://helloworld`.
 */
const BARE_HOST = /^(?:[\w-]+\.)+[a-zA-Z]{2,}(?::\d{1,5})?(?:[/?#]|$)/;

function fail(reason: UrlErrorReason, message: string): UrlValidation {
  return { ok: false, reason, message };
}

/**
 * Trim, add a scheme when a recognizable hostname was typed without one, and
 * validate. Returns the canonical serialization of the destination.
 */
export function normalizeUrl(input: string): UrlValidation {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return fail('empty', 'Enter a link to turn into a sculpture.');
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    return fail('too-long', `Links must be ${MAX_URL_LENGTH} characters or fewer.`);
  }

  const lowered = trimmed.toLowerCase();
  const unsafe = UNSAFE_SCHEMES.find((scheme) => lowered.startsWith(scheme));
  if (unsafe) {
    return fail(
      'unsafe-scheme',
      `${unsafe.replace(':', '')} links are not supported. Use an http or https address.`,
    );
  }

  let candidate = trimmed;
  if (!HAS_SCHEME.test(candidate)) {
    if (!BARE_HOST.test(candidate)) {
      return fail('missing-host', 'That does not look like a web address yet.');
    }
    candidate = `https://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return fail('malformed', 'That link could not be read. Check it for typos.');
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return fail(
      'unsafe-scheme',
      `${parsed.protocol.replace(':', '')} links are not supported. Use an http or https address.`,
    );
  }

  if (parsed.hostname.length === 0 || !parsed.hostname.includes('.')) {
    // Allow `localhost` for development links, reject other single-label hosts.
    if (parsed.hostname !== 'localhost') {
      return fail('missing-host', 'That link is missing a valid domain name.');
    }
  }

  const url = parsed.toString();
  if (url.length > MAX_URL_LENGTH) {
    return fail('too-long', `Links must be ${MAX_URL_LENGTH} characters or fewer.`);
  }

  return { ok: true, url, dense: url.length > DENSE_URL_LENGTH };
}

/** Convenience wrapper for callers that only need the normalized string. */
export function normalizeUrlOrNull(input: string): string | null {
  const result = normalizeUrl(input);
  return result.ok ? result.url : null;
}
