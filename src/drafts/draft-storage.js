import { normalizeDraft } from './draft-schema.js';

const DATABASE = 'tozan-mountain-drafts-v1';
const DATABASE_VERSION = 1;
const DRAFTS = 'drafts';
const ASSETS = 'assets';

export function draftScopeKey(scope) {
  if (scope?.kind === 'project' && typeof scope.roomId === 'string' && scope.roomId.trim()) return `project:${scope.roomId.trim()}`;
  if (scope?.kind === 'standalone' && typeof scope.draftId === 'string' && scope.draftId.trim()) return `standalone:${scope.draftId.trim()}`;
  throw new TypeError('下書きの保存先が正しくありません。');
}

function openDatabase(indexedDB = globalThis.indexedDB) {
  if (!indexedDB) return Promise.reject(new DOMException('IndexedDBを利用できません。', 'NotSupportedError'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAFTS)) db.createObjectStore(DRAFTS, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(ASSETS)) db.createObjectStore(ASSETS, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('下書きを開けません。'));
    request.onblocked = () => reject(new Error('別のタブで下書きを使用中です。'));
  });
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('下書きを読み取れません。'));
  });
}

export async function loadDraft(scope, { indexedDB } = {}) {
  const key = draftScopeKey(scope);
  const db = await openDatabase(indexedDB);
  try {
    const tx = db.transaction([DRAFTS, ASSETS], 'readonly');
    const saved = await requestValue(tx.objectStore(DRAFTS).get(key));
    if (!saved) return { status: 'empty', draft: null, assets: new Map() };
    const draft = normalizeDraft(saved.draft);
    if (draftScopeKey(draft.scope) !== key) return { status: 'invalid', draft: null, assets: new Map() };
    const assetStore = tx.objectStore(ASSETS);
    const assets = new Map();
    for (const asset of draft.assets) {
      const record = await requestValue(assetStore.get(`${key}:${asset.id}`));
      if (record?.blob instanceof Blob) assets.set(asset.id, record.blob);
    }
    return { status: 'loaded', draft, assets };
  } finally { db.close(); }
}

export async function saveDraft(scope, value, { expectedRevision, assets = [], indexedDB } = {}) {
  const key = draftScopeKey(scope);
  const draft = normalizeDraft(value);
  if (draftScopeKey(draft.scope) !== key) throw new TypeError('別の企画の下書きは保存できません。');
  const blobs = new Map(assets.map(({ id, blob }) => [id, blob]));
  for (const asset of draft.assets) {
    if (!blobs.has(asset.id) || !(blobs.get(asset.id) instanceof Blob)) throw new TypeError('下書きの画像データがありません。');
  }
  const db = await openDatabase(indexedDB);
  try {
    const tx = db.transaction([DRAFTS, ASSETS], 'readwrite');
    const drafts = tx.objectStore(DRAFTS), images = tx.objectStore(ASSETS);
    const existing = await requestValue(drafts.get(key));
    const actualRevision = existing?.draft?.revision ?? 0;
    if (expectedRevision !== undefined && actualRevision !== expectedRevision) {
      tx.abort();
      return { status: 'conflict', actualRevision };
    }
    const nextDraft = normalizeDraft({ ...draft, revision: actualRevision + 1, savedAt: new Date().toISOString() });
    drafts.put({ key, draft: nextDraft });
    const wantedKeys = new Set(nextDraft.assets.map((asset) => `${key}:${asset.id}`));
    const oldRecords = await requestValue(images.getAll());
    for (const record of oldRecords) if (record.key.startsWith(`${key}:`) && !wantedKeys.has(record.key)) images.delete(record.key);
    for (const asset of nextDraft.assets) images.put({ key: `${key}:${asset.id}`, blob: blobs.get(asset.id) });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error || new Error('下書きを保存できませんでした。'));
      tx.onerror = () => reject(tx.error || new Error('下書きを保存できませんでした。'));
    });
    return { status: 'saved', draft: nextDraft };
  } catch (error) {
    if (error?.name === 'AbortError' && expectedRevision !== undefined) return { status: 'conflict' };
    return { status: error?.name === 'QuotaExceededError' ? 'quota' : 'error', error };
  } finally { db.close(); }
}

export async function deleteDraft(scope, { expectedRevision, indexedDB } = {}) {
  const key = draftScopeKey(scope);
  const db = await openDatabase(indexedDB);
  try {
    const tx = db.transaction([DRAFTS, ASSETS], 'readwrite');
    const drafts = tx.objectStore(DRAFTS), images = tx.objectStore(ASSETS);
    const existing = await requestValue(drafts.get(key));
    const actualRevision = existing?.draft?.revision ?? 0;
    if (expectedRevision !== undefined && actualRevision !== expectedRevision) {
      tx.abort();
      return { status: 'conflict', actualRevision };
    }
    drafts.delete(key);
    const records = await requestValue(images.getAll());
    for (const record of records) if (record.key.startsWith(`${key}:`)) images.delete(record.key);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error || new Error('下書きを削除できませんでした。'));
      tx.onerror = () => reject(tx.error || new Error('下書きを削除できませんでした。'));
    });
    return { status: 'deleted' };
  } catch (error) { return { status: 'error', error }; }
  finally { db.close(); }
}
