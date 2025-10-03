'use client';

import type { Event } from '@vercel/workflow-world';
import { useEffect, useState } from 'react';
import { fetchEvent, type WorldConfig } from '@/lib/world';
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
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetchEvent(config, runId, eventId)
      .then(setEvent)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [config, runId, eventId]);

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
