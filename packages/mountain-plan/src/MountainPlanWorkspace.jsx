import React, { useMemo } from 'react';
import App from '../../../src/App.jsx';
import { mountainPlanExamples } from './assets.js';

export function MountainPlanWorkspace({ project, active = true, onNotice }) {
  const scope = useMemo(() => project?.roomId ? { kind: 'project', roomId: project.roomId } : null, [project?.roomId]);
  if (!scope) return <p role="alert">企画を読み込めません。</p>;
  return (
    <div className="mountain-plan-inline" hidden={!active}>
    <App draftScope={scope} projectContext={project} embedded active={active} assetBaseUrl="" examples={mountainPlanExamples} onNotice={onNotice} />
    </div>
  );
}

export default MountainPlanWorkspace;
