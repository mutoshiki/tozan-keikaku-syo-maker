import { describe, expect, it } from 'vitest';
import { exportDraftFile, importDraftFile } from './draft-files.js';

const sourceScope = { kind: 'project', roomId: 'source-room' };
const draft = {
  schemaVersion: 1, scope: sourceScope, revision: 4, savedAt: '2026-10-31T01:00:00.000Z',
  fields: { mountainName: '四阿山' }, metrics: { distanceKm: 0 }, itinerary: [],
  assets: [{ id: 'route', kind: 'route', name: 'route.webp', mimeType: 'image/webp' }],
  routeAssetId: 'route', progress: { step: 1, maxReachedStep: 1 }, sampleDataActive: false,
};

describe('draft file transfer', () => {
  it('exports and imports image data into the selected local scope', async () => {
    const image = new Blob(['route-bytes'], { type: 'image/webp' });
    const file = await exportDraftFile(draft, new Map([['route', image]]));
    const imported = await importDraftFile(file, { kind: 'standalone', draftId: 'target' });
    expect(imported.draft.scope).toEqual({ kind: 'standalone', draftId: 'target' });
    expect(imported.draft.revision).toBe(0);
    expect(await imported.assets.get('route').text()).toBe('route-bytes');
  });

  it('rejects non-draft and unsupported image payloads', async () => {
    await expect(importDraftFile(new Blob(['{}']), sourceScope)).rejects.toThrow('下書きファイルではありません');
    const invalid = new Blob([JSON.stringify({ format: 'tozan-draft', draft, files: [{ id: 'route', data: '%%%'}] })]);
    await expect(importDraftFile(invalid, sourceScope)).rejects.toThrow();
  });
});
