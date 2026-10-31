import { normalizeDraft } from './draft-schema.js';

function bytesToBase64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
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
