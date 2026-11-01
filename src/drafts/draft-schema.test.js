import { describe, expect, it } from 'vitest';
import { normalizeDraft, validateDraft } from './draft-schema.js';
import { captureDraft, restoreDraft } from './draft-runtime-adapter.js';

const seed = {
  schemaVersion: 1, scope: { kind: 'project', roomId: 'room-a' }, revision: 2,
  savedAt: '2026-10-31T01:00:00.000Z', fields: { eventDate: '', plannerName: '山田' },
  metrics: { durationMinutes: 0, distanceKm: null, ascentM: 0, descentM: 12 },
  itinerary: [{ time: '08:00', place: '登山口', major: true, restMinutes: 0, _editing: true }],
  assets: [{ id: 'route-1', kind: 'route', name: 'route.png', mimeType: 'image/png' }],
  routeAssetId: 'route-1', progress: { step: 2, maxReachedStep: 2 }, sampleDataActive: false,
};

describe('mountain draft schema and runtime adapter', () => {
  it('normalizes an allowlisted, room-scoped snapshot and preserves empty values and zero', () => {
    const draft = normalizeDraft(seed);
    expect(draft.fields).toEqual({ eventDate: '', plannerName: '山田' });
    expect(draft.metrics).toMatchObject({ durationMinutes: 0, ascentM: 0 });
    expect(draft.itinerary[0]).not.toHaveProperty('_editing');
  });

  it('rejects future schema versions and invalid image references without mutating input', () => {
    expect(validateDraft({ ...seed, schemaVersion: 99 }).valid).toBe(false);
    expect(validateDraft({ ...seed, routeAssetId: 'missing' }).valid).toBe(false);
    expect(seed.itinerary[0]._editing).toBe(true);
  });

  it('captures runtime data and restores fields, images, and editable state without analysis', () => {
    const controls = new Map([
      ['eventDate', { value: '' }], ['plannerName', { value: '山田' }],
      ['rememberContacts', { type: 'checkbox', checked: true }],
    ]);
    const root = {
      querySelector(selector) { return controls.get(selector.slice(1)) || null; },
    };
    const source = {
      root, state: { step: 1, maxReachedStep: 2, metrics: { durationMinutes: 0 }, itinerary: [{ ...seed.itinerary[0], _editing: true }], uploads: [{ id: 'route-1', kind: 'route' }], sampleDataActive: false },
    };
    const captured = captureDraft(source, { scope: seed.scope, assets: seed.assets });
    expect(captured.fields.eventDate).toBe('');
    expect(captured.metrics.durationMinutes).toBe(0);
    expect(captured.itinerary[0]).not.toHaveProperty('_editing');

    const restoredState = { metrics: {}, itinerary: [], uploads: [] };
    const restoredControl = { value: 'old' };
    const target = {
      root: {
        querySelector: (selector) => selector === '#plannerName' ? restoredControl : null,
        querySelectorAll: () => [],
      },
      state: restoredState, invalidatePdf() {},
    };
    const blob = new Blob(['image'], { type: 'image/png' });
    const result = restoreDraft(target, captured, new Map([['route-1', blob]]));
    expect(restoredControl.value).toBe('山田');
    expect(restoredState.analyzing).toBe(false);
    expect(restoredState.uploads).toHaveLength(1);
    expect(result.restoredAssets).toBe(1);
  });
});
