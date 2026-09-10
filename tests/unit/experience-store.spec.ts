import { describe, expect, it } from 'vitest';
import { createExperienceStore, readInitialExperience } from '../../src/app/experience-store';
import { buildShareUrl, SHARE_PARAM } from '../../src/sharing/share-codec';

const shared = buildShareUrl('https://voxelqr.example/', {
  url: 'https://example.com/party',
  kind: 'url',
  f: { url: 'https://example.com/party' },
  sculpture: 'island',
  theme: 'sunset',
  module: 'square',
  corner: 'square',
});
const sharedSearch = new URL(shared).search;

describe('readInitialExperience', () => {
  it('falls back to defaults with no payload', () => {
    const initial = readInitialExperience('');
    expect(initial.failed).toBe(false);
    expect(initial.sculpture).toBe('crystal');
  });

  it('restores a shared experience', () => {
    const initial = readInitialExperience(sharedSearch);
    expect(initial).toMatchObject({
      value: 'https://example.com/party',
      sculpture: 'island',
      theme: 'sunset',
    });
  });

  it('reports a manipulated payload as failed rather than throwing', () => {
    const initial = readInitialExperience(`?${SHARE_PARAM}=not-a-payload`);
    expect(initial.failed).toBe(true);
    expect(initial.value).toContain('https://');
  });
});

describe('experience store', () => {
  it('commits a valid URL and regenerates the matrix', () => {
    const store = createExperienceStore('');
    const before = store.getState().matrix.value;
    store.getState().setDraftField('url', 'example.org/new');
    const result = store.getState().commitPayload();
    expect(result.ok).toBe(true);
    expect(store.getState().value).toBe('https://example.org/new');
    expect(store.getState().matrix.value).toBe('https://example.org/new');
    expect(store.getState().matrix.value).not.toBe(before);
    expect(store.getState().valueError).toBeNull();
  });

  it('surfaces a validation error and announces it', () => {
    const store = createExperienceStore('');
    store.getState().setDraftField('url', 'javascript:alert(1)');
    const result = store.getState().commitPayload();
    expect(result.ok).toBe(false);
    expect(store.getState().valueError).toMatch(/not supported/);
    expect(store.getState().announcement).toBe(store.getState().valueError);
  });

  it('leaves the previous working code in place after a bad edit', () => {
    const store = createExperienceStore('');
    const good = store.getState().matrix.value;
    store.getState().setDraftField('url', 'nope');
    store.getState().commitPayload();
    expect(store.getState().matrix.value).toBe(good);
  });

  it('warns about dense codes', () => {
    const store = createExperienceStore('');
    store.getState().setDraftField('url', `https://example.com/${'a'.repeat(320)}`);
    store.getState().commitPayload();
    expect(store.getState().valueIsDense).toBe(true);
    expect(store.getState().announcement).toMatch(/dense/);
  });

  it('round-trips its own share URL', () => {
    const store = createExperienceStore('');
    store.getState().setDraftField('url', 'https://example.com/deep/link?x=1');
    store.getState().commitPayload();
    store.getState().setSculpture('portal');
    store.getState().setTheme('snow');

    const link = store.getState().shareUrl('https://voxelqr.example/');
    const restored = createExperienceStore(new URL(link).search);
    expect(restored.getState().value).toBe('https://example.com/deep/link?x=1');
    expect(restored.getState().sculpture).toBe('portal');
    expect(restored.getState().theme).toBe('snow');
  });

  it('opens a link that still names the retired brand theme', () => {
    // Brand was a theme before it became a sculpture, and those links are in
    // the wild: they must open on the default theme, not break.
    const legacy = buildShareUrl('https://voxelqr.example/', {
      url: 'https://example.com/old',
      kind: 'url',
      f: { url: 'https://example.com/old' },
      sculpture: 'portal',
      theme: 'brand' as never,
      module: 'square',
      corner: 'square',
    });
    const store = createExperienceStore(new URL(legacy).search);
    expect(store.getState().value).toBe('https://example.com/old');
    expect(store.getState().theme).toBe('nature');
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

  it('selects an uploaded sculpture on arrival and puts it back on removal', () => {
    const store = createExperienceStore('');
    const mine = { name: 'logo.png', preview: 'data:,', points: [] };

    store.getState().setCustomSculpture(mine);
    expect(store.getState().sculpture).toBe('custom');
    expect(store.getState().customSculpture).toBe(mine);

    store.getState().setCustomSculpture(null);
    // The scene cannot be left pointing at a sculpture that no longer exists.
    expect(store.getState().sculpture).toBe('crystal');
    expect(store.getState().customSculpture).toBeNull();
  });

  it('leaves a built-in selection alone when an upload is removed', () => {
    const store = createExperienceStore('');
    store.getState().setSculpture('island');
    store.getState().setCustomSculpture(null);
    expect(store.getState().sculpture).toBe('island');
  });

  it('shares a built-in in place of an uploaded sculpture', () => {
    // The picture never left this device, so a link naming the sculpture built
    // from it would open on nothing.
    const store = createExperienceStore('');
    store.getState().setCustomSculpture({ name: 'logo.png', preview: 'data:,', points: [] });

    const link = store.getState().shareUrl('https://voxelqr.example/');
    const restored = createExperienceStore(new URL(link).search);
    expect(restored.getState().sculpture).toBe('crystal');
    expect(restored.getState().customSculpture).toBeNull();
  });
});
