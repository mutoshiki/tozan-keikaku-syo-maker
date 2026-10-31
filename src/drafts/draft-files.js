import { normalizeDraft } from './draft-schema.js';

function bytesToBase64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBlob(value, mimeType) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new TypeError('画像データを読み込めません。');
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

export async function exportDraftFile(draftValue, assets) {
  const draft = normalizeDraft(draftValue);
  const files = [];
  for (const asset of draft.assets) {
    const blob = assets.get(asset.id);
    if (!(blob instanceof Blob)) throw new TypeError('下書きの画像データがありません。');
    files.push({ id: asset.id, data: bytesToBase64(new Uint8Array(await blob.arrayBuffer())) });
  }
  return new Blob([JSON.stringify({ format: 'tozan-draft', draft, files }, null, 2)], { type: 'application/json' });
}

export async function importDraftFile(file, targetScope) {
  if (!(file instanceof Blob) || file.size > 100 * 1024 * 1024) throw new TypeError('下書きファイルのサイズを確認してください。');
  let payload;
  try { payload = JSON.parse(await file.text()); } catch { throw new TypeError('下書きファイルを読み込めません。'); }
  if (payload?.format !== 'tozan-draft' || !Array.isArray(payload.files)) throw new TypeError('このファイルは下書きファイルではありません。');
  const draft = normalizeDraft(payload.draft);
  const blobs = new Map(payload.files.map(({ id, data }) => {
    const metadata = draft.assets.find((asset) => asset.id === id);
    if (!metadata) throw new TypeError('下書きファイルに未登録の画像があります。');
    return [id, base64ToBlob(data, metadata.mimeType)];
  }));
  if (draft.assets.some((asset) => !blobs.has(asset.id))) throw new TypeError('画像データが不足しています。');
  return {
    draft: normalizeDraft({ ...draft, scope: targetScope, revision: 0, savedAt: new Date().toISOString() }),
    assets: blobs,
  };
}
