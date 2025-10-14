'use client';

import { useHook } from '@/hooks/use-api';
import type { WorldConfig } from '@/lib/config-world';
import { JsonView } from '../display-utils/json-view';
import { SidePanel } from '../display-utils/side-panel';

interface HookDetailSidebarProps {
  config: WorldConfig;
  hookId: string;
  onClose: () => void;
}

export function HookDetailSidebar({
  config,
  hookId,
  onClose,
}: HookDetailSidebarProps) {
  const { data: hook, error, isLoading } = useHook(config, hookId);

  if (error) {
    return (
      <SidePanel isOpen={true} onClose={onClose} title="Hook Details">
        <div className="text-center py-8 text-red-600">
          Error: {error.message}
        </div>
      </SidePanel>
    );
  }

  if (isLoading) {
    return (
      <SidePanel isOpen={true} onClose={onClose} title="Hook Details">
        <div className="text-center py-8">Loading...</div>
      </SidePanel>
    );
  }

  if (!hook) {
    return (
      <SidePanel isOpen={true} onClose={onClose} title="Hook Details">
        <div className="text-center py-8">Hook not found</div>
      </SidePanel>
    );
  }

  return (
    <SidePanel isOpen={true} onClose={onClose} title="Hook Details">
      <JsonView data={hook} showCard={false} />
    </SidePanel>
  );
}
