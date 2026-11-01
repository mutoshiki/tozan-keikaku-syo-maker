import { describe, expect, it } from 'vitest';
import { exportDraftFile } from './draft-files.js';

const sourceScope = { kind: 'project', roomId: 'source-room' };
const draft = {
  schemaVersion: 1, scope: sourceScope, revision: 4, savedAt: '2026-10-31T01:00:00.000Z',
  fields: { mountainName: '四阿山' }, metrics: { distanceKm: 0 }, itinerary: [],
  assets: [{ id: 'route', kind: 'route', name: 'route.webp', mimeType: 'image/webp' }],
  routeAssetId: 'route', progress: { step: 1, maxReachedStep: 1 }, sampleDataActive: false,
};

describe('draft recovery export', () => {
  it('exports the current draft and its image data for recovery', async () => {
    const image = new Blob(['route-bytes'], { type: 'image/webp' });
    const file = await exportDraftFile(draft, new Map([['route', image]]));
    const payload = JSON.parse(await file.text());
    expect(payload.format).toBe('tozan-draft');
    expect(payload.draft.scope).toEqual(sourceScope);
    expect(payload.files).toEqual([{ id: 'route', data: expect.any(String) }]);
  });
});
