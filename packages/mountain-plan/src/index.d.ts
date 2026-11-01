import type { ComponentType } from 'react';

export interface MountainPlanWorkspaceProps {
  project: { roomId: string; projectName?: string; eventDate?: string; debugSample?: boolean };
  active?: boolean;
  onNotice?: (message: string) => void;
}
export declare const MountainPlanWorkspace: ComponentType<MountainPlanWorkspaceProps>;
export declare const mountainPlanExamples: Readonly<Record<string, string>>;
export default MountainPlanWorkspace;
