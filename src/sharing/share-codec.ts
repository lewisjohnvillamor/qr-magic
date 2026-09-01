import { experiencePayloadSchema, EXPERIENCE_SCHEMA_VERSION } from './experience-schema';
import type { ExperiencePayload } from './experience-schema';
import { normalizeUrl } from '../qr/normalize-url';

/** Query parameter carrying the encoded experience. */
export const SHARE_PARAM = 'experience';

/**
 * Hard cap on encoded payload size. A share link is untrusted input from the
 * address bar; refusing to even parse an oversized one keeps the cost bounded.
 */
export const MAX_PAYLOAD_CHARS = 2048;

export type DecodeResult =
  | { ok: true; payload: ExperiencePayload }
  | { ok: false; reason: 'missing' | 'oversized' | 'malformed' | 'invalid' };

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** Encode a validated payload as a Base64URL string. */
export function encodeExperience(payload: Omit<ExperiencePayload, 'v'>): string {
  const parsed = experiencePayloadSchema.parse({ ...payload, v: EXPERIENCE_SCHEMA_VERSION });
  const json = JSON.stringify(parsed);
  return toBase64Url(new TextEncoder().encode(json));
}

/**
 * Decode and validate an untrusted payload.
 *
 * Every failure mode is explicit and non-throwing: a manipulated link falls back
 * to the default experience rather than breaking the page.
 */
export function decodeExperience(encoded: string | null | undefined): DecodeResult {
  if (!encoded) return { ok: false, reason: 'missing' };
  if (encoded.length > MAX_PAYLOAD_CHARS) return { ok: false, reason: 'oversized' };

  const bytes = fromBase64Url(encoded);
  if (!bytes) return { ok: false, reason: 'malformed' };

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const parsed = experiencePayloadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'invalid' };

  // The destination is re-validated on the way in: an encoded `javascript:` URL
  // must not survive a round trip through a share link.
  const url = normalizeUrl(parsed.data.url);
  if (!url.ok) return { ok: false, reason: 'invalid' };

  return { ok: true, payload: { ...parsed.data, url: url.url } };
}

/** Build the full shareable experience URL for the current origin. */
export function buildShareUrl(baseUrl: string, payload: Omit<ExperiencePayload, 'v'>): string {
  const url = new URL(baseUrl);
  url.hash = '';
  url.search = '';
  url.searchParams.set(SHARE_PARAM, encodeExperience(payload));
  return url.toString();
}

/** Read the experience payload out of a location search string. */
export function readExperienceFromSearch(search: string): DecodeResult {
  const params = new URLSearchParams(search);
  return decodeExperience(params.get(SHARE_PARAM));
}
