import React, { useEffect, useState } from 'react';
import { Button } from '@carbon/react';
import { parseProjectContext } from './project-handoff.js';

function clearHandoffFragment() {
  if (!window.location.hash.startsWith('#sanpo-project=')) return;
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
}

export default function ProjectHandoffNotice() {
  const [context, setContext] = useState(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const received = parseProjectContext(window.location.hash);
    if (received) setContext(received);
  }, []);

  function applyDate() {
    const field = document.getElementById('eventDate');
    if (!field) {
      setStatus('実施日の入力欄が見つからないため、反映できませんでした。');
      return;
    }
    if (field.value) {
      setStatus('実施日はすでに入力されています。入力内容を保ちました。');
      return;
    }
    if (!context?.eventDate) {
      setStatus('取り込める実施日がありません。実施日を入力してください。');
      return;
    }
    field.value = context.eventDate;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    clearHandoffFragment();
    setStatus(`${context.projectName}から実施日を反映しました。`);
    setContext(null);
  }

  function dismiss() {
    clearHandoffFragment();
    setContext(null);
    setStatus('企画情報は反映していません。入力内容は変更されていません。');
  }

  return <>
    {context && <section className="project-handoff" aria-labelledby="project-handoff-heading">
      <h2 id="project-handoff-heading">企画情報を受け取りました</h2>
      <p>企画名：{context.projectName}</p>
      {context.eventDate ? <p>実施日：{context.eventDate}</p> : <p>実施日は企画に登録されていません。</p>}
      <p>実施日だけを反映します。入力済みの内容は上書きしません。</p>
      <div className="project-handoff__actions">
        <Button size="sm" disabled={!context.eventDate} onClick={applyDate}>実施日に反映</Button>
        <Button kind="ghost" size="sm" onClick={dismiss}>今回は使わない</Button>
      </div>
    </section>}
    {status && <p className="project-handoff__status" role="status" aria-live="polite">{status}</p>}
  </>;
}
