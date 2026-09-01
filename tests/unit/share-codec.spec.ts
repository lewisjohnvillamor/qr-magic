import { describe, expect, it } from 'vitest';
import {
  MAX_PAYLOAD_CHARS,
  SHARE_PARAM,
  buildShareUrl,
  decodeExperience,
  encodeExperience,
  readExperienceFromSearch,
} from '../../src/sharing/share-codec';

const payload = {
  url: 'https://example.com/campaign',
  sculpture: 'crystal' as const,
  theme: 'cyber' as const,
};

describe('share codec', () => {
  it('round-trips a payload', () => {
    const decoded = decodeExperience(encodeExperience(payload));
    expect(decoded.ok).toBe(true);
    expect(decoded.ok && decoded.payload).toMatchObject({ ...payload, v: 1 });
  });

  it('produces URL-safe output', () => {
    const encoded = encodeExperience({
      ...payload,
      url: 'https://example.com/?q=a+b/c&d=e~f',
    });
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('builds a share URL on the current origin', () => {
    const url = buildShareUrl('https://voxelqr.example/page?old=1#frag', payload);
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://voxelqr.example/page');
    expect(parsed.hash).toBe('');
    expect(parsed.searchParams.get('old')).toBeNull();
    expect(parsed.searchParams.get(SHARE_PARAM)).toBeTruthy();
  });

  it('reads a payload back out of a search string', () => {
    const url = new URL(buildShareUrl('https://voxelqr.example/', payload));
    const decoded = readExperienceFromSearch(url.search);
    expect(decoded.ok && decoded.payload.url).toBe(payload.url);
  });

  it('reports a missing payload', () => {
    expect(decodeExperience(null)).toEqual({ ok: false, reason: 'missing' });
    expect(decodeExperience('')).toEqual({ ok: false, reason: 'missing' });
  });

  it('refuses oversized payloads without parsing them', () => {
    expect(decodeExperience('a'.repeat(MAX_PAYLOAD_CHARS + 1))).toEqual({
      ok: false,
      reason: 'oversized',
    });
  });

  it('rejects malformed base64 and malformed JSON', () => {
    expect(decodeExperience('!!!not-base64!!!').ok).toBe(false);
    expect(decodeExperience(btoa('{ not json')).ok).toBe(false);
  });

  it('rejects a payload whose URL uses an unsafe scheme', () => {
    const hostile = btoa(
      JSON.stringify({ v: 1, url: 'javascript:alert(1)', sculpture: 'cube', theme: 'nature' }),
    );
    expect(decodeExperience(hostile)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a payload from a future schema version', () => {
    const future = btoa(
      JSON.stringify({ v: 99, url: 'https://example.com/', sculpture: 'cube', theme: 'nature' }),
    );
    expect(decodeExperience(future)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('falls back to defaults for unknown sculptures and themes', () => {
    const odd = btoa(
      JSON.stringify({ v: 1, url: 'https://example.com/', sculpture: 'dragon', theme: 'neon' }),
    );
    const decoded = decodeExperience(odd);
    expect(decoded.ok && decoded.payload.sculpture).toBe('crystal');
    expect(decoded.ok && decoded.payload.theme).toBe('nature');
  });

  it('ignores unknown fields', () => {
    const extra = btoa(
      JSON.stringify({
        v: 1,
        url: 'https://example.com/',
        sculpture: 'cube',
        theme: 'snow',
        analytics: 'should-not-survive',
      }),
    );
    const decoded = decodeExperience(extra);
    expect(decoded.ok && Object.keys(decoded.payload).sort()).toEqual([
      'sculpture',
      'theme',
      'url',
      'v',
    ]);
  });

  it('normalizes the destination on the way in', () => {
    const bare = btoa(
      JSON.stringify({ v: 1, url: 'example.com', sculpture: 'cube', theme: 'snow' }),
    );
    const decoded = decodeExperience(bare);
    expect(decoded.ok && decoded.payload.url).toBe('https://example.com/');
  });

  it('rejects an invalid brand colour', () => {
    const bad = btoa(
      JSON.stringify({
        v: 1,
        url: 'https://example.com/',
        sculpture: 'cube',
        theme: 'brand',
        foreground: 'red',
      }),
    );
    expect(decodeExperience(bad)).toEqual({ ok: false, reason: 'invalid' });
  });
});
