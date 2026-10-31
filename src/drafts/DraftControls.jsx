import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@carbon/react';
import { useMountainDraft } from './useMountainDraft.js';
import { loadProjectSample } from './project-sample.js';

export function DraftControls({ scope, runtime, embedded = false, project = null, loadSampleOnReady = false }) {
  const draft = useMountainDraft(scope, runtime);
  const fileRef = useRef(null);
  const sampleStarted = useRef(false);
  const [projectDateImported, setProjectDateImported] = useState(false);
  const dateField = runtime?.draftRuntime?.root?.querySelector?.('#eventDate');
  const projectDate = /^\d{4}-\d{2}-\d{2}$/.test(String(project?.eventDate || '')) ? project.eventDate : '';
  const message = draft.status === 'loading' ? '下書きを確認中'
    : draft.status === 'saving' ? '保存中'
      : draft.status === 'saved' ? 'この端末に保存済み'
        : draft.status === 'conflict' ? '別のタブで更新あり' : '保存できません';

  useEffect(() => {
    if (!loadSampleOnReady || sampleStarted.current || draft.status === 'loading' || draft.status === 'saving' || draft.status === 'conflict') return;
    if (draft.hasDraft) return;
    sampleStarted.current = true;
    loadProjectSample(runtime, projectDate);
    void draft.saveNow();
  }, [loadSampleOnReady, draft.status, draft.hasDraft, draft.saveNow, runtime]);

  useEffect(() => {
    if (!loadSampleOnReady || !runtime) return undefined;
    const reset = async event => {
      if (event.detail?.roomId !== scope.roomId) return;
      await draft.remove();
      loadProjectSample(runtime, projectDate);
      await draft.saveNow();
    };
    window.addEventListener('sanpo:debug-sample-reset', reset);
    return () => window.removeEventListener('sanpo:debug-sample-reset', reset);
  }, [loadSampleOnReady, runtime, scope.roomId, projectDate, draft.remove, draft.saveNow]);

  async function handleImport(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (draft.hasDraft && !window.confirm('現在の下書きを読み込んだ内容に置き換えます。よろしいですか？')) return;
    try { await draft.importFile(file); }
    catch (error) { window.alert(error.message || '下書きを読み込めませんでした。'); }
  }

  async function handleDelete() {
    if (!window.confirm('この登山計画書の下書きを削除します。よろしいですか？')) return;
    await draft.remove();
  }

  async function handleSample() {
    if (draft.hasDraft && !window.confirm('現在の登山計画書を機能確認用サンプルに置き換えます。よろしいですか？')) return;
    const label = loadProjectSample(runtime, projectDate);
    if (!label) return;
    await draft.saveNow();
  }

  function handleImportProjectDate() {
    if (draft.status === 'loading' || !projectDate || !dateField || dateField.value) return;
    dateField.value = projectDate;
    dateField.dispatchEvent(new Event('input', { bubbles: true }));
    dateField.dispatchEvent(new Event('change', { bubbles: true }));
    setProjectDateImported(true);
  }

  return (
    <section className="draft-controls" aria-label="下書き">
      <div className="draft-controls__status" role="status" aria-live="polite">
        <span className={`draft-controls__indicator draft-controls__indicator--${draft.status}`} aria-hidden="true" />
        <span>{message}</span>
      </div>
      {embedded && projectDate && <div className="draft-controls__project-date">
        <span>企画日：{projectDate}</span>
        <Button kind="ghost" size="sm" type="button" disabled={draft.status === 'loading' || Boolean(dateField?.value) || projectDateImported} onClick={handleImportProjectDate}>実施日に使う</Button>
      </div>}
      {draft.error && <p className="draft-controls__error" role="alert">{draft.error}</p>}
      {draft.status === 'conflict' && <Button kind="ghost" size="sm" type="button" onClick={() => void draft.restore()}>最新の下書きを読み込む</Button>}
      <details className="draft-controls__menu">
        <summary>下書きの操作</summary>
        <div className="draft-controls__actions">
          {embedded && <Button kind="ghost" size="sm" type="button" onClick={() => void handleSample()}>機能確認用サンプルを読み込む</Button>}
          <Button kind="ghost" size="sm" type="button" onClick={() => void draft.saveNow()}>今すぐ保存</Button>
          <Button kind="ghost" size="sm" type="button" onClick={() => void draft.exportFile()}>下書きを書き出す</Button>
          <Button kind="ghost" size="sm" type="button" onClick={() => fileRef.current?.click()}>下書きを読み込む</Button>
          {draft.hasDraft && <Button kind="danger--ghost" size="sm" type="button" onClick={() => void handleDelete()}>下書きを削除</Button>}
        </div>
      </details>
      <input ref={fileRef} className="draft-controls__file" type="file" accept="application/json,.json" aria-label="読み込む下書きファイル" onChange={handleImport} />
    </section>
  );
}

export default DraftControls;
