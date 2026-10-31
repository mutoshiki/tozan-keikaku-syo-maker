import { useCallback, useEffect, useRef, useState } from 'react';
import { captureDraft, restoreDraft } from './draft-runtime-adapter.js';
import { deleteDraft, loadDraft, saveDraft } from './draft-storage.js';
import { exportDraftFile, importDraftFile } from './draft-files.js';

const scopeId = (scope) => scope.kind === 'project' ? `project:${scope.roomId}` : `standalone:${scope.draftId}`;

async function assetsFor(runtime) {
  const assets = [];
  for (const upload of runtime.state.uploads || []) {
    const response = await fetch(upload.url);
    if (!response.ok) throw new Error('画像を保存できません。');
    const blob = await response.blob();
    assets.push({ id: upload.id, kind: upload.kind, name: upload.name, mimeType: blob.type || 'image/jpeg', blob });
  }
  return assets;
}

export function useMountainDraft(scope, runtimeInstance) {
  const [status, setStatus] = useState('loading');
  const [hasDraft, setHasDraft] = useState(false);
  const [error, setError] = useState('');
  const runtimeRef = useRef(null);
  const revisionRef = useRef(0);
  const generationRef = useRef(0);
  const timerRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const scopeKey = scopeId(scope);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const save = useCallback(async (flush = false) => {
    if (!flush) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { void save(true); }, 800);
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = null;
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return;
    }
    const runtime = runtimeRef.current;
    if (!runtime) return;
    saveInFlightRef.current = true;
    const generation = generationRef.current;
    try {
      setStatus('saving');
      const assets = await assetsFor(runtime);
      const draft = captureDraft(runtime, { scope: scopeRef.current, revision: revisionRef.current, assets });
      if (generation !== generationRef.current) return;
      const result = await saveDraft(scopeRef.current, draft, { expectedRevision: revisionRef.current, assets });
      if (generation !== generationRef.current) return;
      if (result.status === 'saved') {
        revisionRef.current = result.draft.revision;
        setHasDraft(true);
        setStatus('saved');
        setError('');
      } else if (result.status === 'conflict') {
        setStatus('conflict');
        setError('別のタブで下書きが更新されました。最新の下書きを読み込んでください。');
      } else {
        setStatus('error');
        setError(result.status === 'quota' ? '保存容量が不足しています。下書きを書き出してください。' : '下書きを保存できませんでした。');
      }
    } catch (cause) {
      if (generation !== generationRef.current) return;
      setStatus('error');
      setError(cause?.name === 'QuotaExceededError' ? '保存容量が不足しています。下書きを書き出してください。' : '下書きを保存できませんでした。');
    } finally {
      saveInFlightRef.current = false;
      if (saveQueuedRef.current && generation === generationRef.current) {
        saveQueuedRef.current = false;
        void save(true);
      }
    }
  }, [scopeKey]);

  const restore = useCallback(async () => {
    const runtime = runtimeRef.current;
    if (!runtime) return false;
    const loaded = await loadDraft(scopeRef.current);
    if (loaded.status !== 'loaded') return false;
    restoreDraft(runtime, loaded.draft, loaded.assets);
    revisionRef.current = loaded.draft.revision;
    setHasDraft(true);
    setStatus('saved');
    setError('');
    return true;
  }, [scopeKey]);

  useEffect(() => {
    let cancelled = false;
    let attachingRuntime = null;
    const generation = ++generationRef.current;
    setStatus('loading');
    const attach = async () => {
      const runtime = runtimeInstance?.draftRuntime;
      if (!runtime || runtime === attachingRuntime) return;
      // `runtime-ready` can arrive just before this effect subscribes. In that
      // case we attach immediately below, while a queued event may also call
      // `attach`. Reserve the instance before awaiting IndexedDB so the two
      // paths cannot save the same initial revision concurrently.
      attachingRuntime = runtime;
      const sampleGeneration = runtime.sampleGeneration || 0;
      runtimeRef.current = runtime;
      const loaded = await loadDraft(scopeRef.current);
      if (cancelled || generation !== generationRef.current) return;
      const sampleSelectedDuringLoad = sampleGeneration !== (runtime.sampleGeneration || 0);
      if (loaded.status === 'loaded') {
        revisionRef.current = loaded.draft.revision;
        setHasDraft(true);
        // A sample may be selected while IndexedDB is still responding. Do not
        // let that older snapshot repaint the newly selected sample over it.
        if (!sampleSelectedDuringLoad && runtime.state.sampleDataActive !== true) restoreDraft(runtime, loaded.draft, loaded.assets);
        setStatus('saved');
      } else {
        revisionRef.current = 0;
        setHasDraft(false);
        setStatus('saved');
      }
      const changed = (event) => { void save(event?.detail?.flush === true); };
      const eventTarget = runtime.root;
      const onWorkspaceActive = (event) => { if (event.detail?.active === false) void save(true); };
      eventTarget.addEventListener('input', changed, true);
      eventTarget.addEventListener('change', changed, true);
      eventTarget.addEventListener('click', changed, true);
      eventTarget.addEventListener('tozan:draft-change', changed);
      eventTarget.addEventListener('tozan:workspace-active', onWorkspaceActive);
      runtime.disposeDraftListeners?.();
      runtime.disposeDraftListeners = () => {
        eventTarget.removeEventListener('input', changed, true);
        eventTarget.removeEventListener('change', changed, true);
        eventTarget.removeEventListener('click', changed, true);
        eventTarget.removeEventListener('tozan:draft-change', changed);
        eventTarget.removeEventListener('tozan:workspace-active', onWorkspaceActive);
      };
      // DraftControls owns sample loading and persists it after the initial
      // draft read completes. Saving here as well races that save at revision
      // zero and makes the freshly loaded sample appear as a cross-tab conflict.
    };
    const onReady = () => { void attach().catch(() => { if (!cancelled) { setStatus('error'); setError('下書きを読み込めませんでした。'); } }); };
    window.addEventListener('tozan:runtime-ready', onReady);
    if (runtimeInstance?.draftRuntime) onReady();
    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
      saveQueuedRef.current = false;
      if (generation === generationRef.current) generationRef.current += 1;
      runtimeRef.current?.disposeDraftListeners?.();
      window.removeEventListener('tozan:runtime-ready', onReady);
    };
  }, [scopeKey, save, runtimeInstance?.draftRuntime]);

  const exportFile = useCallback(async () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const assets = await assetsFor(runtime);
    const draft = captureDraft(runtime, { scope: scopeRef.current, revision: revisionRef.current, assets });
    const blob = await exportDraftFile(draft, new Map(assets.map((asset) => [asset.id, asset.blob])));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '登山計画書の下書き.json';
    link.click();
    URL.revokeObjectURL(url);
  }, [scopeKey]);

  const importFile = useCallback(async (file) => {
    const imported = await importDraftFile(file, scopeRef.current);
    const assets = imported.draft.assets.map((asset) => ({ id: asset.id, blob: imported.assets.get(asset.id) }));
    const result = await saveDraft(scopeRef.current, imported.draft, { expectedRevision: revisionRef.current, assets });
    if (result.status !== 'saved') throw new Error('下書きを保存できませんでした。現在の下書きは保持されています。');
    revisionRef.current = result.draft.revision;
    restoreDraft(runtimeRef.current, result.draft, imported.assets);
    setHasDraft(true);
    setStatus('saved');
    setError('');
  }, [scopeKey]);

  const remove = useCallback(async () => {
    const result = await deleteDraft(scopeRef.current, { expectedRevision: revisionRef.current });
    if (result.status === 'deleted') { revisionRef.current = 0; setHasDraft(false); setStatus('saved'); setError(''); }
    else { setStatus('conflict'); setError('別のタブで更新されました。最新の下書きを確認してください。'); }
  }, [scopeKey]);

  return { status, hasDraft, error, restore, saveNow: () => save(true), exportFile, importFile, remove };
}
