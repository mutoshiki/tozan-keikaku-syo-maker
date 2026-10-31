import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteDraft, draftScopeKey, loadDraft, saveDraft } from './draft-storage.js';

const scope = { kind: 'project', roomId: 'A' };
const base = {
  schemaVersion: 1, scope, revision: 0, savedAt: '2026-10-31T01:00:00.000Z',
  fields: { mountainName: '四阿山' }, metrics: { durationMinutes: 0 }, itinerary: [],
  assets: [{ id: 'route', kind: 'route', name: 'route.webp', mimeType: 'image/webp' }],
  routeAssetId: 'route', progress: { step: 1, maxReachedStep: 1 }, sampleDataActive: false,
};

describe('draft storage', () => {
  beforeEach(async () => {
    const request = indexedDB.deleteDatabase('tozan-mountain-drafts-v1');
    await new Promise((resolve, reject) => { request.onsuccess = resolve; request.onerror = reject; });
  });

  it('keeps project scopes separate and stores image blobs with the snapshot', async () => {
    const blob = new Blob(['route-data'], { type: 'image/webp' });
    const saved = await saveDraft(scope, base, { expectedRevision: 0, assets: [{ id: 'route', blob }] });
    expect(saved.status).toBe('saved');
    const loaded = await loadDraft(scope);
    expect(loaded.draft.revision).toBe(1);
    expect(await loaded.assets.get('route').text()).toBe('route-data');
    expect((await loadDraft({ kind: 'project', roomId: 'B' })).status).toBe('empty');
    expect(draftScopeKey(scope)).not.toBe(draftScopeKey({ kind: 'standalone', draftId: 'A' }));
  });

  it('stores image bytes in a Safari-compatible record and reconstructs the blob', async () => {
    const blob = new Blob(['safari-route-data'], { type: 'image/webp' });
    await saveDraft(scope, base, { expectedRevision: 0, assets: [{ id: 'route', blob }] });
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('tozan-mountain-drafts-v1', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise((resolve, reject) => {
      const request = db.transaction('assets', 'readonly').objectStore('assets').get('project:A:route');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    expect(record).toMatchObject({ mimeType: 'image/webp', data: expect.any(ArrayBuffer) });
    const loaded = await loadDraft(scope);
    expect(loaded.assets.get('route')).toBeInstanceOf(Blob);
    expect(loaded.assets.get('route').type).toBe('image/webp');
    expect(await loaded.assets.get('route').text()).toBe('safari-route-data');
  });

  it('reports revision conflicts and retains the previous snapshot and image', async () => {
    const original = new Blob(['original'], { type: 'image/webp' });
    await saveDraft(scope, base, { expectedRevision: 0, assets: [{ id: 'route', blob: original }] });
    const changed = { ...base, fields: { mountainName: '別の山' } };
    const conflict = await saveDraft(scope, changed, { expectedRevision: 0, assets: [{ id: 'route', blob: new Blob(['replacement'], { type: 'image/webp' }) }] });
    expect(conflict.status).toBe('conflict');
    const loaded = await loadDraft(scope);
    expect(loaded.draft.fields.mountainName).toBe('四阿山');
    expect(await loaded.assets.get('route').text()).toBe('original');
  });

  it('deletes a matching revision and its image atomically', async () => {
    await saveDraft(scope, base, { expectedRevision: 0, assets: [{ id: 'route', blob: new Blob(['x'], { type: 'image/webp' }) }] });
    expect((await deleteDraft(scope, { expectedRevision: 0 })).status).toBe('conflict');
    expect((await deleteDraft(scope, { expectedRevision: 1 })).status).toBe('deleted');
    expect((await loadDraft(scope)).status).toBe('empty');
  });
});
