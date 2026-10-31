import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@carbon/react';
import { useMountainDraft } from './useMountainDraft.js';
import { loadProjectSample } from './project-sample.js';

export function DraftControls({ scope, runtime, embedded = false, project = null, loadSampleOnReady = false }) {
  const draft = useMountainDraft(scope, runtime);
  const sampleStarted = useRef(false);
  const [savedToast, setSavedToast] = useState(false);
  const previousStatus = useRef(draft.status);
  const toastTimer = useRef(null);
  const dateField = runtime?.draftRuntime?.root?.querySelector?.('#eventDate');
  const projectDate = /^\d{4}-\d{2}-\d{2}$/.test(String(project?.eventDate || '')) ? project.eventDate : '';
  const message = draft.status === 'loading' ? '下書きを確認中'
    : draft.status === 'saving' ? '保存中'
      : draft.status === 'saved' ? 'この端末に保存済み'
        : draft.status === 'conflict' ? '別のタブで更新あり' : '保存できません';

  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = draft.status;
    if (!embedded || previous !== 'saving' || draft.status !== 'saved') return undefined;
    setSavedToast(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSavedToast(false), 2400);
    return undefined;
  }, [embedded, draft.status]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

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

  useEffect(() => {
    if (!embedded || loadSampleOnReady || draft.status !== 'saved' || draft.hasDraft || !projectDate || !dateField || dateField.value) return;
    dateField.value = projectDate;
    dateField.dispatchEvent(new Event('input', { bubbles: true }));
    dateField.dispatchEvent(new Event('change', { bubbles: true }));
  }, [embedded, loadSampleOnReady, draft.status, draft.hasDraft, projectDate, dateField]);

  const hasVisibleControls = !embedded || savedToast || Boolean(draft.error) || draft.status === 'conflict';
  if (!hasVisibleControls) return null;

  return (
    <section className="draft-controls" aria-label="下書き">
      {!embedded && <div className="draft-controls__status" role="status" aria-live="polite">
        <span className={`draft-controls__indicator draft-controls__indicator--${draft.status}`} aria-hidden="true" />
        <span>{message}</span>
      </div>}
      {savedToast && <div className="draft-controls__toast" role="status" aria-live="polite">下書きを保存しました</div>}
      {draft.error && <p className="draft-controls__error" role="alert">{draft.error}</p>}
      {draft.status === 'conflict' && <Button kind="ghost" size="sm" type="button" onClick={() => void draft.restore()}>最新の下書きを読み込む</Button>}
      {draft.status === 'error' && draft.hasDraft && <Button kind="ghost" size="sm" type="button" onClick={() => void draft.exportFile()}>下書きを書き出す</Button>}
    </section>
  );
}

export default DraftControls;
