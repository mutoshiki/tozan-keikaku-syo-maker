import { DRAFT_FIELD_IDS, normalizeDraft } from './draft-schema.js';

const METRIC_KEYS = ['durationMinutes', 'distanceKm', 'ascentM', 'descentM'];

function readControl(root, id) {
  const control = root.querySelector(`#${id}`);
  if (!control || control.type === 'file') return undefined;
  if (control.type === 'checkbox') return control.checked ? 'true' : 'false';
  return String(control.value ?? '');
}

export function captureDraft(runtime, { scope, revision = 0, savedAt = new Date().toISOString(), assets = [] }) {
  const { root, state } = runtime;
  const fields = {};
  for (const id of DRAFT_FIELD_IDS) {
    const value = readControl(root, id);
    if (value !== undefined) fields[id] = value;
  }
  const itinerary = (state.itinerary || []).map(({ time, place, major, restMinutes }) => ({
    time: String(time || ''), place: String(place || ''), major: major !== false, restMinutes: Number(restMinutes || 0),
  }));
  const manifest = assets.map(({ id, kind, name, mimeType }) => ({ id, kind, name, mimeType }));
  const draft = {
    schemaVersion: 1,
    scope,
    revision,
    savedAt,
    fields,
    metrics: Object.fromEntries(METRIC_KEYS.map((key) => [key, state.metrics?.[key] ?? null])),
    itinerary,
    assets: manifest,
    routeAssetId: state.uploads?.find((upload) => upload.kind === 'route')?.id || null,
    progress: { step: state.step || 1, maxReachedStep: state.maxReachedStep || 1 },
    sampleDataActive: state.sampleDataActive === true,
  };
  return normalizeDraft(draft);
}

export function restoreDraft(runtime, value, assetBlobs = new Map()) {
  const draft = normalizeDraft(value);
  const { root, state, renderUploads, renderRoutePreview, renderItinerary, syncMetricInputs, renderProgress, syncStep2Readiness, invalidatePdf } = runtime;
  for (const id of DRAFT_FIELD_IDS) {
    const control = root.querySelector(`#${id}`);
    if (!control || !Object.hasOwn(draft.fields, id)) continue;
    if (control.type === 'checkbox') control.checked = draft.fields[id] === 'true';
    else control.value = draft.fields[id];
  }
  for (const oldUpload of state.uploads || []) {
    if (typeof oldUpload.url === 'string' && oldUpload.url.startsWith('blob:')) URL.revokeObjectURL(oldUpload.url);
  }
  state.metrics = { ...draft.metrics };
  state.itinerary = draft.itinerary.map((row) => ({ ...row }));
  state.uploads = draft.assets.map((asset) => {
    const blob = assetBlobs.get(asset.id);
    if (!(blob instanceof Blob)) return null;
    return {
      ...asset,
      url: URL.createObjectURL(blob),
      routeSource: asset.kind === 'route',
      classification: asset.kind,
    };
  }).filter(Boolean);
  const routeUpload = state.uploads.find((upload) => upload.id === draft.routeAssetId);
  state.routeImage = routeUpload?.url || '';
  state.sampleDataActive = draft.sampleDataActive;
  state.analyzing = false;

  const hasRoute = !!state.routeImage;
  const hasItinerary = state.itinerary.length > 0;
  const requiredFieldsValid = ['eventDate', 'meetingTime', 'plannerStudentId', 'plannerName', 'plannerPhone', 'baseName', 'basePhone']
    .every((id) => {
      const control = root.querySelector(`#${id}`);
      return !!control && control.checkValidity();
    });
  const maxReachedStep = !requiredFieldsValid ? 1 : hasRoute && hasItinerary
    ? Math.max(2, Math.min(3, draft.progress.maxReachedStep))
    : Math.min(2, draft.progress.maxReachedStep);
  state.maxReachedStep = Math.max(1, maxReachedStep);
  state.step = Math.min(draft.progress.step, state.maxReachedStep);
  syncMetricInputs?.();
  renderUploads?.();
  renderRoutePreview?.();
  renderItinerary?.();
  renderProgress?.();
  syncStep2Readiness?.();
  invalidatePdf?.();
  for (const step of root.querySelectorAll('.step[data-step]')) {
    step.classList.toggle('is-active', Number(step.dataset.step) === state.step);
  }
  return { draft, restoredAssets: state.uploads.length };
}
