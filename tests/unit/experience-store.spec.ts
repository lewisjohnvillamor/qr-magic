import { describe, expect, it } from 'vitest';
import { createExperienceStore, readInitialExperience } from '../../src/app/experience-store';
import { buildShareUrl, SHARE_PARAM } from '../../src/sharing/share-codec';

const shared = buildShareUrl('https://voxelqr.example/', {
  url: 'https://example.com/party',
  sculpture: 'island',
  theme: 'sunset',
});
const sharedSearch = new URL(shared).search;

describe('readInitialExperience', () => {
  it('falls back to defaults with no payload', () => {
    const initial = readInitialExperience('');
    expect(initial.restored).toBe(false);
    expect(initial.failed).toBe(false);
    expect(initial.sculpture).toBe('crystal');
  });

  it('restores a shared experience', () => {
    const initial = readInitialExperience(sharedSearch);
    expect(initial).toMatchObject({
      url: 'https://example.com/party',
      sculpture: 'island',
      theme: 'sunset',
      restored: true,
    });
  });

  it('reports a manipulated payload as failed rather than throwing', () => {
    const initial = readInitialExperience(`?${SHARE_PARAM}=not-a-payload`);
    expect(initial.failed).toBe(true);
    expect(initial.url).toContain('https://');
  });
});

describe('experience store', () => {
  it('commits a valid URL and regenerates the matrix', () => {
    const store = createExperienceStore('');
    const before = store.getState().matrix.value;
    store.getState().setDraftUrl('example.org/new');
    const result = store.getState().commitUrl();
    expect(result.ok).toBe(true);
    expect(store.getState().url).toBe('https://example.org/new');
    expect(store.getState().matrix.value).toBe('https://example.org/new');
    expect(store.getState().matrix.value).not.toBe(before);
    expect(store.getState().urlError).toBeNull();
  });

  it('surfaces a validation error and announces it', () => {
    const store = createExperienceStore('');
    store.getState().setDraftUrl('javascript:alert(1)');
    const result = store.getState().commitUrl();
    expect(result.ok).toBe(false);
    expect(store.getState().urlError).toMatch(/not supported/);
    expect(store.getState().announcement).toBe(store.getState().urlError);
  });

  it('leaves the previous working code in place after a bad edit', () => {
    const store = createExperienceStore('');
    const good = store.getState().matrix.value;
    store.getState().setDraftUrl('nope');
    store.getState().commitUrl();
    expect(store.getState().matrix.value).toBe(good);
  });

  it('warns about dense codes', () => {
    const store = createExperienceStore('');
    store.getState().commitUrl(`https://example.com/${'a'.repeat(320)}`);
    expect(store.getState().urlIsDense).toBe(true);
    expect(store.getState().announcement).toMatch(/dense/);
  });

  it('round-trips its own share URL', () => {
    const store = createExperienceStore('');
    store.getState().commitUrl('https://example.com/deep/link?x=1');
    store.getState().setSculpture('portal');
    store.getState().setTheme('snow');

    const link = store.getState().shareUrl('https://voxelqr.example/');
    const restored = createExperienceStore(new URL(link).search);
    expect(restored.getState().url).toBe('https://example.com/deep/link?x=1');
    expect(restored.getState().sculpture).toBe('portal');
    expect(restored.getState().theme).toBe('snow');
  });

  it('includes brand colours in the share payload only for the brand theme', () => {
    const store = createExperienceStore('');
    store.getState().setBrandColors('#102030', '#fefefe');

    const withoutBrand = new URL(store.getState().shareUrl('https://voxelqr.example/'));
    expect(withoutBrand.searchParams.get(SHARE_PARAM)).toBeTruthy();
    const restoredDefault = createExperienceStore(withoutBrand.search);
    expect(restoredDefault.getState().brandForeground).toBe('#111111');

    store.getState().setTheme('brand');
    const withBrand = new URL(store.getState().shareUrl('https://voxelqr.example/'));
    const restoredBrand = createExperienceStore(withBrand.search);
    expect(restoredBrand.getState().brandForeground).toBe('#102030');
    expect(restoredBrand.getState().brandBackground).toBe('#fefefe');
  });

  it('announces when a shared link could not be read', () => {
    const store = createExperienceStore(`?${SHARE_PARAM}=%%%`);
    expect(store.getState().announcement).toMatch(/could not be read/);
  });

  it('starts muted', () => {
    const store = createExperienceStore('');
    expect(store.getState().muted).toBe(true);
    store.getState().toggleMuted();
    expect(store.getState().muted).toBe(false);
  });

  it('ignores an unsafe payload passed to applyPayload', () => {
    const store = createExperienceStore('');
    const before = store.getState().url;
    store.getState().applyPayload({ url: 'javascript:alert(1)' });
    expect(store.getState().url).toBe(before);
  });
});
