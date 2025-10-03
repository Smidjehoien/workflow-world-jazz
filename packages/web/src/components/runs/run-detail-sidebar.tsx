'use client';

import { JsonView } from '../display-utils/json-view';
import { SidePanel } from '../display-utils/side-panel';

interface RunDetailSidebarProps {
  runData: unknown;
  runId: string;
  onClose: () => void;
  onStreamClick: (streamId: string) => void;
}

export function RunDetailSidebar({ runData, onClose }: RunDetailSidebarProps) {
  return (
    <SidePanel isOpen={true} onClose={onClose} title="Run Details (JSON)">
      <JsonView data={runData} showCard={false} />
    </SidePanel>
  );
}
