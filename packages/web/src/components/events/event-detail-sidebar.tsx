'use client';

import { useEvent } from '@/hooks/use-api';
import type { WorldConfig } from '@/lib/world';
import { JsonView } from '../display-utils/json-view';
import { SidePanel } from '../display-utils/side-panel';

interface EventDetailSidebarProps {
  config: WorldConfig;
  runId: string;
  eventId: string;
  onClose: () => void;
}

export function EventDetailSidebar({
  config,
  runId,
  eventId,
  onClose,
}: EventDetailSidebarProps) {
  const { data: event, isLoading: loading } = useEvent(config, runId, eventId);

  return (
    <SidePanel isOpen={true} onClose={onClose} title="Event Details">
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : !event ? (
        <div className="text-center py-8">Event not found</div>
      ) : (
        <JsonView data={event} showCard={false} />
      )}
    </SidePanel>
  );
}
