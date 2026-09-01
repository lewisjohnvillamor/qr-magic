import { describe, expect, it } from 'vitest';
import { MAX_URL_LENGTH, normalizeUrl } from '../../src/qr/normalize-url';

describe('normalizeUrl', () => {
  it('trims whitespace and keeps a valid https URL', () => {
    const result = normalizeUrl('  https://example.com/path?a=1  ');
    expect(result).toMatchObject({ ok: true, url: 'https://example.com/path?a=1' });
  });

  it('adds https:// to a bare hostname', () => {
    const result = normalizeUrl('example.com');
    expect(result.ok && result.url).toBe('https://example.com/');
  });

  it('adds https:// to a bare hostname with a path and port', () => {
    const result = normalizeUrl('sub.example.co.uk:8443/a/b?c=d');
    expect(result.ok && result.url).toBe('https://sub.example.co.uk:8443/a/b?c=d');
  });

  it('accepts plain http', () => {
    const result = normalizeUrl('http://example.com');
    expect(result.ok && result.url).toBe('http://example.com/');
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'vbscript:msgbox',
    'blob:https://example.com/abc',
    'ftp://example.com/file',
    'mailto:someone@example.com',
  ])('rejects the unsafe scheme %s', (input) => {
    const result = normalizeUrl(input);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('unsafe-scheme');
  });

  it('rejects an empty string', () => {
    const result = normalizeUrl('   ');
    expect(result.ok === false && result.reason).toBe('empty');
  });

  it('rejects a single-label host', () => {
    const result = normalizeUrl('helloworld');
    expect(result.ok === false && result.reason).toBe('missing-host');
  });

  it('allows localhost for development links', () => {
    const result = normalizeUrl('http://localhost:5173/preview');
    expect(result.ok).toBe(true);
  });

  it('rejects an over-long URL', () => {
    const result = normalizeUrl(`https://example.com/${'a'.repeat(MAX_URL_LENGTH)}`);
    expect(result.ok === false && result.reason).toBe('too-long');
  });

  it('flags dense but valid URLs', () => {
    const result = normalizeUrl(`https://example.com/${'a'.repeat(320)}`);
    expect(result.ok && result.dense).toBe(true);
  });

  it('is idempotent', () => {
    const first = normalizeUrl('example.com/x');
    const second = normalizeUrl(first.ok ? first.url : '');
    expect(second.ok && second.url).toBe(first.ok && first.url);
  });
});
