export const DRAFT_SCHEMA_VERSION = 1;
export const DRAFT_FIELD_IDS = Object.freeze([
  'eventDate', 'meetingTime', 'plannerStudentId', 'plannerName', 'plannerPhone',
  'baseName', 'basePhone', 'meetingPlace', 'rainPolicy', 'mountainName',
  'areaMunicipality', 'drinkLiters', 'police1Name', 'police1Phone',
  'police2Name', 'police2Phone', 'police3Name', 'police3Phone',
]);

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function normalizeDraft(value) {
  if (!isRecord(value) || value.schemaVersion !== DRAFT_SCHEMA_VERSION) {
    throw new TypeError('この下書き形式には対応していません。');
  }
  const scope = value.scope;
  if (!isRecord(scope) || !['project', 'standalone'].includes(scope.kind)) {
    throw new TypeError('下書きの保存先が正しくありません。');
  }
  if (scope.kind === 'project' && (typeof scope.roomId !== 'string' || !scope.roomId.trim())) {
    throw new TypeError('企画IDがありません。');
  }
  if (scope.kind === 'standalone' && (typeof scope.draftId !== 'string' || !scope.draftId.trim())) {
    throw new TypeError('下書きIDがありません。');
  }
  if (!Number.isSafeInteger(value.revision) || value.revision < 0) throw new TypeError('下書きの版が正しくありません。');
  if (typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt))) throw new TypeError('保存日時が正しくありません。');
  if (!isRecord(value.fields) || !isRecord(value.metrics) || !Array.isArray(value.itinerary) || !Array.isArray(value.assets)) {
    throw new TypeError('下書きの内容が正しくありません。');
  }

  const fields = Object.fromEntries(DRAFT_FIELD_IDS
    .filter((id) => Object.hasOwn(value.fields, id) && typeof value.fields[id] === 'string')
    .map((id) => [id, value.fields[id]]));
  const metrics = {};
  for (const key of ['durationMinutes', 'distanceKm', 'ascentM', 'descentM']) {
    const metric = value.metrics[key];
    if (metric !== null && metric !== undefined && (typeof metric !== 'number' || !Number.isFinite(metric) || metric < 0)) {
      throw new TypeError(`計画値 ${key} が正しくありません。`);
    }
    metrics[key] = metric ?? null;
  }
  const itinerary = value.itinerary.map((row) => {
    if (!isRecord(row) || typeof row.time !== 'string' || typeof row.place !== 'string'
      || typeof row.major !== 'boolean' || !Number.isFinite(Number(row.restMinutes)) || Number(row.restMinutes) < 0) {
      throw new TypeError('行程に正しくない項目があります。');
    }
    return { time: row.time, place: row.place, major: row.major, restMinutes: Number(row.restMinutes) };
  });
  const assets = value.assets.map((asset) => {
    if (!isRecord(asset) || typeof asset.id !== 'string' || !asset.id
      || typeof asset.kind !== 'string' || !['route', 'itinerary'].includes(asset.kind)
      || typeof asset.name !== 'string' || !['image/png', 'image/jpeg', 'image/webp'].includes(asset.mimeType)) {
      throw new TypeError('画像情報が正しくありません。');
    }
    return { id: asset.id, kind: asset.kind, name: asset.name, mimeType: asset.mimeType };
  });
  const progress = isRecord(value.progress) ? value.progress : {};
  const step = Number(progress.step), maxReachedStep = Number(progress.maxReachedStep);
  if (![1, 2, 3].includes(step) || ![1, 2, 3].includes(maxReachedStep) || step > maxReachedStep) {
    throw new TypeError('作成手順の状態が正しくありません。');
  }
  if (value.routeAssetId !== null && value.routeAssetId !== undefined
    && !assets.some((asset) => asset.id === value.routeAssetId && asset.kind === 'route')) {
    throw new TypeError('ルート画像の参照先がありません。');
  }

  return {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    scope: scope.kind === 'project'
      ? { kind: 'project', roomId: scope.roomId.trim() }
      : { kind: 'standalone', draftId: scope.draftId.trim() },
    revision: value.revision,
    savedAt: value.savedAt,
    fields,
    metrics,
    itinerary,
    assets,
    routeAssetId: value.routeAssetId || null,
    progress: { step, maxReachedStep },
    sampleDataActive: value.sampleDataActive === true,
  };
}

export function validateDraft(value) {
  try { return { valid: true, draft: normalizeDraft(value) }; }
  catch (error) { return { valid: false, error }; }
}
